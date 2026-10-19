package com.uam.lugaresapp.ui.theme

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.automirrored.rounded.Notes
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    var refrescando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var mostrarForm by remember { mutableStateOf(false) }
    var editando by remember { mutableStateOf<Lugar?>(null) }
    var errorForm by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }
    var aBorrar by remember { mutableStateOf<Lugar?>(null) }
    var confirmarCerrarSesion by remember { mutableStateOf(false) }

    // Search and filter states
    var busqueda by remember { mutableStateOf("") }
    var mostrarBuscador by remember { mutableStateOf(false) }
    var filtroEdificioSeleccionado by remember { mutableStateOf<String?>(null) }

    fun manejar(e: Exception): String? {
        if (e is HttpException && e.code() == 401) {
            Sesion.cerrar()
            onCerrarSesion()
            return null
        }
        return mensajeError(e)
    }

    fun cargar(esRefresco: Boolean = false) {
        scope.launch {
            if (esRefresco) refrescando = true else cargando = true
            error = null
            try {
                lugares = ApiClient.api.lugares()
            } catch (e: Exception) {
                error = manejar(e)
            } finally {
                cargando = false
                refrescando = false
            }
        }
    }

    LaunchedEffect(Unit) { cargar() }

    // Filtered list
    val lugaresFiltrados = remember(lugares, busqueda, filtroEdificioSeleccionado) {
        lugares.filter { lugar ->
            val coincideTexto = busqueda.isBlank() ||
                    lugar.nombre.contains(busqueda, ignoreCase = true) ||
                    lugar.edificio.contains(busqueda, ignoreCase = true) ||
                    lugar.descripcion.contains(busqueda, ignoreCase = true) ||
                    lugar.piso.toString().contains(busqueda)

            val coincideEdificio = filtroEdificioSeleccionado == null ||
                    lugar.edificio.equals(filtroEdificioSeleccionado, ignoreCase = true)

            coincideTexto && coincideEdificio
        }
    }

    val edificiosDisponibles = remember(lugares) {
        lugares.map { it.edificio.trim() }.filter { it.isNotBlank() }.distinct().sorted()
    }

    // Refresh icon animation
    val infiniteTransition = rememberInfiniteTransition(label = "refreshAnim")
    val anguloRotacion by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    Brush.linearGradient(
                                        listOf(PrimaryGradientStart, PrimaryGradientEnd)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "UAM-C",
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                color = Color.White,
                                letterSpacing = 0.5.sp
                            )
                        }
                        Column {
                            Text(
                                text = "UAM Cuajimalpa",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${lugares.size} espacios · Torre Cuajimalpa",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                actions = {
                    // Search toggle button
                    IconButton(
                        onClick = {
                            mostrarBuscador = !mostrarBuscador
                            if (!mostrarBuscador) busqueda = ""
                        }
                    ) {
                        Icon(
                            imageVector = if (mostrarBuscador) Icons.Rounded.Close else Icons.Rounded.Search,
                            contentDescription = "Buscar lugares",
                            tint = if (mostrarBuscador) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                        )
                    }

                    // Refresh button
                    IconButton(
                        onClick = { cargar(esRefresco = true) },
                        enabled = !refrescando && !cargando
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Refresh,
                            contentDescription = "Recargar lista",
                            modifier = Modifier.rotate(if (refrescando) anguloRotacion else 0f),
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    // Logout button
                    IconButton(onClick = { confirmarCerrarSesion = true }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.Logout,
                            contentDescription = "Cerrar sesión",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = {
                    editando = null
                    errorForm = null
                    mostrarForm = true
                },
                icon = {
                    Icon(
                        imageVector = Icons.Rounded.AddLocationAlt,
                        contentDescription = null,
                        tint = Color.White
                    )
                },
                text = {
                    Text(
                        "Nuevo Espacio",
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                },
                containerColor = MaterialTheme.colorScheme.primary,
                shape = RoundedCornerShape(20.dp),
                elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Animated Search Input Bar
            AnimatedVisibility(
                visible = mostrarBuscador,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 4.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
                        OutlinedTextField(
                            value = busqueda,
                            onValueChange = { busqueda = it },
                            placeholder = { Text("Buscar en Torre Cuajimalpa (aula, piso, lab)...") },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Rounded.Search,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            },
                            trailingIcon = {
                                if (busqueda.isNotEmpty()) {
                                    IconButton(onClick = { busqueda = "" }) {
                                        Icon(
                                            imageVector = Icons.Rounded.Clear,
                                            contentDescription = "Borrar búsqueda"
                                        )
                                    }
                                }
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            // Building Filter Chips
            if (edificiosDisponibles.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        FilterChip(
                            selected = filtroEdificioSeleccionado == null,
                            onClick = { filtroEdificioSeleccionado = null },
                            label = { Text("Todos (${lugares.size})") },
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                    items(edificiosDisponibles) { edificio ->
                        val count = lugares.count { it.edificio.equals(edificio, ignoreCase = true) }
                        FilterChip(
                            selected = filtroEdificioSeleccionado.equals(edificio, ignoreCase = true),
                            onClick = {
                                filtroEdificioSeleccionado =
                                    if (filtroEdificioSeleccionado.equals(edificio, ignoreCase = true)) null else edificio
                            },
                            label = { Text("Edificio $edificio ($count)") },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Rounded.Apartment,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                            },
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }
            }

            // Main Content Area
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    cargando -> {
                        // Polished Loading State
                        Column(
                            modifier = Modifier.align(Alignment.Center),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            CircularProgressIndicator(
                                strokeWidth = 3.dp,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "Cargando catálogo de espacios...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    error != null -> {
                        // Error State Card
                        Card(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(24.dp)
                                .fillMaxWidth(),
                            shape = RoundedCornerShape(24.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                            )
                        ) {
                            Column(
                                modifier = Modifier.padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.CloudOff,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(48.dp)
                                )
                                Text(
                                    text = "Ocurrió un problema",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                                Text(
                                    text = error ?: "No se pudo conectar al servidor",
                                    style = MaterialTheme.typography.bodyMedium,
                                    textAlign = TextAlign.Center,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                                Button(
                                    onClick = { cargar() },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MaterialTheme.colorScheme.error
                                    ),
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Refresh,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Reintentar")
                                }
                            }
                        }
                    }

                    lugares.isEmpty() -> {
                        // Empty State (No Places Added Yet)
                        Column(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(96.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Map,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(48.dp)
                                )
                            }
                            Text(
                                text = "Espacios de la Unidad Cuajimalpa",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = "Comienza registrando las aulas, laboratorios de docencia, cubículos y talleres de la Torre Cuajimalpa.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    editando = null
                                    errorForm = null
                                    mostrarForm = true
                                },
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Add,
                                    contentDescription = null
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Registrar primer espacio UAM-C")
                            }
                        }
                    }

                    lugaresFiltrados.isEmpty() -> {
                        // Empty Search / Filter State
                        Column(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.SearchOff,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(54.dp)
                            )
                            Text(
                                text = "Sin coincidencias",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "No se encontraron lugares con el filtro actual.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            TextButton(
                                onClick = {
                                    busqueda = ""
                                    filtroEdificioSeleccionado = null
                                }
                            ) {
                                Text("Limpiar filtros")
                            }
                        }
                    }

                    else -> {
                        // Places List with Animations
                        LazyColumn(
                            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 88.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(lugaresFiltrados, key = { it.id ?: it.hashCode() }) { lugar ->
                                TarjetaLugar(
                                    lugar = lugar,
                                    onEditar = {
                                        editando = lugar
                                        errorForm = null
                                        mostrarForm = true
                                    },
                                    onBorrar = { aBorrar = lugar },
                                    modifier = Modifier.animateItem()
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Modal Form for Create / Edit
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
                    } finally {
                        guardando = false
                    }
                }
            }
        )
    }

    // Confirm Delete Dialog
    aBorrar?.let { lugar ->
        AlertDialog(
            onDismissRequest = { aBorrar = null },
            icon = {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.errorContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.DeleteOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            },
            title = {
                Text(
                    text = "Eliminar lugar",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Text(
                    text = "¿Estás seguro de que deseas eliminar permanentemente \"${lugar.nombre}\"? Esta acción no se puede deshacer.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val id = lugar.id
                        aBorrar = null
                        if (id != null) {
                            scope.launch {
                                try {
                                    ApiClient.api.borrar(id)
                                    cargar()
                                } catch (e: Exception) {
                                    error = manejar(e)
                                }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Eliminar")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { aBorrar = null },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Cancelar")
                }
            },
            shape = RoundedCornerShape(24.dp)
        )
    }

    // Confirm Logout Dialog
    if (confirmarCerrarSesion) {
        AlertDialog(
            onDismissRequest = { confirmarCerrarSesion = false },
            icon = {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.Logout,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            },
            title = {
                Text(
                    text = "¿Cerrar sesión?",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            },
            text = {
                Text(
                    text = "Tendrás que volver a ingresar tus credenciales para acceder.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        confirmarCerrarSesion = false
                        Sesion.cerrar()
                        onCerrarSesion()
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Salir")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { confirmarCerrarSesion = false },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Cancelar")
                }
            },
            shape = RoundedCornerShape(24.dp)
        )
    }
}

@Composable
fun TarjetaLugar(
    lugar: Lugar,
    onEditar: () -> Unit,
    onBorrar: () -> Unit,
    modifier: Modifier = Modifier
) {
    var expandido by remember { mutableStateOf(false) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { expandido = !expandido },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .padding(16.dp)
                .animateContentSize()
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Avatar badge with initials/building
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(PrimaryLight.copy(alpha = 0.8f), PrimaryDark)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (lugar.edificio.isNotBlank()) lugar.edificio.take(2).uppercase() else "U",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 16.sp,
                        color = Color.White
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = lugar.nombre,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Badge Edificio
                        Surface(
                            color = MaterialTheme.colorScheme.primaryContainer,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Apartment,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = "Edif. ${lugar.edificio}",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }

                        // Badge Piso
                        Surface(
                            color = MaterialTheme.colorScheme.secondaryContainer,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Layers,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.secondary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = "Piso ${lugar.piso}",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.secondary
                                )
                            }
                        }
                    }
                }

                // Action Buttons
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(
                        onClick = onEditar,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f))
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Edit,
                            contentDescription = "Editar lugar",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    IconButton(
                        onClick = onBorrar,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f))
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DeleteOutline,
                            contentDescription = "Borrar lugar",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // Description section
            if (lugar.descripcion.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = lugar.descripcion,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(10.dp),
                        maxLines = if (expandido) Int.MAX_VALUE else 2,
                        overflow = TextOverflow.Ellipsis
                    )
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
    var nombre by remember { mutableStateOf(inicial?.nombre ?: "") }
    var edificio by remember { mutableStateOf(inicial?.edificio ?: "") }
    var piso by remember { mutableStateOf(inicial?.piso?.toString() ?: "") }
    var descripcion by remember { mutableStateOf(inicial?.descripcion ?: "") }
    var errorLocal by remember { mutableStateOf<String?>(null) }

    val errorActual = errorLocal ?: errorServidor

    AlertDialog(
        onDismissRequest = onCancelar,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(PrimaryGradientStart, PrimaryGradientEnd)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (inicial == null) Icons.Rounded.AddLocationAlt else Icons.Rounded.EditLocationAlt,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Text(
                    text = if (inicial == null) "Nuevo Espacio UAM-C" else "Editar Espacio UAM-C",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Name
                OutlinedTextField(
                    value = nombre,
                    onValueChange = {
                        nombre = it
                        errorLocal = null
                    },
                    label = { Text("Nombre del espacio") },
                    placeholder = { Text("Ej: Aula Magna 601, Lab Cómputo 408") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Rounded.Place,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                // Building and Floor in Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = edificio,
                        onValueChange = {
                            edificio = it
                            errorLocal = null
                        },
                        label = { Text("Edificio / Sede") },
                        placeholder = { Text("Ej: Torre, Artificios") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Rounded.Apartment,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f)
                    )

                    OutlinedTextField(
                        value = piso,
                        onValueChange = {
                            piso = it
                            errorLocal = null
                        },
                        label = { Text("Piso") },
                        placeholder = { Text("Ej: 1, 4, 8") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Rounded.Layers,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.secondary
                            )
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )
                }

                // Description
                OutlinedTextField(
                    value = descripcion,
                    onValueChange = { descripcion = it },
                    label = { Text("Descripción (opcional)") },
                    placeholder = { Text("Ej: 35 computadoras Mac, cañón láser y WiFi UAM") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.Notes,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    minLines = 2,
                    maxLines = 4,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                // Animated Error message inside dialog
                AnimatedVisibility(
                    visible = errorActual != null,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.ErrorOutline,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = errorActual ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }
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
                            onGuardar(Lugar(inicial?.id, nombre.trim(), edificio.trim(), p, descripcion.trim()))
                        }
                    }
                },
                shape = RoundedCornerShape(12.dp)
            ) {
                if (guardando) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Text("Guardando...")
                    }
                } else {
                    Text(if (inicial == null) "Crear espacio" else "Guardar cambios")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onCancelar,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Cancelar")
            }
        },
        shape = RoundedCornerShape(24.dp)
    )
}