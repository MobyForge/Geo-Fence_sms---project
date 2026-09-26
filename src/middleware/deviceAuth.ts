import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool";
import { AuthenticatedDevice } from "../types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      device?: AuthenticatedDevice;
    }
  }
}

/**
 * Every request from the Android app must carry:
 *   x-device-id: the device_identifier it registered with
 *   x-api-key:   the raw API key issued at registration time
 *
 * We only ever store/compare a SHA-256 hash of the key, never the raw value.
 */
export async function deviceAuth(req: Request, res: Response, next: NextFunction) {
  const deviceIdentifier = req.header("x-device-id");
  const apiKey = req.header("x-api-key");

  if (!deviceIdentifier || !apiKey) {
    return res.status(401).json({ error: "Missing x-device-id or x-api-key header" });
  }

  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

  const result = await pool.query(
    `SELECT id, user_id FROM devices WHERE device_identifier = $1 AND api_key_hash = $2`,
    [deviceIdentifier, apiKeyHash]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ error: "Invalid device credentials" });
  }

  const { id, user_id } = result.rows[0];
  req.device = { deviceId: id, userId: user_id };

  pool
    .query(`UPDATE devices SET last_seen_at = now() WHERE id = $1`, [id])
    .catch((err) => console.error("Failed to update last_seen_at", err));

  next();
}
