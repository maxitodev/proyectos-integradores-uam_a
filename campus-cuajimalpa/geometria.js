// Geometrías combinadas: muchas piezas pequeñas (barandales, armaduras, escalones) en una sola malla.
// Menos nodos y menos peso en el GLB que una malla por pieza; las coordenadas son las del grupo que la recibe.
import * as THREE from 'three';

const CAJA = new THREE.BoxGeometry(1, 1, 1);
const CILINDROS = new Map();
function plantillaCilindro(lados) {
  if (!CILINDROS.has(lados)) CILINDROS.set(lados, new THREE.CylinderGeometry(1, 1, 1, lados, 1, true));
  return CILINDROS.get(lados);
}
const Y = new THREE.Vector3(0, 1, 0), M = new THREE.Matrix4(), N = new THREE.Matrix3(), Q = new THREE.Quaternion(),
  P = new THREE.Vector3(), E = new THREE.Vector3(), V = new THREE.Vector3();

export class Combinador {
  constructor() { this.pos = []; this.nor = []; this.idx = []; }
  get vacio() { return this.pos.length === 0; }
  // Copia una geometría plantilla (indexada) transformada por la matriz m.
  agregar(plantilla, m) {
    const base = this.pos.length / 3, p = plantilla.attributes.position, n = plantilla.attributes.normal;
    N.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      V.fromBufferAttribute(p, i).applyMatrix4(m); this.pos.push(V.x, V.y, V.z);
      V.fromBufferAttribute(n, i).applyMatrix3(N).normalize(); this.nor.push(V.x, V.y, V.z);
    }
    for (const i of plantilla.index.array) this.idx.push(base + i);
    return this;
  }
  // Caja centrada en (x,y,z) de w×h×d, girada rotY alrededor del eje vertical.
  caja(x, y, z, w, h, d, rotY = 0) {
    Q.setFromAxisAngle(Y, rotY);
    return this.agregar(CAJA, M.compose(P.set(x, y, z), Q, E.set(w, h, d)));
  }
  // Barra de sección cuadrada entre dos puntos [x,y,z].
  viga(a, b, ancho, alto = ancho) {
    const ini = new THREE.Vector3(...a), fin = new THREE.Vector3(...b), dir = fin.clone().sub(ini), largo = dir.length();
    if (largo < 1e-4) return this;
    Q.setFromUnitVectors(Y, dir.normalize());
    return this.agregar(CAJA, M.compose(P.copy(ini).add(fin).multiplyScalar(.5), Q, E.set(ancho, largo, alto)));
  }
  // Tubo cilíndrico abierto entre dos puntos [x,y,z].
  cilindro(a, b, radio, lados = 6) {
    const ini = new THREE.Vector3(...a), fin = new THREE.Vector3(...b), dir = fin.clone().sub(ini), largo = dir.length();
    if (largo < 1e-4) return this;
    Q.setFromUnitVectors(Y, dir.normalize());
    return this.agregar(plantillaCilindro(lados), M.compose(P.copy(ini).add(fin).multiplyScalar(.5), Q, E.set(radio, largo, radio)));
  }
  // Tubo a lo largo de una polilínea [[x,y,z],…]; los tramos se traslapan un poco para no dejar huecos en las juntas.
  tubo(puntos, radio, lados = 6) {
    for (let i = 1; i < puntos.length; i++) {
      const a = new THREE.Vector3(...puntos[i - 1]), b = new THREE.Vector3(...puntos[i]), d = b.clone().sub(a).setLength(radio * .5);
      this.cilindro(a.clone().sub(d).toArray(), b.clone().add(d).toArray(), radio, lados);
    }
    return this;
  }
  // Triángulos sueltos (cada uno con su normal plana): [[ax,ay,az],[bx,by,bz],[cx,cy,cz]].
  triangulo(a, b, c) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...c),
      n = B.clone().sub(A).cross(C.clone().sub(A)).normalize(), base = this.pos.length / 3;
    for (const q of [A, B, C]) { this.pos.push(q.x, q.y, q.z); this.nor.push(n.x, n.y, n.z); }
    this.idx.push(base, base + 1, base + 2);
    return this;
  }
  cuadro(a, b, c, d) { return this.triangulo(a, b, c).triangulo(a, c, d); }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  // Una sola malla con todo lo acumulado; null si no hay piezas.
  malla(parent, nombre, material, {sombra = true, recibe = true} = {}) {
    if (this.vacio) return null;
    const m = new THREE.Mesh(this.geometria(), material);
    m.name = nombre; m.castShadow = sombra; m.receiveShadow = recibe; parent.add(m);
    return m;
  }
}

