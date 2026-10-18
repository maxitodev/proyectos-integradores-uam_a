package com.uam.lugaresapp.data

import android.content.Context
import android.content.SharedPreferences

object Sesion {
    private var prefs: SharedPreferences? = null
    var token: String? = null
        private set

    fun iniciar(context: Context) {
        prefs = context.getSharedPreferences("sesion", Context.MODE_PRIVATE)
        token = prefs?.getString("token", null)
    }

    fun guardar(t: String) {
        token = t
        prefs?.edit()?.putString("token", t)?.apply()
    }

    fun cerrar() {
        token = null
        prefs?.edit()?.remove("token")?.apply()
    }
}

