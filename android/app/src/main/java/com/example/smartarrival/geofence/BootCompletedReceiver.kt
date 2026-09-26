package com.example.smartarrival.geofence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

/**
 * Android clears all registered geofences on reboot, so we must re-register them.
 * Delegates to a worker (rather than doing it inline) so it can wait for network/
 * fetch the latest locations from the backend before calling GeofenceHelper.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val request = OneTimeWorkRequestBuilder<ReRegisterGeofencesWorker>().build()
        WorkManager.getInstance(context).enqueue(request)
    }
}
