package com.example.smartarrival.geofence

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.smartarrival.auth.DeviceCredentials
import com.example.smartarrival.network.ApiClient

class ReRegisterGeofencesWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val credentials = DeviceCredentials(applicationContext)
        if (!credentials.isRegistered) return Result.failure()

        val api = ApiClient.create({ credentials.deviceId }, { credentials.apiKey })
        return try {
            val response = api.getLocations()
            val locations = response.body()
            if (response.isSuccessful && locations != null) {
                GeofenceHelper(applicationContext).registerGeofences(locations)
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
