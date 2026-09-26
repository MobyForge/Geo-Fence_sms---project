package com.example.smartarrival.geofence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import java.time.Instant

/**
 * Registered in AndroidManifest.xml. The OS delivers this even if the app process
 * was killed, as long as the device is on and location services are enabled.
 * We do the minimum here and hand off to WorkManager, because a BroadcastReceiver
 * only gets a few seconds of execution time — not enough to reliably make a network call.
 */
class GeofenceBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent) ?: return

        if (geofencingEvent.hasError()) {
            // Log/report geofencingEvent.errorCode; nothing more to do.
            return
        }

        val transitionType = geofencingEvent.geofenceTransition
        val eventType = when (transitionType) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> "ENTER"
            Geofence.GEOFENCE_TRANSITION_EXIT -> "EXIT"
            else -> return // ignore DWELL etc. — not used in V1
        }

        val triggeringLocationId = geofencingEvent.triggeringGeofences?.firstOrNull()?.requestId ?: return
        val loc = geofencingEvent.triggeringLocation

        val inputData = Data.Builder()
            .putString("locationId", triggeringLocationId)
            .putString("eventType", eventType)
            .putString("eventTime", Instant.now().toString())
            .apply {
                loc?.let {
                    putDouble("latitude", it.latitude)
                    putDouble("longitude", it.longitude)
                    putFloat("accuracyMeters", it.accuracy)
                }
            }
            .build()

        // Constraints (network required, exponential backoff) are set on the WorkRequest
        // itself in SyncGeofenceEventWorker's companion object usage — see that file.
        val workRequest = OneTimeWorkRequestBuilder<SyncGeofenceEventWorker>()
            .setInputData(inputData)
            .build()

        WorkManager.getInstance(context).enqueue(workRequest)
    }
}
