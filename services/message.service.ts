import {
  Prisma,
  Role,
  MessageType,
  MessageStatus,
  StudentStatus,
} from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import { messageProvider } from "../lib/message-provider";
import { getWhatsAppStatus } from "../config/whatsapp";
import { sleep } from "../utils/sleep";
import { formatDateFr } from "../utils/date";
import { getClassForSupervisor } from "./class.service";
import {
  MESSAGE_BATCH_SIZE,
  MESSAGE_DELAY_MIN_MS,
  MESSAGE_DELAY_MAX_MS,
} from "../constants/message";
import type {
  SendMessageInput,
  MessageHistoryQuery,
} from "../schemas/message.schema";

/**
 * Messaging business logic. No Express types here (CLAUDE.md) — controllers
 * adapt HTTP to/from these plain typed objects.
 *
 * Sending is decoupled from the request: every send only ENQUEUES message_history
 * rows as PENDING. The background worker (lib/message-worker.ts) calls
 * deliverNextBatch() to actually deliver them, paced for anti-spam.
 */

/** Who is performing the action (role enforces what they may send). */
type Actor = {
  userId: number;
  role: Role;
};

/** One recipient to enqueue: which student (if any) and the phone to text. */
type Recipient = {
  studentId: number | null;
  parentWhatsapp: string;
};

/** A history row as returned to the client. */
type MessageHistoryRow = {
  id: number;
  studentId: number | null;
  studentName: string | null;
  parentWhatsapp: string;
  messageText: string;
  type: MessageType;
  status: MessageStatus;
  sentAt: Date | null;
  createdAt: Date;
};

/** A student that needs an automatic absence alert. */
type AbsenceAlertStudent = {
  id: number;
  firstName: string;
  lastName: string;
  parentWhatsapp: string;
};

/**
 * Resolve who receives a manual message, enforcing the role rules:
 * - parent/class: a SUPERVISOR is limited to their own class.
 * - school: ADMIN only.
 */
async function resolveRecipients(
  input: SendMessageInput,
  actor: Actor
): Promise<{ recipients: Recipient[]; messageType: MessageType }> {
  if (input.target === "parent") {
    const student = await db.student.findFirst({
      where: { id: input.studentId, deletedAt: null },
      select: { id: true, classId: true, parentWhatsapp: true },
    });
    if (!student) {
      throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
    }
    if (actor.role === Role.SUPERVISOR) {
      const own = await getClassForSupervisor(actor.userId);
      if (student.classId !== own.id) {
        throw new AppError(403, "NOT_YOUR_CLASS", "This student is not in your class");
      }
    }
    return {
      recipients: [{ studentId: student.id, parentWhatsapp: student.parentWhatsapp }],
      messageType: MessageType.PERSONNALISE,
    };
  }

  if (input.target === "class") {
    const klass = await db.class.findFirst({
      where: { id: input.classId, deletedAt: null },
      select: { id: true },
    });
    if (!klass) {
      throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    }
    if (actor.role === Role.SUPERVISOR) {
      const own = await getClassForSupervisor(actor.userId);
      if (own.id !== klass.id) {
        throw new AppError(403, "NOT_YOUR_CLASS", "You can only message your own class");
      }
    }
    const students = await activeStudentRecipients({ classId: klass.id });
    return { recipients: students, messageType: MessageType.GROUPE_CLASSE };
  }

  // target === "school"
  if (actor.role !== Role.ADMIN) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only an admin can message the whole school"
    );
  }
  const students = await activeStudentRecipients({});
  return { recipients: students, messageType: MessageType.GROUPE_ECOLE };
}

/** Active students (optionally of one class) as message recipients. */
async function activeStudentRecipients(filter: {
  classId?: number;
}): Promise<Recipient[]> {
  const students = await db.student.findMany({
    where: {
      deletedAt: null,
      status: StudentStatus.ACTIVE,
      ...(filter.classId !== undefined ? { classId: filter.classId } : {}),
    },
    select: { id: true, parentWhatsapp: true },
  });
  return students.map((student) => ({
    studentId: student.id,
    parentWhatsapp: student.parentWhatsapp,
  }));
}

/**
 * Enqueue a manual message to a parent, a class, or the whole school.
 * Creates one PENDING history row per recipient and returns how many were
 * queued — it does NOT wait for delivery (the worker handles that).
 */
