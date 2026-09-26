package com.example.smartarrival.geofence

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.example.smartarrival.network.LocationDto
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices

/**
 * Wraps the Play Services GeofencingClient. Called once at app start (and whenever
 * the user edits their Home/College locations) to (re)register geofences with the OS.
 * After this, Android itself watches the geofences — no polling, no foreground
 * service needed just for detection.
 */
class GeofenceHelper(private val context: Context) {

    private val geofencingClient: GeofencingClient = LocationServices.getGeofencingClient(context)

    private val geofencePendingIntent: PendingIntent by lazy {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
    }

    fun registerGeofences(locations: List<LocationDto>) {
        if (!hasLocationPermission()) return

        val geofences = locations.map { loc ->
            Geofence.Builder()
                .setRequestId(loc.id) // location_id doubles as the geofence request id
                .setCircularRegion(loc.latitude, loc.longitude, loc.radiusMeters.toFloat())
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                // Requires the device to stay inside/outside for a short window,
                // which filters out a lot of GPS jitter before it ever reaches the backend.
                .setLoiteringDelay(30_000)
                .build()
        }

        if (geofences.isEmpty()) return

        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofences)
            .build()

        geofencingClient.addGeofences(request, geofencePendingIntent)
            .addOnSuccessListener {
                // Geofences registered; the OS will now call GeofenceBroadcastReceiver
                // on ENTER/EXIT even if the app is killed.
            }
            .addOnFailureListener {
                // Common causes: missing ACCESS_BACKGROUND_LOCATION, or >100 geofences.
            }
    }

    fun removeAllGeofences() {
        geofencingClient.removeGeofences(geofencePendingIntent)
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.ACCESS_FINE_LOCATION
        )
        val background = ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )
        return fine == android.content.pm.PackageManager.PERMISSION_GRANTED &&
            background == android.content.pm.PackageManager.PERMISSION_GRANTED
    }
}
