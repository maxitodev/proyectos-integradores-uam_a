package com.uam.lugaresapp.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.automirrored.rounded.Notes
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AddLocationAlt
import androidx.compose.material.icons.rounded.Apartment
import androidx.compose.material.icons.rounded.ArrowOutward
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Layers
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SearchOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedAssistChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.uam.lugaresapp.R
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
    var busqueda by remember { mutableStateOf("") }
    var edificioActivo by remember { mutableStateOf<String?>(null) }
    var formularioVisible by remember { mutableStateOf(false) }
    var lugarEnEdicion by remember { mutableStateOf<Lugar?>(null) }
    var guardando by remember { mutableStateOf(false) }
    var errorFormulario by remember { mutableStateOf<String?>(null) }
    var porBorrar by remember { mutableStateOf<Lugar?>(null) }
    var confirmarSalida by remember { mutableStateOf(false) }

    fun resolverError(e: Exception): String? {
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
                error = resolverError(e)
            } finally {
                cargando = false
            }
        }
    }
    fun guardar(lugar: Lugar) {
        scope.launch {
            guardando = true
            errorFormulario = null
            try {
                if (lugar.id == null) ApiClient.api.crear(lugar)
                else ApiClient.api.actualizar(lugar.id, lugar)
                formularioVisible = false
                cargar()
            } catch (e: Exception) {
                errorFormulario = resolverError(e)
            } finally {
                guardando = false
            }
        }
    }
    fun borrar(lugar: Lugar) {
        scope.launch {
            try {
                lugar.id?.let { ApiClient.api.borrar(it) }
                porBorrar = null
                cargar()
            } catch (e: Exception) {
                error = resolverError(e)
                porBorrar = null
            }
        }
    }

    LaunchedEffect(Unit) { cargar() }
    val edificios = remember(lugares) { lugares.map { it.edificio.trim() }.filter { it.isNotBlank() }.distinct().sorted() }
    val visibles = remember(lugares, busqueda, edificioActivo) {
        lugares.filter { lugar ->
            val texto = busqueda.trim()
            (texto.isBlank() || listOf(lugar.nombre, lugar.edificio, lugar.descripcion, lugar.piso.toString())
                .any { it.contains(texto, ignoreCase = true) }) &&
                (edificioActivo == null || lugar.edificio.equals(edificioActivo, ignoreCase = true))
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { MarcaUamCuajimalpa(compacta = true, detalle = "Directorio de espacios") },
                actions = {
                    IconButton(onClick = ::cargar, enabled = !cargando) {
                        Icon(Icons.Rounded.Refresh, "Actualizar espacios")
                    }
                    IconButton(onClick = { confirmarSalida = true }) {
                        Icon(Icons.AutoMirrored.Rounded.Logout, "Cerrar sesión", tint = MaterialTheme.colorScheme.error)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { lugarEnEdicion = null; errorFormulario = null; formularioVisible = true },
                icon = { Icon(Icons.Rounded.AddLocationAlt, null) },
                text = { Text("Nuevo espacio", fontWeight = FontWeight.Bold) },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = padding.calculateTopPadding() + 8.dp, bottom = 98.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                CampusHero(
                    titulo = "Encuentra el lugar indicado.",
                    subtitulo = "${lugares.size} espacios registrados · Torre Cuajimalpa",
                    imagen = R.drawable.campus_plaza
                )
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    CampusSectionTag("Explora el campus")
                    Text("Directorio de espacios", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = busqueda,
                        onValueChange = { busqueda = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Rounded.Search, null) },
                        label = { Text("Buscar aula, piso o edificio") },
                        shape = RoundedCornerShape(16.dp)
                    )
                }
            }
            if (edificios.isNotEmpty()) {
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            FilterChip(
                                selected = edificioActivo == null,
                                onClick = { edificioActivo = null },
                                label = { Text("Todos · ${lugares.size}") }
                            )
                        }
                        items(edificios) { edificio ->
                            FilterChip(
                                selected = edificioActivo.equals(edificio, ignoreCase = true),
                                onClick = { edificioActivo = if (edificioActivo.equals(edificio, true)) null else edificio },
                                label = { Text(edificio) },
                                leadingIcon = { Icon(Icons.Rounded.Apartment, null, Modifier.size(16.dp)) }
                            )
                        }
                    }
                }
            }
            when {
                cargando -> item {
                    CargandoEspacios()
                }
                error != null -> item {
                    EstadoError(error.orEmpty(), onReintentar = ::cargar)
                }
                lugares.isEmpty() -> item {
                    EstadoVacio(onCrear = { lugarEnEdicion = null; formularioVisible = true })
                }
                visibles.isEmpty() -> item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 42.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Rounded.SearchOff, null, modifier = Modifier.size(44.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("No encontramos coincidencias", fontWeight = FontWeight.Bold)
                        Text("Prueba con otro nombre, piso o edificio.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                else -> {
                    item {
                        Text("${visibles.size} resultado${if (visibles.size == 1) "" else "s"}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    items(visibles, key = { it.id ?: "${it.nombre}-${it.edificio}-${it.piso}" }) { lugar ->
                        TarjetaLugar(
                            lugar = lugar,
                            onEditar = { lugarEnEdicion = lugar; errorFormulario = null; formularioVisible = true },
                            onBorrar = { porBorrar = lugar }
                        )
                    }
                }
            }
        }
    }

    if (formularioVisible) {
        FormularioLugar(
            inicial = lugarEnEdicion,
            errorServidor = errorFormulario,
            guardando = guardando,
            onGuardar = ::guardar,
            onCancelar = { formularioVisible = false; errorFormulario = null }
        )
    }
    porBorrar?.let { lugar ->
        AlertDialog(
            onDismissRequest = { porBorrar = null },
            icon = { Icon(Icons.Rounded.DeleteOutline, null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("¿Eliminar este espacio?", fontWeight = FontWeight.Bold) },
            text = { Text("${lugar.nombre} se eliminará del directorio.") },
            confirmButton = {
                Button(onClick = { borrar(lugar) }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Eliminar") }
            },
            dismissButton = { TextButton(onClick = { porBorrar = null }) { Text("Cancelar") } },
            shape = RoundedCornerShape(24.dp)
        )
    }
    if (confirmarSalida) {
        AlertDialog(
            onDismissRequest = { confirmarSalida = false },
            title = { Text("¿Cerrar sesión?", fontWeight = FontWeight.Bold) },
            text = { Text("Tendrás que volver a ingresar tus credenciales.") },
            confirmButton = {
                Button(onClick = { Sesion.cerrar(); onCerrarSesion() }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Salir") }
            },
            dismissButton = { TextButton(onClick = { confirmarSalida = false }) { Text("Cancelar") } },
            shape = RoundedCornerShape(24.dp)
        )
    }
}

@Composable
private fun CargandoEspacios() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        Text("Abriendo el directorio…", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun EstadoError(mensaje: String, onReintentar: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier.padding(22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(Icons.Rounded.CloudOff, null, Modifier.size(42.dp), tint = MaterialTheme.colorScheme.error)
            Text("No pudimos abrir el directorio", fontWeight = FontWeight.Bold)
            Text(mensaje, color = MaterialTheme.colorScheme.onErrorContainer)
            Button(onClick = onReintentar) { Text("Intentar de nuevo") }
        }
    }
}

@Composable
private fun EstadoVacio(onCrear: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OncahuiInsignia(88.dp)
        Text("El directorio espera su primer espacio.", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(
            "Registra aulas, laboratorios, cubículos o talleres de la Unidad.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Button(onClick = onCrear) {
            Icon(Icons.Rounded.Add, null)
            Spacer(Modifier.width(7.dp))
            Text("Registrar espacio")
        }
    }
}

@Composable
fun TarjetaLugar(lugar: Lugar, onEditar: () -> Unit, onBorrar: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.padding(18.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Surface(
                    modifier = Modifier.size(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.primary
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Text("PISO", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.ExtraBold, color = Color.White.copy(alpha = .78f), fontSize = 9.sp)
                        Text(lugar.piso.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text(lugar.nombre, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text("${lugar.edificio} · Nivel ${lugar.piso}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 3.dp))
                    if (lugar.descripcion.isNotBlank()) {
                        Text(lugar.descripcion, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 9.dp))
                    }
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .45f))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 11.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                AssistChip(
                    onClick = {},
                    label = { Text("Edificio ${lugar.edificio}") },
                    leadingIcon = { Icon(Icons.Rounded.Place, null, Modifier.size(16.dp)) }
                )
                Row {
                    IconButton(onClick = onEditar) { Icon(Icons.Rounded.Edit, "Editar espacio", tint = MaterialTheme.colorScheme.primary) }
                    IconButton(onClick = onBorrar) { Icon(Icons.Rounded.DeleteOutline, "Eliminar espacio", tint = MaterialTheme.colorScheme.error) }
                }
            }
        }
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
    var nombre by remember(inicial) { mutableStateOf(inicial?.nombre.orEmpty()) }
    var edificio by remember(inicial) { mutableStateOf(inicial?.edificio.orEmpty()) }
    var piso by remember(inicial) { mutableStateOf(inicial?.piso?.toString().orEmpty()) }
    var descripcion by remember(inicial) { mutableStateOf(inicial?.descripcion.orEmpty()) }
    var errorLocal by remember { mutableStateOf<String?>(null) }
    val error = errorLocal ?: errorServidor

    AlertDialog(
        onDismissRequest = onCancelar,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CampusSectionTag(if (inicial == null) "Nuevo espacio" else "Editar espacio")
                Text(if (inicial == null) "Agrega un lugar al campus." else "Actualiza la información.", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(nombre, { nombre = it; errorLocal = null }, Modifier.fillMaxWidth(), label = { Text("Nombre del espacio") }, leadingIcon = { Icon(Icons.Rounded.Place, null) }, singleLine = true, shape = RoundedCornerShape(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(edificio, { edificio = it; errorLocal = null }, Modifier.weight(1f), label = { Text("Edificio") }, singleLine = true, shape = RoundedCornerShape(14.dp))
                    OutlinedTextField(piso, { piso = it; errorLocal = null }, Modifier.weight(.65f), label = { Text("Piso") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = RoundedCornerShape(14.dp))
                }
                OutlinedTextField(descripcion, { descripcion = it }, Modifier.fillMaxWidth(), label = { Text("Descripción") }, leadingIcon = { Icon(Icons.AutoMirrored.Rounded.Notes, null) }, minLines = 2, maxLines = 3, shape = RoundedCornerShape(14.dp))
                if (error != null) {
                    Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(12.dp)) {
                        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.ErrorOutline, null, tint = MaterialTheme.colorScheme.error)
                            Text(error, Modifier.padding(start = 8.dp), color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val nivel = piso.trim().toIntOrNull()
                    when {
                        nombre.isBlank() -> errorLocal = "Escribe el nombre del espacio."
                        edificio.isBlank() -> errorLocal = "Indica el edificio."
                        nivel == null -> errorLocal = "El piso debe ser un número."
                        else -> onGuardar(Lugar(inicial?.id, nombre.trim(), edificio.trim(), nivel, descripcion.trim()))
                    }
                },
                enabled = !guardando
            ) {
                if (guardando) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                else Text(if (inicial == null) "Guardar espacio" else "Guardar cambios")
            }
        },
        dismissButton = { TextButton(onClick = onCancelar) { Text("Cancelar") } },
        shape = RoundedCornerShape(26.dp)
    )
}
