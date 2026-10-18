/// Un lugar del campus, tal como lo devuelve `GET /lugares`.
class Lugar {
  const Lugar({
    required this.id,
    required this.nombre,
    required this.edificio,
    required this.piso,
    this.descripcion = '',
  });

  final int id;
  final String nombre;
  final String edificio;
  final int piso;
  final String descripcion;

  factory Lugar.fromJson(Map<String, dynamic> json) {
    return Lugar(
      id: json['id'] as int,
      nombre: json['nombre'] as String,
      edificio: json['edificio'] as String,
      piso: json['piso'] as int,
      descripcion: (json['descripcion'] as String?) ?? '',
    );
  }
}
