import { z } from "zod";
import { isBase64OfLength } from "../utils/ed25519";

/**
 * Device / PIN-auth request schemas. One file per domain (CLAUDE.md).
 *
 * Wire format (must match the Flutter client):
 *   - publicKey: raw 32-byte Ed25519 key, base64
 *   - signature: raw 64-byte Ed25519 signature, base64
 *   - challenge: the opaque string returned by /auth/pin/challenge, signed as
 *     its UTF-8 bytes
 */

/** A base64 Ed25519 public key (decodes to exactly 32 bytes). */
const publicKeySchema = z
  .string()
  .refine((value) => isBase64OfLength(value, 32), {
    message: "publicKey must be a base64 32-byte Ed25519 key",
  });

/** A base64 Ed25519 signature (decodes to exactly 64 bytes). */
const signatureSchema = z
  .string()
  .refine((value) => isBase64OfLength(value, 64), {
    message: "signature must be a base64 64-byte Ed25519 signature",
  });

/**
 * POST /auth/devices — enroll the current device (authenticated).
 * The client generates a keypair, keeps the private key locally (encrypted by
 * the PIN), and registers the public key here.
 */
export const enrollDeviceSchema = z.object({
  name: z.string().min(1, "Device name is required"),
  platform: z.string().min(1).optional(),
  publicKey: publicKeySchema,
});
export type EnrollDeviceInput = z.infer<typeof enrollDeviceSchema>;

/** POST /auth/pin/challenge — ask for a nonce to sign. */
export const challengeSchema = z.object({
  deviceId: z.coerce.number().int().positive("A valid device id is required"),
});
export type ChallengeInput = z.infer<typeof challengeSchema>;

/** POST /auth/pin/login — prove possession of the private key. */
export const pinLoginSchema = z.object({
  deviceId: z.coerce.number().int().positive("A valid device id is required"),
  challenge: z.string().min(1, "challenge is required"),
  signature: signatureSchema,
});
export type PinLoginInput = z.infer<typeof pinLoginSchema>;

/** Route param for /auth/devices/:id. */
export const deviceIdParamSchema = z.object({
  id: z.coerce.number().int().positive("A valid device id is required"),
});
export type DeviceIdParam = z.infer<typeof deviceIdParamSchema>;
