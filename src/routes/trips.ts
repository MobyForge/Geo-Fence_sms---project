import { Router } from "express";
import { deviceAuth } from "../middleware/deviceAuth";
import { pool } from "../db/pool";

const router = Router();

// GET /api/v1/trips?limit=20 — most recent trips for the authenticated device's user
router.get("/", deviceAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const { rows } = await pool.query(
    `SELECT
        t.id, t.status, t.departure_time, t.arrival_time, t.duration_seconds,
        dep.name AS departure_location, arr.name AS arrival_location
     FROM trips t
     LEFT JOIN locations dep ON dep.id = t.departure_location_id
     LEFT JOIN locations arr ON arr.id = t.arrival_location_id
     WHERE t.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2`,
    [req.device!.userId, limit]
  );

  res.json(rows);
});

// GET /api/v1/trips/:id — single trip plus its notification attempts
router.get("/:id", deviceAuth, async (req, res) => {
  const tripResult = await pool.query(
    `SELECT * FROM trips WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.device!.userId]
  );
  const trip = tripResult.rows[0];
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  const notifications = await pool.query(
    `SELECT id, recipient_phone, status, sent_at, error_message FROM notifications WHERE trip_id = $1`,
    [trip.id]
  );

  res.json({ ...trip, notifications: notifications.rows });
});

export default router;
