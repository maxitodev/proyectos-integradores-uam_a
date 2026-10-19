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
| **Lenguaje** | Utiliza Dart, un lenguaje orientado a objetos. Flutter permite construir interfaces mediante widgets. | Utiliza Kotlin, un lenguaje orientado a objetos que permite desarrollar aplicaciones nativas de Android mediante Jetpack Compose. |
| **Código compartido** | Consume la API REST desarrollada en Node.js y Express. Utiliza peticiones HTTP y autenticación mediante JWT. | Puede consumir los mismos endpoints de la API REST y utilizar JWT. El código de la interfaz se implementa por separado. |
| **Tiempo de compilación** | Pendiente de medir en el equipo de desarrollo. | Pendiente de medir en el equipo de desarrollo. |
| **Dificultades presentadas al momento de implementación** | Pendiente de documentar las dificultades encontradas durante el desarrollo. | Pendiente de revisar las dificultades encontradas durante la implementación. |

## Uso de IA

Usamos Claude (Anthropic) para armar la estructura del repositorio y los borradores de los documentos de `docs/`. Cualquier otro uso se agrega aquí.