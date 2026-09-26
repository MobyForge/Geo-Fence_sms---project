export type LocationType = "HOME" | "COLLEGE" | "WORK" | "OTHER";
export type GeofenceEventType = "ENTER" | "EXIT";
export type TripStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface AuthenticatedDevice {
  deviceId: string;
  userId: string;
}

export interface GeofenceEventInput {
  locationId: string;
  eventType: GeofenceEventType;
  eventTime: string; // ISO 8601, set by the phone at the moment of the transition
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}

export interface LocationRow {
  id: string;
  user_id: string;
  name: string;
  type: LocationType;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export interface TripRow {
  id: string;
  user_id: string;
  departure_location_id: string | null;
  departure_time: string | null;
  arrival_location_id: string | null;
  arrival_time: string | null;
  duration_seconds: number | null;
  status: TripStatus;
}
