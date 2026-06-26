-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('ABSENCE', 'PERSONNALISE', 'GROUPE_CLASSE', 'GROUPE_ECOLE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED_INVALID_NUMBER', 'FAILED_SESSION_CLOSED');

-- CreateTable
CREATE TABLE "MessageHistory" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "studentId" INTEGER,
    "parentWhatsapp" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "sentById" INTEGER,

    CONSTRAINT "MessageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageHistory_studentId_idx" ON "MessageHistory"("studentId");

-- CreateIndex
CREATE INDEX "MessageHistory_sentById_idx" ON "MessageHistory"("sentById");

-- CreateIndex
CREATE INDEX "MessageHistory_status_idx" ON "MessageHistory"("status");

-- AddForeignKey
ALTER TABLE "MessageHistory" ADD CONSTRAINT "MessageHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageHistory" ADD CONSTRAINT "MessageHistory_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
