package com.example.smartarrival.network

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Response as RetrofitResponse
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface ArrivalApi {
    @GET("api/v1/locations")
    suspend fun getLocations(): RetrofitResponse<List<LocationDto>>

    @POST("api/v1/geofence-events")
    suspend fun postGeofenceEvent(@Body body: GeofenceEventRequest): RetrofitResponse<Unit>
}

/**
 * Adds the x-device-id / x-api-key headers to every request.
 * deviceId and apiKey come from DeviceCredentials, which is populated once
 * at first-run registration and then read from EncryptedSharedPreferences.
 */
class DeviceAuthInterceptor(
    private val deviceId: () -> String?,
    private val apiKey: () -> String?
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val builder = chain.request().newBuilder()
        deviceId()?.let { builder.addHeader("x-device-id", it) }
        apiKey()?.let { builder.addHeader("x-api-key", it) }
        return chain.proceed(builder.build())
    }
}

object ApiClient {
    // Replace with your deployed backend URL (must be HTTPS in production).
    private const val BASE_URL = "https://api.your-domain.com/"

    fun create(deviceId: () -> String?, apiKey: () -> String?): ArrivalApi {
        val client = OkHttpClient.Builder()
            .addInterceptor(DeviceAuthInterceptor(deviceId, apiKey))
            .build()

        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ArrivalApi::class.java)
    }
}
