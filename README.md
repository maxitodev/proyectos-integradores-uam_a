<p align="right">
  <b>Español</b> | <a href="./README.en.md">English</a>
</p>
# Proyectos integradores

Administración de Proyectos de Software (1151055) · UAM Azcapotzalco · 26-O

Profesor: M. en C. Gabriel Hurtado Avilés

## Equipo

- Max Uriel Sánchez Díaz (2213026327)
- Daniela Nava Martínez (2223028762)
- Bryan Tonatiuh Ochoa De La Cruz (2223028771)

## Proyectos

1. **App de salones** (obligatoria): navegación en interiores con realidad aumentada. Las historias de usuario están como issues en el tablero del equipo.
2. **Reproductor de música MP3** (idea propia, con Next.js y Supabase): por qué lo elegimos en [docs/eleccion.md](docs/eleccion.md) y la ficha en [docs/propuesta.md](docs/propuesta.md).

## Cómo trabajamos

1. Todo cambio empieza en un issue.
2. Se trabaja en una rama (`feat/lo-que-sea`), nunca directo en `main`.
3. Pull Request con `Closes #N`, revisado por alguien que no lo escribió y con el CI en verde.
4. Cada quien hace sus propios commits.

El `.env` no se sube. Las variables que hagan falta van en `.env.example`.

## Cómo ejecutar

Todavía no hay código. Cuando lo haya, el comando va aquí.


## Diferencia entre Kotlin y Flutter 
A continuación hacemos una comparación entre ambas tecnologias para destacar las ventajas y desventajes que ofrece cda una al momento de realizar un proyecto.
| Criterio | Flutter (Dart) | Kotlin (Jetpack Compose) |
|---|---|---|
| **Lenguaje** | Utiliza Dart, un lenguaje orientado a objetos, fuertemente tipado, con sintaxis basada en C/Java/JS, diseñado para admitir dos modos: una máquina virtual con compilación JIT para iteración rápida durante el desarrollo, y compilación AOT para producción. Para concurrencia emplea un modelo basado en eventos con **event loop** y ejecución mediante **Isolates**. | Lenguaje moderno, estático y fuertemente tipado que combina paradigmas orientados a objetos y funcionales, destacando por su sistema de tipos con seguridad frente a nulos de primer nivel y sintaxis concisa, con un ecosistema interoperable con **Java** en **Android/JVM** e interoperable directamente con Objective-C/Swift en iOS mediante Kotlin/Native. |
| **Código compartido** | • **Consumo de API:** Consume la API REST desarrollada en Node.js y Express mediante peticiones HTTP y autenticación JWT.<br>• **UI y lógica 100% unificadas:** Se comparte la totalidad del código fuente (lógica, modelos, llamadas a red e interfaz gráfica) entre plataformas usando un canvas propio (Impeller/Skia). | • **Consumo de API:** Puede consumir los mismos endpoints de la API REST y utilizar JWT.<br>• **Enfoque desacoplado:** El código de la interfaz se implementa de forma nativa con Jetpack Compose para Android (y por separado en SwiftUI para iOS si aplica); la lógica de negocio y consumo de red se puede compartir si se estructura como módulo Kotlin Multiplatform (KMP). |
| **Tiempo de compilación** | • **Desarrollo (Hot Reload):** Casi instantáneo (milisegundos) gracias a la máquina virtual JIT de Dart sin perder el estado de la app.<br>• **Producción:** Compilación nativa AOT directa a código máquina.<br>• *Nota:* Mediciones exactas de tiempos en el equipo de desarrollo pendientes de registrar. | • **Desarrollo:** Iteración ágil en Android mediante Compose Previews y recompilación incremental de Gradle.<br>• **Producción:** Generación optimizada de bytecode DEX para Android mediante el compilador de Kotlin/R8.<br>• *Nota:* Mediciones exactas de tiempos en el equipo de desarrollo pendientes de registrar. |
| **Dificultades presentadas al momento de implementación** | Pendiente de documentar las dificultades encontradas durante el desarrollo. | Pendiente de revisar las dificultades encontradas durante la implementación. |

## Uso de IA

- **Claude (Anthropic):** Estructura inicial del repositorio y borradores de los documentos en `docs/`.
- **Gemini (Google):** Mejora de la redacción técnica, validación de fuentes de información y traducción adaptada entre el README en español y en inglés.