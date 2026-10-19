package com.uam.lugaresapp.ui.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.annotation.DrawableRes
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.uam.lugaresapp.R

@Composable
fun CampusHero(
    titulo: String,
    subtitulo: String,
    modifier: Modifier = Modifier,
    altura: Dp = 286.dp,
    @DrawableRes imagen: Int = R.drawable.campus_cuajimalpa
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(altura)
            .clip(RoundedCornerShape(30.dp))
    ) {
        Image(
            painter = painterResource(imagen),
            contentDescription = "Edificio de la UAM Cuajimalpa",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color(0x2B000000),
                        0.54f to Color(0x790B0705),
                        1f to Color(0xE817120F)
                    )
                )
        )
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(22.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(R.drawable.uam_logo),
                    contentDescription = "Universidad Autónoma Metropolitana",
                    colorFilter = ColorFilter.tint(Color.White),
                    modifier = Modifier.height(26.dp).width(126.dp)
                )
                Spacer(Modifier.width(10.dp))
                OncahuiInsignia(34.dp)
            }
            Spacer(Modifier.height(14.dp))
            Text(
                text = titulo,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Black,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitulo,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = .84f),
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
fun CampusSectionTag(texto: String, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.primary,
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            text = texto.uppercase(),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
            color = Color.White,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.1.sp
        )
    }
}
