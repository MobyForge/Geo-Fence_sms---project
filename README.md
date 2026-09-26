# Smart Location-Based Safety & Arrival System — V1

Automatically detects when you leave Home and arrive at College, then texts your
mother "Reached college at 8:42 AM." — no manual message required.

## Architecture

```
┌─────────────────────┐        HTTPS (device-authenticated)        ┌──────────────────────┐
│   Android App        │ ───────────────────────────────────────▶  │  Node.js/TS Backend    │
│                      │                                            │                       │
│ Play Services        │  POST /api/v1/geofence-events              │  Express API           │
│ Geofencing API       │  GET  /api/v1/locations                    │  ├─ deviceAuth          │
│  ↓ ENTER/EXIT        │                                            │  ├─ trip.service        │
│ BroadcastReceiver     │                                            │  │    (state machine)   │
│  ↓                   │                                            │  └─ sms.service         │
│ WorkManager           │                                            │        ↓                │
│  (retry + backoff)    │                                            │      Twilio SMS API      │
└─────────────────────┘                                            └───────────┬──────────┘
                                                                                 ▼
                                                                         PostgreSQL
                                                              users / devices / locations
                                                              geofence_events / trips
                                                              guardians / notifications
```

## How a trip is detected

1. Phone's OS-level geofence (registered once, survives app kill) fires `EXIT` on
   the Home region → `GeofenceBroadcastReceiver` → `WorkManager` job →
   `POST /api/v1/geofence-events`.
2. Backend's `trip.service` opens a new row in `trips` with `departure_time` and
   `status = IN_PROGRESS`.
3. Later, the College geofence fires `ENTER` → same POST, different `eventType`.
4. Backend finds the open trip, fills in `arrival_time`, computes
   `duration_seconds`, marks it `COMPLETED`, and sends the SMS via `sms.service`.
5. Every attempt — success or failure — is logged in `notifications` so delivery
   can be audited or retried.

Debouncing (`EVENT_DEBOUNCE_SECONDS`, default 120s) plus the geofence's own
30-second loitering delay absorb GPS jitter near a boundary, so you don't get
double SMS from wobbling in and out of a radius.

## Backend setup

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL and Twilio credentials
npm install
npm run migrate             # applies migrations/001_init.sql
npm run dev                 # http://localhost:3000
```

Seed one user/device/guardian manually for V1 (no admin UI yet):

```sql
INSERT INTO users (id, name, phone_number) VALUES (gen_random_uuid(), 'You', '+91...');
-- take the returned user id for the rows below
INSERT INTO guardians (user_id, name, phone_number, notify_on_enter)
  VALUES ('<user_id>', 'Mom', '+91...', true);
INSERT INTO devices (user_id, device_identifier, api_key_hash)
  VALUES ('<user_id>', '<any-unique-string>', encode(digest('<choose-a-raw-api-key>', 'sha256'), 'hex'));
```
Give the Android app that same `device_identifier` and raw `api_key` at
registration time (`DeviceCredentials`).

Then create the two geofences via `POST /api/v1/locations`:

```json
{ "name": "Home", "type": "HOME", "latitude": 12.9716, "longitude": 77.5946, "radiusMeters": 150 }
{ "name": "College", "type": "COLLEGE", "latitude": 12.9352, "longitude": 77.6245, "radiusMeters": 200 }
```

## Android app

Key files under `android/app/src/main/java/com/example/smartarrival/`:

| File | Responsibility |
|---|---|
| `geofence/GeofenceHelper.kt` | Fetches locations from the backend, registers OS geofences |
| `geofence/GeofenceBroadcastReceiver.kt` | Woken by the OS on ENTER/EXIT, even if app is killed |
| `geofence/SyncGeofenceEventWorker.kt` | Reliable, retrying delivery of the event to the backend |
| `network/ApiClient.kt` | Retrofit client with device-auth headers |
| `auth/DeviceCredentials.kt` | Encrypted storage of device_id/api_key |

Required manifest permissions and receivers are in `AndroidManifest.xml`.
On first run, the app must:
1. Request `ACCESS_FINE_LOCATION`, then separately `ACCESS_BACKGROUND_LOCATION`
   (Android 10+ requires this as a second prompt).
2. Prompt the user to disable battery optimization for the app (many OEMs kill
   background processes aggressively, which can suppress geofence callbacks).
3. Call `GeofenceHelper.registerGeofences()` after fetching `/api/v1/locations`.

## What V1 deliberately does NOT do
- No live location tracking/polling — geofences only, which is far better for
  battery life.
- No multi-user / family accounts beyond one traveler + N guardians.
- No retry queue beyond WorkManager's own backoff and the `notifications` audit
  log (a cron-based "resend failed SMS" job is an easy V1.5 addition).
- No push notifications to the guardian's phone (SMS only, as specified).

## Natural V2 extensions
- Push notification to the mother's own app instead of (or in addition to) SMS.
- ETA prediction while en route (share live progress, not just start/end).
- Multiple named stops beyond Home/College (gym, tuition, etc.) — schema already
  supports arbitrary `locations` rows, just the `UNIQUE(user_id, type)` constraint
  would need loosening to `OTHER` with a free-text label.
- "Did not arrive within expected time" safety alert — a scheduled job comparing
  average trip duration against a trip still `IN_PROGRESS`.
