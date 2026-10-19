import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lugares_flutter/api.dart';

// Pruebas del cliente sin red: MockClient hace de API con las respuestas
// reales que da el backend (comprobadas con curl).
void main() {
  const base = 'http://api.prueba';

  test('login correcto devuelve el token', () async {
    final api = Api(
      baseUrl: base,
      cliente: MockClient((req) async {
        expect(req.method, 'POST');
        expect(req.url.toString(), '$base/login');
        expect(jsonDecode(req.body), {
          'email': 'a@b.com',
          'password': '12345678',
        });
        return http.Response(jsonEncode({'token': 'abc'}), 200);
      }),
    );

    expect(await api.login('a@b.com', '12345678'), 'abc');
  });

  test('credenciales incorrectas dan un mensaje claro', () async {
    final api = Api(
      baseUrl: base,
      cliente: MockClient(
        (_) async => http.Response(
          jsonEncode({'error': 'Credenciales incorrectas'}),
          401,
        ),
      ),
    );

    expect(
      () => api.login('a@b.com', 'equivocada'),
      throwsA(
        isA<ApiError>().having(
          (e) => e.mensaje,
          'mensaje',
          'Correo o contraseña incorrectos',
        ),
      ),
    );
  });

  test('la lista manda el token y convierte los lugares', () async {
    final api = Api(
      baseUrl: base,
      cliente: MockClient((req) async {
        expect(req.url.toString(), '$base/lugares');
        expect(req.headers['Authorization'], 'Bearer abc');
        return http.Response(
          jsonEncode([
            {
              'id': 1,
              'nombre': 'Salón G-301',
              'edificio': 'G',
              'piso': 3,
              'descripcion': '',
              'creado_en': '2026-10-19T01:00:35.085Z',
            },
          ]),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );

    final lugares = await api.lugares('abc');
    expect(lugares, hasLength(1));
    expect(lugares.single.nombre, 'Salón G-301');
    expect(lugares.single.edificio, 'G');
    expect(lugares.single.piso, 3);
  });

  test('token caducado o alterado lanza SesionInvalida', () async {
    final api = Api(
      baseUrl: base,
      cliente: MockClient(
        (_) async => http.Response(
          jsonEncode({'error': 'Token inválido o caducado'}),
          401,
        ),
      ),
    );

    expect(() => api.lugares('viejo'), throwsA(isA<SesionInvalida>()));
  });

  test('sin conexión da un mensaje en vez de tronar', () async {
    final api = Api(
      baseUrl: base,
      cliente: MockClient(
        (_) async => throw http.ClientException('Connection refused'),
      ),
    );

    expect(() => api.lugares('abc'), throwsA(isA<ApiError>()));
  });
}
