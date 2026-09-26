import { Router } from "express";
import { z } from "zod";
import { deviceAuth } from "../middleware/deviceAuth";
import { handleGeofenceEvent, HttpError } from "../services/trip.service";

const router = Router();

const bodySchema = z.object({
  locationId: z.string().uuid(),
  eventType: z.enum(["ENTER", "EXIT"]),
  eventTime: z.string().datetime(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyMeters: z.number().optional(),
});

router.post("/", deviceAuth, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const result = await handleGeofenceEvent(req.device!.userId, req.device!.deviceId, parsed.data);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Unhandled error processing geofence event", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
