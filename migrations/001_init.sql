-- Smart Location-Based Safety & Arrival System — V1 schema
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- People who move around and are being tracked (e.g. the traveler)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    phone_number    TEXT NOT NULL,              -- traveler's own number (optional use)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- People who should be notified about a user's arrivals/departures (e.g. mother)
CREATE TABLE guardians (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    phone_number    TEXT NOT NULL,               -- E.164 format, e.g. +919876543210
    notify_on_exit  BOOLEAN NOT NULL DEFAULT false,
    notify_on_enter BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per physical Android device, used for authenticating geofence events
CREATE TABLE devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_identifier   TEXT NOT NULL UNIQUE,     -- Android ID / install UUID
    api_key_hash        TEXT NOT NULL,            -- sha256(apiKey), never store raw key
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Named geofenced places: home, college, etc.
CREATE TABLE locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,               -- "Home", "College"
    type            TEXT NOT NULL CHECK (type IN ('HOME', 'COLLEGE', 'WORK', 'OTHER')),
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    radius_meters   INTEGER NOT NULL DEFAULT 150,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, type)
);

-- Raw geofence transitions as reported by the phone. Append-only audit log.
CREATE TABLE geofence_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL CHECK (event_type IN ('ENTER', 'EXIT')),
    event_time      TIMESTAMPTZ NOT NULL,        -- device-reported timestamp
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    accuracy_meters REAL,
    raw_payload     JSONB
);

CREATE INDEX idx_geofence_events_user_time ON geofence_events (user_id, event_time DESC);

-- One row per journey: departure -> arrival
CREATE TABLE trips (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    departure_location_id   UUID REFERENCES locations(id),
    departure_time          TIMESTAMPTZ,
    arrival_location_id     UUID REFERENCES locations(id),
    arrival_time            TIMESTAMPTZ,
    duration_seconds        INTEGER,
    status                  TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                                CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_user_status ON trips (user_id, status);

-- Every SMS attempt, so delivery can be audited/retried
CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             UUID REFERENCES trips(id) ON DELETE CASCADE,
    guardian_id         UUID REFERENCES guardians(id),
    recipient_phone     TEXT NOT NULL,
    message             TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    provider_message_id TEXT,
    error_message       TEXT,
    attempted_at        TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_trip ON notifications (trip_id);
