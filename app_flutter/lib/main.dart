import 'package:flutter/material.dart';

import 'api.dart';
import 'pantallas/login.dart';
import 'pantallas/lugares.dart';
import 'sesion.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(LugaresApp(api: Api()));
}

class LugaresApp extends StatefulWidget {
  const LugaresApp({super.key, required this.api});

  final Api api;

  @override
  State<LugaresApp> createState() => _LugaresAppState();
}

class _LugaresAppState extends State<LugaresApp> {
  // Si ya hay un token guardado, se entra directo a la lista. Si caducó,
  // la lista recibe 401 y regresa sola al inicio de sesión.
  late final Future<String?> _token = Sesion.leer();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lugares UAM',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1B5E20),
        useMaterial3: true,
      ),
      home: FutureBuilder<String?>(
        future: _token,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          final token = snap.data;
          if (token == null) return LoginPantalla(api: widget.api);
          return LugaresPantalla(api: widget.api, token: token);
        },
      ),
    );
  }
}
