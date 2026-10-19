import 'package:flutter/material.dart';

import '../api.dart';
import '../modelos/lugar.dart';
import '../sesion.dart';
import 'login.dart';

class LugaresPantalla extends StatefulWidget {
  const LugaresPantalla({super.key, required this.api, required this.token});

  final Api api;
  final String token;

  @override
  State<LugaresPantalla> createState() => _LugaresPantallaState();
}

class _LugaresPantallaState extends State<LugaresPantalla> {
  List<Lugar> _lugares = const [];
  String? _error;
  bool _cargando = true;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    try {
      final lugares = await widget.api.lugares(widget.token);
      if (!mounted) return;
      setState(() {
        _lugares = lugares;
        _error = null;
        _cargando = false;
      });
    } on SesionInvalida {
      await _salir(
        aviso: 'Tu sesión caducó o no es válida. Inicia sesión de nuevo.',
      );
    } on ApiError catch (e) {
      _mostrarError(e.mensaje);
    } catch (_) {
      _mostrarError('La API respondió algo que la app no entiende.');
    }
  }

  void _mostrarError(String mensaje) {
    if (!mounted) return;
    setState(() {
      _error = mensaje;
      _cargando = false;
    });
  }

  void _reintentar() {
    setState(() {
      _cargando = true;
      _error = null;
    });
    _cargar();
  }

  Future<void> _salir({String? aviso}) async {
    await Sesion.borrar();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => LoginPantalla(api: widget.api, aviso: aviso),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lugares'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: _cargando ? null : _reintentar,
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () => _salir(),
          ),
        ],
      ),
      body: _cuerpo(),
    );
  }

  Widget _cuerpo() {
    if (_cargando) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 12),
            Text('Cargando lugares…'),
          ],
        ),
      );
    }

    if (_error != null) {
      return _Estado(
        icono: Icons.cloud_off,
        titulo: 'No se pudieron cargar los lugares',
        detalle: _error!,
        accion: FilledButton(
          onPressed: _reintentar,
          child: const Text('Reintentar'),
        ),
      );
    }

    if (_lugares.isEmpty) {
      return RefreshIndicator(
        onRefresh: _cargar,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 120),
            _Estado(
              icono: Icons.place_outlined,
              titulo: 'Todavía no hay lugares',
              detalle: 'Cuando alguien agregue uno, aparecerá aquí. '
                  'Desliza hacia abajo para actualizar.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _cargar,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _lugares.length,
        separatorBuilder: (context, index) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final lugar = _lugares[index];
          final ubicacion = 'Edificio ${lugar.edificio} · piso ${lugar.piso}';
          return ListTile(
            leading: const Icon(Icons.place),
            title: Text(lugar.nombre),
            subtitle: Text(
              lugar.descripcion.isEmpty
                  ? ubicacion
                  : '$ubicacion\n${lugar.descripcion}',
            ),
            isThreeLine: lugar.descripcion.isNotEmpty,
          );
        },
      ),
    );
  }
}

class _Estado extends StatelessWidget {
  const _Estado({
    required this.icono,
    required this.titulo,
    required this.detalle,
    this.accion,
  });

  final IconData icono;
  final String titulo;
  final String detalle;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icono, size: 56, color: tema.colorScheme.outline),
            const SizedBox(height: 16),
            Text(
              titulo,
              style: tema.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(detalle, textAlign: TextAlign.center),
            if (accion != null) ...[
              const SizedBox(height: 20),
              accion!,
            ],
          ],
        ),
      ),
    );
  }
}
