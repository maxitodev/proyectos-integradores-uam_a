package com.uam.lugaresapp.data

data class Credenciales(val email: String, val password: String)
data class TokenRespuesta(val token: String)
data class UsuarioRespuesta(val id: Int, val email: String)
data class MensajeRespuesta(val mensaje: String)
data class Lugar(
    val id: Int? = null,
    val nombre: String,
    val edificio: String,
    val piso: Int,
    val descripcion: String = ""
)