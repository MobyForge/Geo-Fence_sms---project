import admin from "firebase-admin";
import { pool } from "../db/pool";
import { sendSms } from "./sms.service";
import { GeofenceEventInput, LocationRow } from "../types";

const DEBOUNCE_SECONDS = Number(process.env.EVENT_DEBOUNCE_SECONDS ?? 120);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Entry point called by the geofence-events route.
 * 1. Persist the raw event (audit trail, always happens).
 * 2. Ignore it if it's a jittery duplicate of the last event for this location+type.
 * 3. EXIT  -> open a new trip ("departure").
 *    ENTER -> close the most recent open trip ("arrival"), then notify guardians.
 */
export async function handleGeofenceEvent(
  userId: string,
  deviceId: string,
  input: GeofenceEventInput
) {
  const locationResult = await pool.query<LocationRow>(
    `SELECT * FROM locations WHERE id = $1 AND user_id = $2`,
    [input.locationId, userId]
  );
  const location = locationResult.rows[0];
  if (!location) {
    throw new HttpError(404, "Unknown location for this user");
  }

  // 1. Always record the raw event for audit/debugging purposes.
  const eventInsert = await pool.query(
    `INSERT INTO geofence_events
       (user_id, device_id, location_id, event_type, event_time, latitude, longitude, accuracy_meters, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      userId,
      deviceId,
      input.locationId,
      input.eventType,
      input.eventTime,
      input.latitude ?? null,
      input.longitude ?? null,
      input.accuracyMeters ?? null,
      JSON.stringify(input),
    ]
  );

  // 2. Debounce: ignore if an identical event for this location fired very recently.
  const recent = await pool.query(
    `SELECT event_time FROM geofence_events
     WHERE user_id = $1 AND location_id = $2 AND event_type = $3 AND id <> $4
     ORDER BY event_time DESC LIMIT 1`,
    [userId, input.locationId, input.eventType, eventInsert.rows[0].id]
  );
  if (recent.rowCount && recent.rowCount > 0) {
    const secondsSinceLast =
      (new Date(input.eventTime).getTime() - new Date(recent.rows[0].event_time).getTime()) / 1000;
    if (secondsSinceLast < DEBOUNCE_SECONDS) {
      return { debounced: true as const };
    }
  }

  if (input.eventType === "EXIT") {
    return handleExit(userId, location, input.eventTime);
  }
  return handleEnter(userId, deviceId, location, input.eventTime);
}

async function handleExit(userId: string, location: LocationRow, eventTime: string) {
  // Close out any stale in-progress trip first (defensive: avoids two open trips).
  await pool.query(
    `UPDATE trips SET status = 'ABANDONED', updated_at = now()
     WHERE user_id = $1 AND status = 'IN_PROGRESS'`,
    [userId]
  );

  const { rows } = await pool.query(
    `INSERT INTO trips (user_id, departure_location_id, departure_time, status)
     VALUES ($1, $2, $3, 'IN_PROGRESS')
     RETURNING id`,
    [userId, location.id, eventTime]
  );

  return { debounced: false as const, kind: "DEPARTURE" as const, tripId: rows[0].id };
}


async function handleEnter(
  userId: string,
  deviceId: string,
  location: LocationRow,
  eventTime: string
) {
  const openTrip = await pool.query(
    `SELECT id, departure_time FROM trips
     WHERE user_id = $1 AND status = 'IN_PROGRESS'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  let tripId: string;
  let durationSeconds: number | null = null;

  if (openTrip.rowCount && openTrip.rowCount > 0) {
    tripId = openTrip.rows[0].id;
    const departureTime = openTrip.rows[0].departure_time as string | null;

    if (departureTime) {
      durationSeconds = Math.round(
        (new Date(eventTime).getTime() -
          new Date(departureTime).getTime()) / 1000
      );
    }

    await pool.query(
      `UPDATE trips
       SET arrival_location_id = $1, arrival_time = $2,
           duration_seconds = $3, status = 'COMPLETED',
           updated_at = now()
       WHERE id = $4`,
      [location.id, eventTime, durationSeconds, tripId]
    );
  } else {
    const { rows } = await pool.query(
      `INSERT INTO trips
       (user_id, arrival_location_id, arrival_time, status)
       VALUES ($1, $2, $3, 'COMPLETED')
       RETURNING id`,
      [userId, location.id, eventTime]
    );

    tripId = rows[0].id;
  }

  // Send FCM to the Android device that reported this event.
  try {
    const result = await pool.query(
      `SELECT fcm_token FROM devices
       WHERE id = $1 AND user_id = $2`,
      [deviceId, userId]
    );

    const fcmToken = result.rows[0]?.fcm_token;

    if (fcmToken && admin.apps.length > 0) {
      await admin.messaging().send({
        token: fcmToken,
        data: {
          event: "TRIP_COMPLETED",
          tripId: String(tripId),
          locationName: location.name,
          eventTime: String(eventTime),
        },
        android: {
          priority: "high",
        },
      });

      console.log("Trip completion FCM sent", { tripId });
    } else {
      console.warn("FCM not sent: token missing or Firebase Admin not initialized");
    }
  } catch (error) {
    // Keep the saved trip successful even if push delivery fails.
    console.error("Failed to send trip completion FCM", error);
  }

  const notifications = await notifyGuardians(
    userId, tripId, location, eventTime
  );

  return {
    debounced: false as const,
    kind: "ARRIVAL" as const,
    tripId,
    durationSeconds,
    notifications,
  };
}


async function notifyGuardians(
  userId: string,
  tripId: string,
  location: LocationRow,
  eventTime: string
) {
  const guardians = await pool.query(
    `SELECT id, phone_number FROM guardians WHERE user_id = $1 AND notify_on_enter = true`,
    [userId]
  );

  const message = `Reached ${location.name} at ${formatTime(eventTime)}.`;

  const results = [];
  for (const guardian of guardians.rows) {
    const result = await sendSms({
      tripId,
      guardianId: guardian.id,
      toPhoneNumber: guardian.phone_number,
      message,
    });
    results.push({ guardianId: guardian.id, ...result });
  }
  return results;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
