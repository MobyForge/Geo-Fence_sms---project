package com.example.smartarrival.network

import com.google.gson.annotations.SerializedName

data class LocationDto(
    val id: String,
    val name: String,
    val type: String,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("radius_meters") val radiusMeters: Int
)

data class GeofenceEventRequest(
    val locationId: String,
    val eventType: String, // "ENTER" | "EXIT"
    val eventTime: String, // ISO-8601, e.g. Instant.now().toString()
    val latitude: Double?,
    val longitude: Double?,
    val accuracyMeters: Float?
)
