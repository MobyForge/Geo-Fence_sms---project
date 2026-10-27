import "dotenv/config";
import deviceTokenRouter from "./routes/deviceToken";
import express from "express";
import deviceTokenRouter from "./routes/deviceToken";
import geofenceEventsRouter from "./routes/geofenceEvents";
import tripsRouter from "./routes/trips";
import locationsRouter from "./routes/locations";
app.use("/api/v1/geofence-events", geofenceEventsRouter);
app.use("/api/v1/trips", tripsRouter);
app.use("/api/v1/locations", locationsRouter);
app.use("/api/v1/device-token", deviceTokenRouter);
const app = express();
app.use(express.json());
app.use("/api/v1/device-token", deviceTokenRouter);
app.use("/api/v1/device-token", deviceTokenRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/v1/geofence-events", geofenceEventsRouter);
app.use("/api/v1/trips", tripsRouter);
app.use("/api/v1/locations", locationsRouter);

// Central error handler as a final safety net.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Smart Arrival backend listening on port ${port}`);
});
