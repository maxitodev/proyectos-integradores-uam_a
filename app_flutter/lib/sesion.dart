import 'package:shared_preferences/shared_preferences.dart';

/// Guarda el token en el teléfono para no pedir la contraseña cada vez.
class Sesion {
  static const _clave = 'token';

  static Future<String?> leer() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_clave);
  }

  static Future<void> guardar(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_clave, token);
  }

  static Future<void> borrar() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_clave);
  }
}
