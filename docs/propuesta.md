# Propuesta: reproductor de música MP3

| Campo | |
|---|---|
| **Problema** | Quien tiene su música descargada en MP3 suele escucharla con el reproductor básico del sistema, donde es incómodo armar listas y organizarla. (Hipótesis, todavía sin validar) |
| **Usuario y contexto** | Estudiantes como nosotros que escuchan música mientras estudian o programan, en laptop o celular, con canciones que ya descargaron. |
| **Alternativa actual** | Usamos el reproductor del sistema, VLC o Spotify con archivos locales. Falta probarlos con calma y anotar qué les falta. |
| **Versión mínima** | **Entra:** registro e inicio de sesión, cargar varios MP3, ver la biblioteca con título, artista y carátula, buscar, reproducir (pausa, siguiente, anterior, barra de progreso), cola, listas, aleatorio y repetir, favoritos. Más dos extras: temporizador de sueño y velocidad de reproducción. **Se aplaza a propósito:** ecualizador, letras sincronizadas, estadísticas de escucha, visualizador, compartir listas. |
| **Criterio de éxito** | Con un clon limpio, alguien que no escribió el README sigue sus pasos (crear el proyecto de Supabase, llenar el `.env` y correr la app) y en 15 minutos se registra, carga 3 MP3, arma una lista y la reproduce. La versión estática hace lo mismo sin servidor. Tres compañeros ajenos al equipo arman una lista y la reproducen sin ayuda. |
| **Evidencia** | Hipótesis sin validar: todavía no hablamos con nadie. Antes del 22 de octubre le vamos a preguntar a 3 a 5 compañeros qué usan para escuchar sus MP3 y qué les molesta, y lo que digan se anota aquí con fecha. |

## Las dos versiones

El código es el mismo y solo cambia dónde se guardan los datos.

| | Con backend | Estática |
|---|---|---|
| Corre | Next.js en Vercel con Supabase (Postgres y Auth) | En el navegador, publicada en Vercel |
| Datos | Cuentas, listas y favoritos en Supabase; los MP3, en IndexedDB del navegador | Todo en memoria del navegador y se borra al cerrar |
| Usuarios | Supabase Auth y reglas de acceso por usuario | Registro y sesión simulados, con aviso de que es una demo |

## Tecnología

- **Cliente web:** Next.js con TypeScript, publicado en Vercel. La versión estática se exporta con `output: 'export'`.
- **Backend:** Supabase en la nube (Postgres y Auth) para cuentas, listas y favoritos.
- **Audio:** los MP3 no se suben a ningún servidor. Se quedan en el navegador de cada persona, en IndexedDB en la versión con backend, para no tener que elegirlos otra vez.
- **Capa de datos:** una interfaz con dos implementaciones, una que usa Supabase y otra que trabaja en el navegador. Al compilar se elige cuál.
- **Llaves:** la llave pública de Supabase va en el cliente; la llave secreta nunca se sube ni se usa en el navegador. Todo va en el `.env` y en las variables de Vercel.

El export estático no admite Server Actions, cookies ni rutas de API que lean la petición (según la documentación de Next.js, consultada el 11 de octubre de 2026), así que las pantallas son componentes de cliente que piden todo a la capa de datos.

### Esto cambia lo que pide el curso

Para la idea propia el enunciado pide la versión con backend con `docker compose up -d` y la estática en GitHub Pages. Con Vercel y Supabase en la nube no cumpliríamos ninguna de las dos tal como están escritas.

Se lo preguntamos al profesor por escrito (ver [eleccion.md](eleccion.md)). Si no lo acepta, volvemos a lo que pide el curso: la versión estática en GitHub Pages y el backend con Postgres en `docker compose`.

## Música

La música descargada de cada quien no se sube al repositorio. Las pistas de demostración van con licencia libre (CC0 o CC BY) y con su atribución.