// Contorno de un trazo de ancho fijo a lo largo de una polilínea 2D [[x,y],…] (puntas planas, uniones en inglete limitado).
export function trazo(puntos, ancho) {
  const izq = [], der = [], h = ancho / 2, n = puntos.length;
  for (let i = 0; i < n; i++) {
    const a = puntos[Math.max(0, i - 1)], b = puntos[i], c = puntos[Math.min(n - 1, i + 1)];
    let t1 = [b[0] - a[0], b[1] - a[1]], t2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...t1) || 1, l2 = Math.hypot(...t2) || 1;
    t1 = [t1[0] / l1, t1[1] / l1]; t2 = [t2[0] / l2, t2[1] / l2];
    if (i === 0) t1 = t2; if (i === n - 1) t2 = t1;
    let tx = t1[0] + t2[0], ty = t1[1] + t2[1]; const lt = Math.hypot(tx, ty) || 1; tx /= lt; ty /= lt;
    const nx = -ty, ny = tx, cos = Math.max(.35, nx * -t1[1] + ny * t1[0]), k = h / cos;
    izq.push([b[0] + nx * k, b[1] + ny * k]); der.push([b[0] - nx * k, b[1] - ny * k]);
  }
  return [...izq, ...der.reverse()];
}

// Arco de circunferencia como polilínea 2D (ángulos en radianes, sentido de a0 hacia a1).
export function arco(cx, cy, r, a0, a1, n = 16) {
  return Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
}

// Extruye contornos 2D (x a la derecha, y hacia arriba) con la profundidad dada a lo largo de +z; agujeros opcionales.
export function extruir(contornos, profundidad, agujeros = []) {
  const formas = contornos.map(c => new THREE.Shape(c.map(([x, y]) => new THREE.Vector2(x, y))));
  for (const [i, h] of agujeros) formas[i].holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ExtrudeGeometry(formas, {depth: profundidad, bevelEnabled: false, curveSegments: 12});
}

// Superficie de una meseta: tapa plana a la altura h y faldón hacia el suelo (y = base) por cada lado.
// muros: índices de lados que bajan en vertical (muro); los demás bajan en talud con la distancia «corrida».
export function meseta(puntos, h, {base = 0, corrida = 3, muros = []} = {}) {
  const tapa = new Combinador(), muro = new Combinador(), talud = new Combinador(), n = puntos.length;
  const area = puntos.reduce((s, p, i) => { const q = puntos[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), signo = area > 0 ? 1 : -1;
  const tris = THREE.ShapeUtils.triangulateShape(puntos.map(([x, z]) => new THREE.Vector2(x, z)), []);
  for (const [a, b, c] of tris) {
    const A = [puntos[a][0], h, puntos[a][1]], B = [puntos[b][0], h, puntos[b][1]], C = [puntos[c][0], h, puntos[c][1]];
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
    if (ny >= 0) tapa.triangulo(A, B, C); else tapa.triangulo(A, C, B);
  }
  const fuera = i => { const p = puntos[i], q = puntos[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [signo * dz / l, -signo * dx / l]; };
  for (let i = 0; i < n; i++) {
    const p = puntos[i], q = puntos[(i + 1) % n], [ox, oz] = fuera(i), esMuro = muros.includes(i), c = esMuro ? 0 : corrida;
    const A = [p[0], h, p[1]], B = [q[0], h, q[1]], C = [q[0] + ox * c, base, q[1] + oz * c], D = [p[0] + ox * c, base, p[1] + oz * c];
    (esMuro ? muro : talud).cuadro(A, D, C, B);
    // Esquina entre dos taludes: abanico para no dejar hueco.
    const j = (i + 1) % n;
    if (!esMuro && !muros.includes(j)) { const [px, pz] = fuera(j); talud.triangulo(B, C, [q[0] + px * corrida, base, q[1] + pz * corrida]); talud.triangulo(B, [q[0] + px * corrida, base, q[1] + pz * corrida], C); }
  }
  return {tapa, muro, talud};
}
