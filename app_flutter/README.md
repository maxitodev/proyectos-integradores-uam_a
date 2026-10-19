# Cliente en Flutter (ejercicio 4)

El mismo cliente que la app en Kotlin, pero en Flutter: inicio de sesión y la lista de lugares, conectados a la API de `backend/`.

## Qué hace

- **Inicio de sesión:** manda correo y contraseña a `POST /login` y guarda el token en el teléfono (`shared_preferences`).
- **Lista de lugares:** pide `GET /lugares` con el token en la cabecera `Authorization: Bearer`.
- **Estados:** cargando, error con botón de reintentar, lista vacía y sesión iniciada (con botón para cerrarla).
- **Sesión inválida:** si la API responde 401 (sin token, caducado o alterado), la app borra el token y regresa al inicio de sesión con un aviso.

No tiene pantalla de registro: las cuentas se crean desde la app en Kotlin o con `POST /registro`.

## Cómo correrlo

1. Levanta la API desde la raíz del repositorio: `docker compose up -d --build`.
2. Inicia el emulador de Android.
3. En esta carpeta:

   ```bash
   flutter pub get
   flutter run
   ```

## URL base

Por defecto es `http://10.0.2.2:5000`, que en el emulador apunta a tu computadora. Está en `lib/config.dart` y se cambia sin tocar el código:

```bash
flutter run --dart-define=API_URL=http://192.168.1.50:5000
```

En un teléfono real usa la IP local de tu computadora, en la misma red Wi-Fi.

## Pruebas

```bash
flutter test
```

Prueban el cliente de la API sin red (login, credenciales incorrectas, token en la cabecera, 401 y falta de conexión) y tres pantallas: validación del formulario, lista vacía y regreso al login con sesión inválida.

## Detalles de Android

En `android/app/src/main/AndroidManifest.xml`:

- `android.permission.INTERNET`, porque Flutter solo lo declara en depuración.
- `android:usesCleartextTraffic="true"`, porque la API local usa `http://`.
