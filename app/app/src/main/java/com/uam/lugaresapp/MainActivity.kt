package com.uam.lugaresapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.uam.lugaresapp.data.Sesion
import com.uam.lugaresapp.ui.theme.PantallaLogin
import com.uam.lugaresapp.ui.theme.PantallaLugares
import com.uam.lugaresapp.ui.theme.PantallaRegistro
import com.uam.lugaresapp.ui.theme.LugaresAppTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Sesion.iniciar(this)
        setContent {
            LugaresAppTheme {
                Surface(Modifier.fillMaxSize()) { AppNav() }
            }
        }
    }
}

@Composable
fun AppNav() {
    val nav = rememberNavController()
    val inicio = if (Sesion.token != null) "lugares" else "login"
    NavHost(nav, startDestination = inicio) {
        composable("login") {
            PantallaLogin(
                onLoginOk = { nav.navigate("lugares") { popUpTo("login") { inclusive = true } } },
                onIrRegistro = { nav.navigate("registro") }
            )
        }
        composable("registro") {
            PantallaRegistro(
                onRegistrado = { nav.navigate("lugares") { popUpTo("login") { inclusive = true } } },
                onIrLogin = { nav.popBackStack() }
            )
        }
        composable("lugares") {
            PantallaLugares(
                onCerrarSesion = { nav.navigate("login") { popUpTo("lugares") { inclusive = true } } }
            )
        }
    }
}