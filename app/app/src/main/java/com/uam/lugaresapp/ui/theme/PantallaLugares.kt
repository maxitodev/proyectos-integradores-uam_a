package com.uam.lugaresapp.ui.theme


import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.uam.lugaresapp.data.Sesion

@Composable
fun PantallaLugares(onCerrarSesion: () -> Unit) {
    Column(
        Modifier.fillMaxSize().statusBarsPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Sesión iniciada", style = MaterialTheme.typography.headlineMedium)
        Text("Aquí irá la lista de lugares.")
        Button(onClick = {
            Sesion.cerrar()
            onCerrarSesion()
        }) { Text("Cerrar sesión") }
    }
}