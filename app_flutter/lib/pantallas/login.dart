import 'package:flutter/material.dart';

import '../api.dart';
import '../sesion.dart';
import 'lugares.dart';

class LoginPantalla extends StatefulWidget {
  const LoginPantalla({super.key, required this.api, this.aviso});

  final Api api;

  /// Mensaje al llegar aquí; por ejemplo, cuando la sesión caducó.
  final String? aviso;

  @override
  State<LoginPantalla> createState() => _LoginPantallaState();
}

class _LoginPantallaState extends State<LoginPantalla> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _cargando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _error = widget.aviso;
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (_cargando || !_form.currentState!.validate()) return;
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final token = await widget.api.login(_email.text.trim(), _password.text);
      await Sesion.guardar(token);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => LugaresPantalla(api: widget.api, token: token),
        ),
      );
    } on ApiError catch (e) {
      _mostrarError(e.mensaje);
    } catch (_) {
      _mostrarError('Ocurrió un error inesperado. Intenta de nuevo.');
    }
  }

  void _mostrarError(String mensaje) {
    if (!mounted) return;
    setState(() {
      _error = mensaje;
      _cargando = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Iniciar sesión')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(Icons.place, size: 56, color: tema.colorScheme.primary),
                    const SizedBox(height: 8),
                    Text(
                      'Lugares UAM',
                      style: tema.textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    if (_error != null) ...[
                      _Aviso(texto: _error!),
                      const SizedBox(height: 16),
                    ],
                    TextFormField(
                      key: const Key('email'),
                      controller: _email,
                      enabled: !_cargando,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Correo',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || !v.contains('@'))
                          ? 'Escribe un correo válido'
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('password'),
                      controller: _password,
                      enabled: !_cargando,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Contraseña',
                        border: OutlineInputBorder(),
                      ),
                      onFieldSubmitted: (_) => _entrar(),
                      validator: (v) => (v == null || v.isEmpty)
                          ? 'Escribe tu contraseña'
                          : null,
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _cargando ? null : _entrar,
                      child: _cargando
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Entrar'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Aviso extends StatelessWidget {
  const _Aviso({required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colores.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(texto, style: TextStyle(color: colores.onErrorContainer)),
    );
  }
}
