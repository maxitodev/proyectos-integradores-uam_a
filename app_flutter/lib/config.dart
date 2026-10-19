/// URL base de la API.
///
/// En el emulador de Android, 10.0.2.2 es la computadora donde corre
/// `docker compose`. Para un teléfono real, use la IP local de la computadora
/// sin tocar el código:
///
///   flutter run --dart-define=API_URL=http://192.168.1.50:5000
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:5000',
);
