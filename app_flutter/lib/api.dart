import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'modelos/lugar.dart';

/// El token falta, caducó o fue alterado: la API respondió 401.
/// La app borra la sesión y regresa al inicio de sesión.
class SesionInvalida implements Exception {
  const SesionInvalida();
}

/// Cualquier otro problema, con un mensaje listo para mostrar.
class ApiError implements Exception {
  const ApiError(this.mensaje);

  final String mensaje;

  @override
  String toString() => mensaje;
}

/// Todo pasa por la API; la app nunca toca la base de datos.
class Api {
  Api({http.Client? cliente, String? baseUrl})
      : _cliente = cliente ?? http.Client(),
        _base = baseUrl ?? apiUrl;

  final http.Client _cliente;
  final String _base;

  static const _espera = Duration(seconds: 10);

  /// `POST /login`. Devuelve el token firmado.
  Future<String> login(String email, String password) async {
    final r = await _enviar(
      () => _cliente.post(
        Uri.parse('$_base/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      ),
    );
    if (r.statusCode == 200) {
      final cuerpo = _json(r) as Map<String, dynamic>;
      return cuerpo['token'] as String;
    }
    // Aquí un 401 no es sesión caducada: son credenciales incorrectas.
    if (r.statusCode == 401) {
      throw const ApiError('Correo o contraseña incorrectos');
    }
    throw ApiError(_mensaje(r));
  }

  /// `GET /lugares`, con el token en la cabecera.
  Future<List<Lugar>> lugares(String token) async {
    final r = await _enviar(
      () => _cliente.get(
        Uri.parse('$_base/lugares'),
        headers: {'Authorization': 'Bearer $token'},
      ),
    );
    if (r.statusCode == 200) {
      final lista = _json(r) as List<dynamic>;
      return lista
          .map((e) => Lugar.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    if (r.statusCode == 401) throw const SesionInvalida();
    throw ApiError(_mensaje(r));
  }

  Future<http.Response> _enviar(
    Future<http.Response> Function() peticion,
  ) async {
    try {
      return await peticion().timeout(_espera);
    } on TimeoutException {
      throw const ApiError('La API tardó demasiado en responder');
    } catch (_) {
      throw ApiError('No se pudo conectar con la API en $_base');
    }
  }

  // Se decodifica como UTF-8 para que acentos y eñes lleguen bien.
  Object? _json(http.Response r) =>
      jsonDecode(utf8.decode(r.bodyBytes, allowMalformed: true));

  String _mensaje(http.Response r) {
    try {
      final cuerpo = _json(r);
      if (cuerpo is Map && cuerpo['error'] is String) {
        return cuerpo['error'] as String;
      }
    } catch (_) {
      // La respuesta no es JSON: se usa el mensaje genérico.
    }
    return 'Error inesperado de la API (${r.statusCode})';
  }
}
