
import admin from "firebase-admin";
import "dotenv/config";
import express from "express";

import geofenceEventsRouter from "./routes/geofenceEvents";
import tripsRouter from "./routes/trips";
import locationsRouter from "./routes/locations";
import deviceTokenRouter from "./routes/deviceToken";

// Initialize Firebase Admin when credentials are configured.
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log("Firebase Admin initialized");
  } else {
    console.warn("Firebase Admin credentials missing; FCM is disabled");
  }
}

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/geofence-events", geofenceEventsRouter);
app.use("/api/v1/trips", tripsRouter);
app.use("/api/v1/locations", locationsRouter);
app.use("/api/v1/device-token", deviceTokenRouter);

// Central error handler
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
