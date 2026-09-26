import { Router } from "express";
import { z } from "zod";
import { deviceAuth } from "../middleware/deviceAuth";
import { pool } from "../db/pool";

const router = Router();

const locationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["HOME", "COLLEGE", "WORK", "OTHER"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().positive().max(2000).default(150),
});

// GET /api/v1/locations — the Android app calls this on startup to know which
// geofences to register with the OS.
router.get("/", deviceAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, type, latitude, longitude, radius_meters
     FROM locations WHERE user_id = $1`,
    [req.device!.userId]
  );
  res.json(rows);
});

// POST /api/v1/locations — upsert by (user_id, type) so re-setting "Home" just moves it.
router.post("/", deviceAuth, async (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }
  const { name, type, latitude, longitude, radiusMeters } = parsed.data;

  const { rows } = await pool.query(
    `INSERT INTO locations (user_id, name, type, latitude, longitude, radius_meters)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, type)
     DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude, radius_meters = EXCLUDED.radius_meters
     RETURNING id, name, type, latitude, longitude, radius_meters`,
    [req.device!.userId, name, type, latitude, longitude, radiusMeters]
  );

  res.status(201).json(rows[0]);
});

export default router;
