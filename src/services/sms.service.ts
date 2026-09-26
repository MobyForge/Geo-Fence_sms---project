import twilio from "twilio";
import { pool } from "../db/pool";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

interface SendArgs {
  tripId: string;
  guardianId: string | null;
  toPhoneNumber: string;
  message: string;
}

/**
 * Sends one SMS and records the attempt (success or failure) in `notifications`.
 * Swap the body of this function to call any other SMS provider (MSG91, SNS, etc.)
 * without touching the callers.
 */
export async function sendSms({ tripId, guardianId, toPhoneNumber, message }: SendArgs) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (trip_id, guardian_id, recipient_phone, message, status, attempted_at)
     VALUES ($1, $2, $3, $4, 'PENDING', now())
     RETURNING id`,
    [tripId, guardianId, toPhoneNumber, message]
  );
  const notificationId = rows[0].id;

  try {
    if (!client) {
      throw new Error("SMS provider not configured (missing Twilio credentials)");
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER,
      to: toPhoneNumber,
    });

    await pool.query(
      `UPDATE notifications SET status = 'SENT', provider_message_id = $1, sent_at = now() WHERE id = $2`,
      [result.sid, notificationId]
    );
    return { success: true as const, notificationId };
  } catch (err: any) {
    await pool.query(
      `UPDATE notifications SET status = 'FAILED', error_message = $1 WHERE id = $2`,
      [String(err?.message ?? err), notificationId]
    );
    console.error("SMS send failed", err);
    return { success: false as const, notificationId, error: err };
  }
}
