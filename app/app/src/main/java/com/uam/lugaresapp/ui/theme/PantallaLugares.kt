package com.uam.lugaresapp.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.uam.lugaresapp.data.ApiClient
import com.uam.lugaresapp.data.Lugar
import com.uam.lugaresapp.data.Sesion
import com.uam.lugaresapp.data.mensajeError
import kotlinx.coroutines.launch
import retrofit2.HttpException

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PantallaLugares(onCerrarSesion: () -> Unit) {
    val scope = rememberCoroutineScope()
    var lugares by remember { mutableStateOf<List<Lugar>>(emptyList()) }
    var cargando by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var mostrarForm by remember { mutableStateOf(false) }
    var editando by remember { mutableStateOf<Lugar?>(null) }
    var errorForm by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }
    var aBorrar by remember { mutableStateOf<Lugar?>(null) }

    // Token caducado o alterado (401): se cierra la sesión y se vuelve al login
    fun manejar(e: Exception): String? {
        if (e is HttpException && e.code() == 401) {
            Sesion.cerrar()
            onCerrarSesion()
            return null
        }
        return mensajeError(e)
    }

    fun cargar() {
        scope.launch {
            cargando = true
            error = null
            try {
                lugares = ApiClient.api.lugares()
            } catch (e: Exception) {
                error = manejar(e)
            }
            cargando = false
        }
    }

    LaunchedEffect(Unit) { cargar() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Lugares") },
                actions = {
                    TextButton(onClick = {
                        Sesion.cerrar()
                        onCerrarSesion()
                    }) { Text("Salir") }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                editando = null
                errorForm = null
                mostrarForm = true
            }) { Text("+") }
        }
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when {
                cargando -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                error != null -> Column(
                    Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(error ?: "", color = MaterialTheme.colorScheme.error)
                    Button(onClick = { cargar() }) { Text("Reintentar") }
                }
                lugares.isEmpty() -> Text(
                    "No hay lugares todavía. Toca + para agregar uno.",
                    Modifier.align(Alignment.Center).padding(24.dp)
                )
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(lugares, key = { it.id ?: 0 }) { lugar ->
                        Card(Modifier.fillMaxWidth()) {
                            Row(
                                Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(lugar.nombre, style = MaterialTheme.typography.titleMedium)
                                    Text("Edificio ${lugar.edificio} · Piso ${lugar.piso}")
                                    if (lugar.descripcion.isNotBlank()) Text(lugar.descripcion)
                                }
                                TextButton(onClick = {
                                    editando = lugar
                                    errorForm = null
                                    mostrarForm = true
                                }) { Text("Editar") }
                                TextButton(onClick = { aBorrar = lugar }) { Text("Borrar") }
                            }
                        }
                    }
                }
            }
        }
    }

    if (mostrarForm) {
        FormularioLugar(
            inicial = editando,
            errorServidor = errorForm,
            guardando = guardando,
            onCancelar = { mostrarForm = false },
            onGuardar = { lugar ->
                scope.launch {
                    guardando = true
                    errorForm = null
                    try {
                        val id = editando?.id
                        if (id == null) ApiClient.api.crear(lugar)
                        else ApiClient.api.actualizar(id, lugar)
                        mostrarForm = false
                        cargar()
                    } catch (e: Exception) {
                        errorForm = manejar(e)
                    }
                    guardando = false
                }
            }
        )
    }

    aBorrar?.let { lugar ->
        AlertDialog(
            onDismissRequest = { aBorrar = null },
            title = { Text("Borrar lugar") },
            text = { Text("¿Borrar \"${lugar.nombre}\"?") },
            confirmButton = {
                Button(onClick = {
                    aBorrar = null
                    scope.launch {
                        try {
                            ApiClient.api.borrar(lugar.id ?: return@launch)
                            cargar()
                        } catch (e: Exception) {
                            error = manejar(e)
                        }
                    }
                }) { Text("Borrar") }
            },
            dismissButton = { TextButton(onClick = { aBorrar = null }) { Text("Cancelar") } }
        )
    }
}

@Composable
fun FormularioLugar(
    inicial: Lugar?,
    errorServidor: String?,
    guardando: Boolean,
    onGuardar: (Lugar) -> Unit,
    onCancelar: () -> Unit
) {
    var nombre by remember { mutableStateOf(inicial?.nombre ?: "") }
    var edificio by remember { mutableStateOf(inicial?.edificio ?: "") }
    var piso by remember { mutableStateOf(inicial?.piso?.toString() ?: "") }
    var descripcion by remember { mutableStateOf(inicial?.descripcion ?: "") }
    var errorLocal by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onCancelar,
        title = { Text(if (inicial == null) "Nuevo lugar" else "Editar lugar") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = nombre, onValueChange = { nombre = it },
                    label = { Text("Nombre") }, singleLine = true
                )
                OutlinedTextField(
                    value = edificio, onValueChange = { edificio = it },
                    label = { Text("Edificio") }, singleLine = true
                )
                OutlinedTextField(
                    value = piso, onValueChange = { piso = it },
                    label = { Text("Piso") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                OutlinedTextField(
                    value = descripcion, onValueChange = { descripcion = it },
                    label = { Text("Descripción (opcional)") }
                )
                (errorLocal ?: errorServidor)?.let {
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !guardando,
                onClick = {
                    val p = piso.trim().toIntOrNull()
                    when {
                        nombre.isBlank() -> errorLocal = "El nombre es obligatorio"
                        edificio.isBlank() -> errorLocal = "El edificio es obligatorio"
                        p == null -> errorLocal = "El piso debe ser un número entero"
                        else -> {
                            errorLocal = null
                            onGuardar(Lugar(inicial?.id, nombre.trim(), edificio.trim(), p, descripcion))
                        }
                    }
                }
            ) { Text("Guardar") }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } }
    )
}