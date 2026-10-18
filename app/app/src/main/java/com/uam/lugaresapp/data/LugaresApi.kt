package com.uam.lugaresapp.data

import retrofit2.http.*

interface LugaresApi {
    @POST("registro") suspend fun registro(@Body c: Credenciales): UsuarioRespuesta
    @POST("login") suspend fun login(@Body c: Credenciales): TokenRespuesta
    @GET("lugares") suspend fun lugares(): List<Lugar>
    @GET("lugares/{id}") suspend fun lugar(@Path("id") id: Int): Lugar
    @POST("lugares") suspend fun crear(@Body l: Lugar): Lugar
    @PUT("lugares/{id}") suspend fun actualizar(@Path("id") id: Int, @Body l: Lugar): Lugar
    @DELETE("lugares/{id}") suspend fun borrar(@Path("id") id: Int): MensajeRespuesta
}