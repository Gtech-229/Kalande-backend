import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as deviceService from "../services/device.service";
import type {
  EnrollDeviceInput,
  ChallengeInput,
  PinLoginInput,
  DeviceIdParam,
} from "../schemas/device.schema";

/**
 * Device / PIN-auth controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * Enroll/list/revoke are authenticated (built from req.user). The challenge and
 * pin-login endpoints are public — identity is proven by the signature.
 */

/**
 * @description Enroll this device's public key for PIN login
 * @route   POST /api/auth/devices
 * @access  Authenticated
 * **/

export const enrollDevice = asyncHandler(async (req: Request, res: Response) => {
  const data = await deviceService.enrollDevice(
    req.user!.userId,
    req.body as EnrollDeviceInput
  );
  res.status(201).json({ success: true, data });
});

/**
 * @description List the authenticated user's enrolled devices
 * @route   GET /api/auth/devices
 * @access  Authenticated
 * **/

export const listDevices = asyncHandler(async (req: Request, res: Response) => {
  const data = await deviceService.listDevices(req.user!.userId);
  res.status(200).json({ success: true, data });
});

/**
 * @description Revoke one of the user's devices
 * @route   DELETE /api/auth/devices/:id
 * @access  Authenticated
 * **/

export const revokeDevice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as DeviceIdParam;
  await deviceService.revokeDevice(req.user!.userId, id);
  res.status(200).json({ success: true, data: { message: "Device revoked" } });
});

/**
 * @description Get a challenge (nonce) for a device to sign
 * @route   POST /api/auth/pin/challenge
 * @access  Public
 * **/

export const createChallenge = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await deviceService.createChallenge(req.body as ChallengeInput);
    res.status(200).json({ success: true, data });
  }
);

/**
 * @description Log in by signing the challenge with the device private key
 * @route   POST /api/auth/pin/login
 * @access  Public
 * **/

export const pinLogin = asyncHandler(async (req: Request, res: Response) => {
  const data = await deviceService.pinLogin(req.body as PinLoginInput);
  res.status(200).json({ success: true, data });
});
