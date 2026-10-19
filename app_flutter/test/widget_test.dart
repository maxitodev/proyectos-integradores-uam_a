import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lugares_flutter/api.dart';
import 'package:lugares_flutter/pantallas/login.dart';
import 'package:lugares_flutter/pantallas/lugares.dart';
import 'package:shared_preferences/shared_preferences.dart';

Api _apiQueResponde(int codigo, String cuerpo) => Api(
      baseUrl: 'http://api.prueba',
      cliente: MockClient((_) async => http.Response(cuerpo, codigo)),
    );

void main() {
  testWidgets('el login no manda nada si faltan datos', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: LoginPantalla(api: _apiQueResponde(200, '{}'))),
    );

    await tester.tap(find.text('Entrar'));
    await tester.pump();

    expect(find.text('Escribe un correo válido'), findsOneWidget);
    expect(find.text('Escribe tu contraseña'), findsOneWidget);
  });

  testWidgets('la lista vacía avisa que no hay lugares', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LugaresPantalla(api: _apiQueResponde(200, '[]'), token: 'abc'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Todavía no hay lugares'), findsOneWidget);
  });

  testWidgets('con sesión inválida regresa al login', (tester) async {
    SharedPreferences.setMockInitialValues({'token': 'viejo'});

    await tester.pumpWidget(
      MaterialApp(
        home: LugaresPantalla(
          api: _apiQueResponde(401, '{"error":"Token inválido o caducado"}'),
          token: 'viejo',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Iniciar sesión'), findsOneWidget);
    expect(find.textContaining('Tu sesión caducó'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('token'), isNull);
  });
}
