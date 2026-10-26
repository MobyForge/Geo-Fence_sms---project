
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { deviceAuth } from "../middleware/deviceAuth";

const router = Router();

const tokenSchema = z.object({
  fcmToken: z.string().min(20).max(4096),
});

router.post("/", deviceAuth, async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid FCM token" });
  }

  try {
    const result = await pool.query(
      `UPDATE devices
       SET fcm_token = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [
        parsed.data.fcmToken,
        req.device!.deviceId,
        req.device!.userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    return res.status(200).json({ registered: true });
  } catch (err) {
    console.error("FCM token registration failed", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