export async function sendMessage(
  input: SendMessageInput,
  actor: Actor
): Promise<{ queued: number }> {
  const { recipients, messageType } = await resolveRecipients(input, actor);
  if (recipients.length === 0) {
    throw new AppError(
      400,
      "NO_RECIPIENTS",
      "There are no active students to message"
    );
  }

  await db.messageHistory.createMany({
    data: recipients.map((recipient) => ({
      studentId: recipient.studentId,
      parentWhatsapp: recipient.parentWhatsapp,
      messageText: input.message,
      messageType,
      sentById: actor.userId,
    })),
  });

  return { queued: recipients.length };
}

/** Build the French parent-facing absence alert text. */
function buildAbsenceMessage(
  firstName: string,
  lastName: string,
  subject: string,
  date: Date
): string {
  return (
    `Bonjour, votre enfant ${firstName} ${lastName} a été marqué(e) absent(e) ` +
    `au cours de ${subject} le ${formatDateFr(date)}. ` +
    `Merci de contacter l'école pour toute information.`
  );
}

/**
 * Enqueue automatic absence alerts after a call is submitted. Called by the
 * attendance service; does nothing when there are no absentees.
 */
export async function queueAbsenceAlerts(params: {
  students: AbsenceAlertStudent[];
  subject: string;
  date: Date;
  sentById: number;
}): Promise<void> {
  if (params.students.length === 0) {
    return;
  }

  await db.messageHistory.createMany({
    data: params.students.map((student) => ({
      studentId: student.id,
      parentWhatsapp: student.parentWhatsapp,
      messageText: buildAbsenceMessage(
        student.firstName,
        student.lastName,
        params.subject,
        params.date
      ),
      messageType: MessageType.ABSENCE,
      sentById: params.sentById,
    })),
  });
}

/** Random anti-spam pause between two sends. */
function randomDelayMs(): number {
  const span = MESSAGE_DELAY_MAX_MS - MESSAGE_DELAY_MIN_MS;
  return MESSAGE_DELAY_MIN_MS + Math.floor(Math.random() * (span + 1));
}

/**
 * Deliver one batch of PENDING messages through the provider, pacing each send.
 * Returns how many rows were processed (0 when the provider is not ready or the
 * queue is empty) so the worker can decide whether to idle.
 */
export async function deliverNextBatch(): Promise<number> {
  // Provider down -> leave rows PENDING and retry later (don't burn them).
  if (!messageProvider.isReady()) {
    return 0;
  }

  const pending = await db.messageHistory.findMany({
    where: { status: MessageStatus.PENDING, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: MESSAGE_BATCH_SIZE,
  });

  for (const message of pending) {
    const outcome = await messageProvider.sendText(
      message.parentWhatsapp,
      message.messageText
    );

    await db.messageHistory.update({
      where: { id: message.id },
      data: {
        status: outcome,
        sentAt: outcome === "SENT" ? new Date() : null,
      },
    });

    // Anti-spam pause between messages (APP_CONTEXT.md).
    await sleep(randomDelayMs());
  }

  return pending.length;
}

/**
 * List message history. ADMIN sees everything; a SUPERVISOR sees only messages
 * about students in their own class.
 */
export async function getHistory(
  filter: MessageHistoryQuery,
  actor: Actor
): Promise<MessageHistoryRow[]> {
  const where: Prisma.MessageHistoryWhereInput = { deletedAt: null };
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.type) {
    where.messageType = filter.type;
  }
  if (filter.studentId !== undefined) {
    where.studentId = filter.studentId;
  }
  if (actor.role === Role.SUPERVISOR) {
    const own = await getClassForSupervisor(actor.userId);
    where.student = { classId: own.id };
  }

  const records = await db.messageHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  return records.map((record) => ({
    id: record.id,
    studentId: record.studentId,
    studentName: record.student
      ? `${record.student.firstName} ${record.student.lastName}`
      : null,
    parentWhatsapp: record.parentWhatsapp,
    messageText: record.messageText,
    type: record.messageType,
    status: record.status,
    sentAt: record.sentAt,
    createdAt: record.createdAt,
  }));
}

/**
 * The WhatsApp connection status (state + a QR data URL to scan while linking).
 * Powers the admin status screen that completes the one-time QR pairing.
 */
export function whatsAppStatus(): ReturnType<typeof getWhatsAppStatus> {
  return getWhatsAppStatus();
}
