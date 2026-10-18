package com.uam.lugaresapp.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.uam.lugaresapp.data.ApiClient
import com.uam.lugaresapp.data.Credenciales
import com.uam.lugaresapp.data.Sesion
import com.uam.lugaresapp.data.mensajeError
import kotlinx.coroutines.launch

@Composable
fun PantallaLogin(onLoginOk: () -> Unit, onIrRegistro: () -> Unit) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var cargando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier.fillMaxSize().statusBarsPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Iniciar sesión", style = MaterialTheme.typography.headlineMedium)
        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Correo") }, singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Contraseña") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(
            enabled = !cargando,
            onClick = {
                if (email.isBlank() || password.isBlank()) {
                    error = "Escribe tu correo y contraseña"
                    return@Button
                }
                scope.launch {
                    cargando = true
                    error = null
                    try {
                        val r = ApiClient.api.login(Credenciales(email.trim(), password))
                        Sesion.guardar(r.token)
                        onLoginOk()
                    } catch (e: Exception) {
                        error = mensajeError(e)
                    }
                    cargando = false
                }
            }
        ) {
            if (cargando) CircularProgressIndicator(Modifier.size(20.dp)) else Text("Entrar")
        }
        TextButton(onClick = onIrRegistro) { Text("¿No tienes cuenta? Regístrate") }
    }
}