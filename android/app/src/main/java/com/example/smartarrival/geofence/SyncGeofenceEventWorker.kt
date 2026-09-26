package com.example.smartarrival.geofence

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.smartarrival.auth.DeviceCredentials
import com.example.smartarrival.network.ApiClient
import com.example.smartarrival.network.GeofenceEventRequest

/**
 * Runs outside the BroadcastReceiver's short execution window. WorkManager persists
 * this request to disk, so it survives process death and will retry (with backoff)
 * until it succeeds — e.g. if the phone entered college with no signal yet.
 */
class SyncGeofenceEventWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val locationId = inputData.getString("locationId") ?: return Result.failure()
        val eventType = inputData.getString("eventType") ?: return Result.failure()
        val eventTime = inputData.getString("eventTime") ?: return Result.failure()
        val latitude = if (inputData.hasKeyWithValueOfType("latitude", Double::class.java))
            inputData.getDouble("latitude", 0.0) else null
        val longitude = if (inputData.hasKeyWithValueOfType("longitude", Double::class.java))
            inputData.getDouble("longitude", 0.0) else null
        val accuracy = if (inputData.hasKeyWithValueOfType("accuracyMeters", Float::class.java))
            inputData.getFloat("accuracyMeters", 0f) else null

        val credentials = DeviceCredentials(applicationContext)
        val api = ApiClient.create({ credentials.deviceId }, { credentials.apiKey })

        return try {
            val response = api.postGeofenceEvent(
                GeofenceEventRequest(locationId, eventType, eventTime, latitude, longitude, accuracy)
            )
            if (response.isSuccessful) Result.success() else Result.retry()
        } catch (e: Exception) {
            // Network unreachable, DNS failure, etc. — WorkManager will retry with backoff.
            Result.retry()
        }
    }
}
