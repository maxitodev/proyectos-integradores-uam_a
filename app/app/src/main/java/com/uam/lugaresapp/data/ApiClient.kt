package com.uam.lugaresapp.data

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClient {
    // Celular: IP local de la computadora (ipconfig). Emulador: http://10.0.2.2:5000/
    const val BASE_URL = "http://localhost:5000/"

    private val http = OkHttpClient.Builder()
        .addInterceptor { chain ->
            val req = chain.request().newBuilder()
            Sesion.token?.let { req.addHeader("Authorization", "Bearer $it") }
            chain.proceed(req.build())
        }
        .build()

    val api: LugaresApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(http)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(LugaresApi::class.java)
    }
}