import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import { verifyEd25519Signature, generateChallenge } from "../utils/ed25519";
import { PIN_CHALLENGE_TTL_MS } from "../constants/auth";
import {
  issueTokensForUser,
  toPublicUser,
  type TokenPair,
} from "./auth.service";
import type {
  EnrollDeviceInput,
  ChallengeInput,
  PinLoginInput,
} from "../schemas/device.schema";

/**
 * Device / PIN authentication business logic. No Express types here (CLAUDE.md).
 *
 * The device holds an Ed25519 private key (unlocked by the local PIN) and proves
 * identity by signing a server challenge. We store only the PUBLIC key and
 * verify signatures — the PIN and private key never reach the backend. A valid
 * PIN login yields the SAME JWT pair as a password login.
 */

/** A device as returned to the client (never the challenge or raw key). */
type PublicDevice = {
  id: number;
  name: string;
  platform: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  revoked: boolean;
};

/** Returned by PIN login: the user plus a fresh token pair. */
type PinLoginResult = { user: ReturnType<typeof toPublicUser> } & TokenPair;

/** Map a Device row to the safe public shape. */
function toPublicDevice(device: {
  id: number;
  name: string;
  platform: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}): PublicDevice {
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    lastUsedAt: device.lastUsedAt,
    createdAt: device.createdAt,
    revoked: device.revokedAt !== null,
  };
}

/**
 * Enroll the current device: register its public key. Requires an authenticated
 * request (the user proves identity via password login before enrolling).
 * Fails if the public key is already registered.
 */
export async function enrollDevice(
  userId: number,
  input: EnrollDeviceInput
): Promise<PublicDevice> {
  const existing = await db.device.findUnique({
    where: { publicKey: input.publicKey },
  });
  if (existing) {
    throw new AppError(
      409,
      "DEVICE_ALREADY_ENROLLED",
      "This device key is already registered"
    );
  }

  const device = await db.device.create({
    data: {
      userId,
      name: input.name,
      platform: input.platform ?? null,
      publicKey: input.publicKey,
    },
  });

  return toPublicDevice(device);
}

/**
 * Issue a single-use challenge (nonce) for a device to sign. Overwrites any
 * previous challenge for that device.
 */
export async function createChallenge(
  input: ChallengeInput
): Promise<{ challenge: string; expiresAt: Date }> {
  const device = await db.device.findFirst({
    where: { id: input.deviceId, revokedAt: null },
  });
  if (!device) {
    throw new AppError(404, "DEVICE_NOT_FOUND", "Device not found");
  }

  const challenge = generateChallenge();
  const expiresAt = new Date(Date.now() + PIN_CHALLENGE_TTL_MS);

  await db.device.update({
    where: { id: device.id },
    data: { challenge, challengeExpiresAt: expiresAt },
  });

  return { challenge, expiresAt };
}

/**
 * Verify a signed challenge and, on success, issue tokens. Every failure returns
 * the same generic 401 (never reveal which check failed). The challenge is
 * single-use: it is cleared once consumed.
 */
export async function pinLogin(input: PinLoginInput): Promise<PinLoginResult> {
  const failed = () =>
    new AppError(401, "PIN_LOGIN_FAILED", "Authentication failed");

  const device = await db.device.findFirst({
    where: { id: input.deviceId, revokedAt: null },
  });
  if (!device || !device.challenge || !device.challengeExpiresAt) {
    throw failed();
  }

  // The presented challenge must be the current, unexpired one for this device.
  if (
    device.challenge !== input.challenge ||
    device.challengeExpiresAt < new Date()
  ) {
    throw failed();
  }

  const signatureOk = verifyEd25519Signature(
    device.publicKey,
    input.challenge,
    input.signature
  );
  if (!signatureOk) {
    throw failed();
  }

  const user = await db.user.findFirst({
    where: { id: device.userId, deletedAt: null },
  });
  if (!user) {
    throw failed();
  }

  // Consume the challenge (single-use) and record usage.
  await db.device.update({
    where: { id: device.id },
    data: { challenge: null, challengeExpiresAt: null, lastUsedAt: new Date() },
  });

  const tokens = await issueTokensForUser(user);
  return { user: toPublicUser(user), ...tokens };
}

/** List a user's enrolled devices (including revoked ones, flagged). */
export async function listDevices(userId: number): Promise<PublicDevice[]> {
  const devices = await db.device.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return devices.map(toPublicDevice);
}

/**
 * Revoke one of the user's devices (soft): its key can no longer log in, so its
 * local PIN becomes worthless. Idempotent. Fails if the device is not theirs.
 */
export async function revokeDevice(
  userId: number,
  deviceId: number
): Promise<void> {
  const device = await db.device.findFirst({
    where: { id: deviceId, userId },
  });
  if (!device) {
    throw new AppError(404, "DEVICE_NOT_FOUND", "Device not found");
  }
  if (device.revokedAt) {
    return; // already revoked
  }

  await db.device.update({
    where: { id: deviceId },
    data: {
      revokedAt: new Date(),
      challenge: null,
      challengeExpiresAt: null,
    },
  });
}
