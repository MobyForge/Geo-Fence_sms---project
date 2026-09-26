package com.example.smartarrival.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Stores the deviceId + apiKey issued by the backend's device-registration endpoint.
 * Uses EncryptedSharedPreferences so the raw API key never sits in plaintext on disk.
 */
class DeviceCredentials(context: Context) {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "device_credentials",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var deviceId: String?
        get() = prefs.getString("device_id", null)
        set(value) = prefs.edit().putString("device_id", value).apply()

    var apiKey: String?
        get() = prefs.getString("api_key", null)
        set(value) = prefs.edit().putString("api_key", value).apply()

    val isRegistered: Boolean
        get() = deviceId != null && apiKey != null
}
