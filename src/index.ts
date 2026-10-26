
import "dotenv/config";
import express from "express";
import admin from "firebase-admin";

import geofenceEventsRouter from "./routes/geofenceEvents";
import tripsRouter from "./routes/trips";
import locationsRouter from "./routes/locations";
import deviceTokenRouter from "./routes/deviceToken";

// Initialize Firebase Admin if credentials are configured.
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    privateKey
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  } else {
    console.warn("Firebase Admin credentials are not configured");
  }
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/v1/geofence-events", geofenceEventsRouter);
app.use("/api/v1/trips", tripsRouter);
app.use("/api/v1/locations", locationsRouter);
app.use("/api/v1/device-token", deviceTokenRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`Smart Arrival backend listening on port ${port}`);
});
