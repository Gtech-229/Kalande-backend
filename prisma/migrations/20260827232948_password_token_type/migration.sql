-- CreateEnum
CREATE TYPE "PasswordTokenType" AS ENUM ('SET', 'RESET');

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "type" "PasswordTokenType" NOT NULL DEFAULT 'RESET';
