package com.uam.lugaresapp.data

import com.google.gson.JsonParser
import retrofit2.HttpException
import java.io.IOException

fun mensajeError(e: Exception): String = when (e) {
    is HttpException -> try {
        JsonParser.parseString(e.response()?.errorBody()?.string() ?: "")
            .asJsonObject.get("error").asString
    } catch (x: Exception) {
        "Error ${e.code()}"
    }
    is IOException -> "No se pudo conectar con el servidor"
    else -> e.message ?: "Error desconocido"
}