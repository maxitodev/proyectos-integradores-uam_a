package com.uam.lugaresapp.ui.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.uam.lugaresapp.R
import kotlinx.coroutines.delay

@Composable
fun PantallaBienvenida(onLista: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(900)
        onLista()
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Panther),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            OncahuiInsignia(86.dp)
            Spacer(Modifier.height(26.dp))
            Image(
                painter = painterResource(R.drawable.uam_logo),
                contentDescription = "Universidad Autónoma Metropolitana",
                colorFilter = ColorFilter.tint(Cream),
                modifier = Modifier.height(56.dp)
            )
            Spacer(Modifier.height(20.dp))
            Text(
                text = "UNIDAD CUAJIMALPA",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.ExtraBold,
                color = PrimaryLight
            )
            Text(
                text = "Casa abierta al tiempo",
                modifier = Modifier.padding(top = 6.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = .76f),
                textAlign = TextAlign.Center
            )
        }
    }
}
