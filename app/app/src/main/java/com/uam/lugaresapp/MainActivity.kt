package com.uam.lugaresapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.uam.lugaresapp.data.ApiClient
import com.uam.lugaresapp.data.Credenciales
import com.uam.lugaresapp.data.Sesion
import com.uam.lugaresapp.ui.theme.LugaresAppTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Sesion.iniciar(this)
        setContent {
            LugaresAppTheme {
                Surface(Modifier.fillMaxSize()) { PruebaConexion() }
            }
        }
    }
}

@Composable
fun PruebaConexion() {
    val scope = rememberCoroutineScope()
    var resultado by remember { mutableStateOf("Sin probar") }
    Column(
        Modifier.statusBarsPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Prueba de conexión a la API")
        Button(onClick = {
            scope.launch {
                resultado = "Cargando..."
                resultado = try {
                    val r = ApiClient.api.login(Credenciales("a@b.com", "12345678"))
                    Sesion.guardar(r.token)
                    "Conexión OK. Token: ${r.token.take(20)}..."
                } catch (e: Exception) {
                    "Error: ${e.message}"
                }
            }
        }) { Text("Probar login") }
        Text(resultado)
    }
}