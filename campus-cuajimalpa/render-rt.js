/* ============================================================================
 * render-rt.js · Render fotorrealista opcional (path tracing en GPU) del visor UAM Cuajimalpa
 *
 * Botón «Renderizar imagen (ray tracing)»: bajo demanda traza, de forma progresiva, la vista actual
 * (misma cámara del visor) y muestra el resultado acumulándose en una capa superpuesta, con contador
 * de muestras, «Detener», «Guardar PNG» y «Cerrar». El visor normal no se toca.
 *
 * Decisiones de diseño (ver INTEGRACION.md):
 *  - Usa un SEGUNDO WebGLRenderer con su propio canvas (superpuesto). El renderer del visor sólo se LEE
 *    (tone mapping, exposición, espacio de color); nunca se le dibuja ni se le cambia estado.
 *  - No añade nada a `scene` ni a `world`: el GLB y plano_2d.png no se ven afectados. La escena de trazado
 *    es una copia plana y temporal (geometrías clonadas, materiales convertidos) que se destruye al detener.
 *  - Librería: three-gpu-pathtracer 0.0.20 + three-mesh-bvh 0.7.3 (par probado con three r160), sin workers:
 *    el BVH se construye en el hilo principal (síncrono, unos segundos).
 *  - Luz: el HemisphereLight del visor se convierte en un entorno equirectangular equivalente (misma irradiancia
 *    difusa), el cielo degradado ('Cielo') es el fondo visible y el Sol es una DirectionalLight cuya dirección se
 *    "difumina" en cada muestra dentro de un cono (sombras suaves). La niebla del visor no se reproduce.
 *  - onBeforeCompile NO existe para el trazador: el detalle triplanar (texturas CC0) se hornea en un mapa
 *    + UV de proyección por caja en espacio mundo (ver hornearDetalle / proyectarUVMundo). Sin detalle = color plano.
 * ========================================================================== */
import * as THREE from 'three';
import {PathTracingRenderer, PathTracingSceneGenerator, PhysicalPathTracingMaterial, CompatibilityDetector} from 'three-gpu-pathtracer';
import {FullScreenQuad} from 'three-pass';

export const VERSION_RT = '1.0.0';

/** Opciones y sus valores por defecto (todas se pueden pasar en createRenderRT({...})). */
export const OPCIONES_POR_DEFECTO = {
  rebotes: 4,               // rebotes de luz (3-5 recomendado)
  rebotesTransmision: 8,    // pasos extra a través de superficies transparentes (redes, carpa, rótulos)
  escala: 'auto',           // 'auto' (≈1,2 Mpx) o fracción del tamaño CSS del visor (0.25…2)
  pixelesAuto: 1.2e6,       // presupuesto de píxeles de la escala 'auto'
  muestrasMax: 0,           // 0 = sin límite (se detiene con «Detener»)
  teselas: null,            // [x, y]; null = automático según la resolución
  tamanoTextura: 1024,      // lado de cada capa del arreglo de texturas del trazador
  anguloSol: 0.8,           // semiángulo (grados) del disco solar para sombras suaves; 0 = sombra dura
  intensidadSol: 1,         // factor sobre sun.intensity
  intensidadAmbiente: 1,    // factor sobre hemi.intensity
  filtroGlossy: 0.2,        // atenúa luciérnagas (fireflies) por rebotes difuso→especular
  detalle: true,            // hornear el detalle triplanar si se proporciona (detalleDe / userData.detalle)
  tamanoDetalle: 512,       // lado máximo del mapa de detalle horneado
  excluir: [],              // nombres de nodos de `world` que no entran al render
  contenedor: null,         // elemento donde se monta la capa; por defecto el padre del canvas del visor
  entorno: null,            // DataTexture equirectangular (Float/HalfFloat) para luz Y fondo (sustituye al degradado)
  fondo: null,              // DataTexture equirectangular sólo para el fondo visible
  detalleDe: null,          // (material) => {tex, scale, avg?, k?} | WeakMap/Map material → ídem
  dibujarMarca: null,       // (ctx2d, lienzo) => void: dibuja la marca de agua sobre el PNG exportado
  guardar: null,            // (blob, nombre) => void|Promise: si falta, descarga el PNG
  nombreArchivo: 'Render_UAM_ray_tracing.png',
  pie: true,                // texto inferior en el PNG (true | false | cadena)
};

/* ------------------------------------------------------------------------- */
/* Utilidades puras (sin GPU ni DOM): se prueban en Node con prueba-headless.mjs */
/* ------------------------------------------------------------------------- */

const NOMBRES_EXCLUIDOS = ['Marca_copyright_modelo'];  // 3D de la marca: el PNG lleva la marca 2D (dibujarMarca)
const MAPAS_SOPORTADOS = ['map', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'transmissionMap',
  'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap', 'iridescenceMap',
  'iridescenceThicknessMap', 'specularColorMap', 'specularIntensityMap'];

const aHalf = v => THREE.DataUtils.toHalfFloat(Math.min(Math.max(v, 0), 65504));
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const srgbALineal = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/** ¿Se omite este nodo (y su subárbol)? */
export function esExcluido(nodo, extra = []) {
  const u = nodo.userData || {};
  return u.presentation === true || u.rtExcluir === true || NOMBRES_EXCLUIDOS.includes(nodo.name) || extra.includes(nodo.name);
}

/** Textura equirectangular HalfFloat. f(x,y,z) devuelve [r,g,b] lineal para la dirección unitaria (convención de la librería: fila 0 = nadir, última = cenit). */
export function crearTexturaEquirect(ancho, alto, f) {
  const datos = new Uint16Array(ancho * alto * 4);
  const uno = aHalf(1);
  for (let fila = 0; fila < alto; fila++) {
    const v = (fila + 0.5) / alto, polar = Math.PI * (1 - v), y = Math.cos(polar), s = Math.sin(polar);
    for (let col = 0; col < ancho; col++) {
      const phi = 2 * Math.PI * ((col + 0.5) / ancho - 0.5), c = f(s * Math.cos(phi), y, s * Math.sin(phi)), i = (fila * ancho + col) * 4;
      datos[i] = aHalf(c[0]); datos[i + 1] = aHalf(c[1]); datos[i + 2] = aHalf(c[2]); datos[i + 3] = uno;
    }
  }
  const t = new THREE.DataTexture(datos, ancho, alto, THREE.RGBAFormat, THREE.HalfFloatType);
  t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
  return t;
}

/** Colores del HemisphereLight como radiancias de un entorno que da la MISMA irradiancia difusa: L = I·C/π. */
export function coloresHemisferio(hemi, factor = 1) {
  if (!hemi || !hemi.isHemisphereLight) return null;
  const k = hemi.intensity * factor / Math.PI, eje = new THREE.Vector3();
  hemi.updateWorldMatrix(true, false); hemi.getWorldPosition(eje);   // three usa la posición de la luz como eje «arriba»
  if (eje.lengthSq() < 1e-9) eje.set(0, 1, 0);
  eje.normalize();
  return {cielo: [hemi.color.r * k, hemi.color.g * k, hemi.color.b * k], suelo: [hemi.groundColor.r * k, hemi.groundColor.g * k, hemi.groundColor.b * k], eje};
}

/** Entorno de iluminación: cielo constante sobre el horizonte, suelo constante bajo él (transición de ~2°). */
export function crearEntornoHemisferio(c, ancho = 128, alto = 64) {
  const e = c.eje;
  return crearTexturaEquirect(ancho, alto, (x, y, z) => mezcla(c.suelo, c.cielo, suave(-0.035, 0.035, x * e.x + y * e.y + z * e.z)));
}

/** Degradado del 'Cielo' del visor (misma fórmula que su sombreador); colores top/mid/low en lineal. */
export function coloresCielo(sky) {
  const u = sky && sky.material && sky.material.uniforms;
  if (!u || !u.top || !u.mid || !u.low || !u.top.value || !u.top.value.isColor) return null;
  const a = c => [c.r, c.g, c.b];
  return {top: a(u.top.value), mid: a(u.mid.value), low: a(u.low.value)};
}
export function colorDeCielo(y, c) {
  if (y < 0) return c.low;
  return mezcla(c.low, mezcla(c.mid, c.top, suave(0.25, 0.9, y)), suave(0, 0.3, y));
}
export function crearFondoCielo(c, ancho = 256, alto = 128) { return crearTexturaEquirect(ancho, alto, (x, y) => colorDeCielo(y, c)); }

/** Dirección del Sol «difuminada» dentro de un cono de semiángulo `radio` (rad). Secuencia R2 (baja discrepancia). Escribe en `salida`. */
export function direccionSolDifusa(base, radio, i, salida = new THREE.Vector3()) {
  const r = Math.sqrt((0.5 + i * 0.7548776662466927) % 1) * Math.tan(radio), a = 2 * Math.PI * ((0.5 + i * 0.5698402909980532) % 1);
  const arriba = Math.abs(base.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e1 = new THREE.Vector3().crossVectors(arriba, base).normalize(), e2 = new THREE.Vector3().crossVectors(base, e1);
  return salida.copy(base).addScaledVector(e1, r * Math.cos(a)).addScaledVector(e2, r * Math.sin(a)).normalize();
}

/** Teselas (x,y) para que cada llamada de dibujo cubra ≲0,25 Mpx y no dispare el watchdog (TDR) de la GPU. */
export function elegirTeselas(ancho, alto) { const n = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(ancho * alto / 250000)))); return [n, n]; }

/** Tamaño del render a partir del contenedor y la escala ('auto' o número). */
export function calcularTamano(cw, ch, escala, pixelesAuto, maxLado = 4096) {
  cw = Math.max(64, cw); ch = Math.max(64, ch);
  let e = escala === 'auto' ? Math.min(1, Math.max(0.3, Math.sqrt(pixelesAuto / (cw * ch)))) : Math.max(0.1, Number(escala) || 1);
  let w = Math.round(cw * e), h = Math.round(ch * e);
  const tope = Math.min(1, maxLado / Math.max(w, h), 5e6 / (w * h) > 1 ? 1 : Math.sqrt(5e6 / (w * h)));
  return {w: Math.max(32, Math.round(w * tope)), h: Math.max(32, Math.round(h * tope)), escala: e * tope};
}

/** Lee píxeles RGBA (≤ max) de una textura cargada del visor; null si no se puede (no cargada, o canvas «tainted»). */
export function leerPixelesTextura(tex, max = 512) {
  try {
    const img = tex && tex.image;
    if (!img || img.data || typeof document === 'undefined') return null;
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return null;
    const k = Math.min(1, max / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(img, 0, 0, w, h);
    return {w, h, data: x.getImageData(0, 0, w, h).data};
  } catch (e) { return null; }
}

/** Promedio lineal como en app.js (miniatura 8×8; promedio sRGB → pow 2.2). */
export function promedioDetalle(tex) {
  const p = leerPixelesTextura(tex, 8);
  if (!p) return [1, 1, 1];
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < p.data.length; i += 4) { r += p.data[i]; g += p.data[i + 1]; b += p.data[i + 2]; }
  const n = p.data.length / 4 * 255;
  return [r, g, b].map(v => Math.pow(v / n, 2.2));
}

/**
 * Hornea el factor del sombreador triplanar `mix(1, clamp(tc/avg, .35, 1.9), k)` en un mapa RGBA8 lineal.
 * Como el factor puede ser > 1 se guarda f/fmax (fmax = 1 + 0,9·k) y el color del material se multiplica por fmax.
 * La fila 0 del resultado es v=0 (abajo), igual que una textura con flipY.
 */
export function hornearDetalle(pix, avg, k) {
  const {w, h, data} = pix, fmax = 1 + 0.9 * k, salida = new Uint8Array(w * h * 4), lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) lin[i] = srgbALineal(i / 255);
  for (let y = 0; y < h; y++) {
    const yy = h - 1 - y;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = (yy * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const f = 1 + (Math.min(1.9, Math.max(0.35, lin[data[s + c]] / (avg[c] || 1))) - 1) * k;
        salida[d + c] = Math.round(f / fmax * 255);
      }
      salida[d + 3] = 255;
    }
  }
  return {datos: salida, w, h, fmax};
}

/**
 * Geometría YA en espacio mundo → sin índice y con UV de proyección por caja: cada triángulo usa el plano del eje
 * dominante de su normal (X→(z,y), Y→(x,z), Z→(x,y)) dividido entre `escala` m. Equivale al triplanar del visor
 * sin la mezcla en bordes. Si `invertir`, invierte el orden de los vértices (transformaciones con determinante < 0).
 */
export function proyectarUVMundo(geom, escala, invertir = false) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const pos = g.attributes.position, n = pos.count, uv = new Float32Array(n * 2), p = pos.array, itemP = pos.itemSize;
  for (let t = 0; t + 2 < n; t += 3) {
    const a = t * itemP, b = (t + 1) * itemP, c = (t + 2) * itemP;
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2], e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    const nx = Math.abs(e1y * e2z - e1z * e2y), ny = Math.abs(e1z * e2x - e1x * e2z), nz = Math.abs(e1x * e2y - e1y * e2x);
    const eje = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;
    for (let j = 0; j < 3; j++) {
      const q = (t + j) * itemP, x = p[q], y = p[q + 1], z = p[q + 2];
      uv[(t + j) * 2] = (eje === 0 ? z : x) / escala;
      uv[(t + j) * 2 + 1] = (eje === 0 ? y : eje === 1 ? z : y) / escala;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (invertir) {
    for (const nombre of Object.keys(g.attributes)) {
      const at = g.attributes[nombre], is = at.itemSize;
      for (let t = 0; t + 2 < at.count; t += 3) for (let j = 0; j < is; j++) {
        const u = at.getComponent(t + 1, j); at.setComponent(t + 1, j, at.getComponent(t + 2, j)); at.setComponent(t + 2, j, u);
      }
    }
  }
  return g;
}

/** Información de detalle de un material: {tex, scale, avg, k} con valores ya resueltos, o null. Acepta uniformes {value}. */
export function infoDetalle(material, detalleDe) {
  let d = null;
  if (typeof detalleDe === 'function') d = detalleDe(material);
  else if (detalleDe && typeof detalleDe.get === 'function') d = detalleDe.get(material);
  if (!d && material.userData && material.userData.detalle) d = material.userData.detalle;
  if (!d) return null;
  const v = x => (x && typeof x === 'object' && !x.isTexture && 'value' in x ? x.value : x);
  const tex = v(d.tex), k = v(d.k);
  if (!tex || !tex.isTexture) return null;
  return {tex, scale: Number(d.scale ?? d.escala) || 6, avg: v(d.avg) || null, k: k === undefined ? 0.8 : Number(k)};
}

function arrayDe(c) { return c && typeof c.toArray === 'function' ? c.toArray() : Array.isArray(c) ? c : [c.x, c.y, c.z]; }

/**
 * Convierte un material del visor a uno que el trazador entiende (Standard/Physical). Devuelve null si no es soportable
 * (ShaderMaterial, líneas, puntos…). No usa material.clone() directamente: userData puede contener texturas y clone() hace JSON.stringify.
 */
export function convertirMaterial(m, clonarTextura) {
  if (!m || !m.isMaterial || m.isShaderMaterial || m.isRawShaderMaterial || m.isLineBasicMaterial || m.isPointsMaterial || m.isSpriteMaterial
    || m.isMeshDepthMaterial || m.isMeshNormalMaterial || m.isMeshDistanceMaterial || m.isShadowMaterial) return null;
  let pt;
  if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
    const ud = m.userData; m.userData = {};
    try { pt = m.clone(); } finally { m.userData = ud; }
  } else if (m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshMatcapMaterial) {
    pt = new THREE.MeshStandardMaterial({color: m.color, roughness: 0.9, metalness: 0});
    for (const k of ['opacity', 'transparent', 'side', 'alphaTest', 'map', 'alphaMap', 'emissiveMap', 'emissiveIntensity', 'normalMap', 'flatShading']) if (k in m) pt[k] = m[k];
    if (m.emissive && m.emissive.isColor) pt.emissive.copy(m.emissive);
    if (m.normalScale) pt.normalScale.copy(m.normalScale);
  } else return null;
  pt.vertexColors = false; pt.envMap = null; pt.userData = {};
  for (const k of Object.keys(pt)) {
    const v = pt[k];
    if (v && v.isTexture) pt[k] = MAPAS_SOPORTADOS.includes(k) ? clonarTextura(v) : null;   // sólo mapas que el trazador usa
  }
  return pt;
}

function triangulosDe(g) { return (g.index ? g.index.count : g.attributes.position.count) / 3; }

/**
 * Construye la escena TEMPORAL de trazado a partir de `world` (no modifica `world`, sus geometrías ni sus materiales).
 * Devuelve {escena, recursos, stats}. Llamar a liberarEscenaRT(recursos) al terminar.
 */
export function construirEscenaRT(world, opciones = {}) {
  const o = {...OPCIONES_POR_DEFECTO, ...opciones};
  world.updateMatrixWorld(true);
  const escena = new THREE.Scene(), recursos = {geometrias: [], materiales: [], texturas: []};
  const cacheTex = new Map(), cacheGeo = new Map(), cacheMat = new Map(), cacheDet = new Map();
  const stats = {mallas: 0, triangulos: 0, materiales: 0, conDetalle: 0, texturas: 0,
    omitidas: {sombreador: 0, instanciadas: 0, sinGeometria: 0, multimaterial: 0, excluidas: 0, ocultas: 0}};
  const clonarTextura = t => {
    if (!cacheTex.has(t)) { const c = t.clone(); c.needsUpdate = true; cacheTex.set(t, c); recursos.texturas.push(c); }
    return cacheTex.get(t);
  };
  const leer = o.leerPixeles || leerPixelesTextura;

  // Detalle horneado por textura (compartido por todos los materiales que la usan)
  const detalleHorneado = d => {
    const clave = d.tex.uuid + '|' + d.k;
    if (cacheDet.has(clave)) return cacheDet.get(clave);
    let r = null;
    const pix = d.k > 0 ? leer(d.tex, o.tamanoDetalle) : null;
    if (pix) {
      const avg = d.avg ? arrayDe(d.avg) : promedioDetalle(d.tex);
      const h = hornearDetalle(pix, avg, d.k);
      const t = new THREE.DataTexture(h.datos, h.w, h.h, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
      recursos.texturas.push(t); r = {tex: t, fmax: h.fmax};
    }
    cacheDet.set(clave, r);
    return r;
  };

  const procesar = n => {
    if (n.isInstancedMesh || n.isSkinnedMesh || n.isBatchedMesh) { stats.omitidas.instanciadas++; return; }
    const g = n.geometry;
    if (!g || !g.attributes || !g.attributes.position || g.attributes.position.count < 3) { stats.omitidas.sinGeometria++; return; }
    const lista = Array.isArray(n.material) ? n.material : [n.material];
    if (lista.length > 1) stats.omitidas.multimaterial++;
    const mo = lista[0];
    if (!mo) { stats.omitidas.sinGeometria++; return; }
    if (mo.visible === false) { stats.omitidas.ocultas++; return; }
    const sinSombra = !n.castShadow && (mo.transparent === true || mo.opacity < 1);   // redes/carpa: no proyectan sombra, como en el visor
    const det = o.detalle && !mo.map ? infoDetalle(mo, o.detalleDe) : null;
    const hor = det ? detalleHorneado(det) : null;
    const clave = mo.uuid + '|' + (sinSombra ? 1 : 0) + '|' + (hor ? hor.tex.uuid : 'p');
    if (!cacheMat.has(clave)) {
      const pt = convertirMaterial(mo, clonarTextura);
      if (pt && hor) { pt.map = hor.tex; pt.color.multiplyScalar(hor.fmax); stats.conDetalle++; }
      if (pt) { pt.userData = {rtSinSombra: sinSombra}; recursos.materiales.push(pt); }
      cacheMat.set(clave, pt);
    }
    const mat = cacheMat.get(clave);
    if (!mat) { stats.omitidas.sombreador++; return; }
    let geo, matriz = n.matrixWorld;
    if (hor) {
      geo = g.clone(); if (geo.attributes.color) geo.deleteAttribute('color'); geo.applyMatrix4(n.matrixWorld);
      geo = proyectarUVMundo(geo, det.scale, n.matrixWorld.determinant() < 0);
      matriz = new THREE.Matrix4();
      recursos.geometrias.push(geo);
    } else {
      geo = cacheGeo.get(g);
      if (!geo) { geo = g.clone(); if (geo.attributes.color) geo.deleteAttribute('color'); cacheGeo.set(g, geo); recursos.geometrias.push(geo); }
    }
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false; m.matrix.copy(matriz); m.matrixWorld.copy(matriz); m.name = n.name;
    escena.add(m);
    stats.mallas++; stats.triangulos += triangulosDe(geo);
  };
  const recorrer = n => {
    if (!n.visible) { stats.omitidas.ocultas++; return; }
    if (esExcluido(n, o.excluir)) { stats.omitidas.excluidas++; return; }
    if (n.isMesh) procesar(n);
    for (const c of n.children) recorrer(c);
  };
  recorrer(world);
  stats.materiales = recursos.materiales.length;
  stats.texturas = recursos.texturas.length;
  return {escena, recursos, stats};
}

function liberar(x) { try { if (x && typeof x.dispose === 'function') x.dispose(); } catch (e) { /* ya liberado */ } }
export function liberarEscenaRT(recursos) {
  if (!recursos) return;
  recursos.geometrias.forEach(liberar); recursos.materiales.forEach(liberar); recursos.texturas.forEach(liberar);
  recursos.geometrias.length = recursos.materiales.length = recursos.texturas.length = 0;
}

/**
 * Pasos de preparación que sólo usan CPU (se prueban en Node): fusiona la geometría, construye el BVH (SAH, 1 triángulo/hoja)
 * y rellena los uniformes del material de trazado. Si se pasa `rtRenderer` también sube las texturas (única parte con GPU).
 */
export function prepararDatosPT({ptm, escenaRT, luces, mapaLuz, mapaFondo, tamanoTextura = 1024, rtRenderer = null}) {
  const resultado = new PathTracingSceneGenerator().generate(escenaRT);   // síncrono: StaticGeometryGenerator + MeshBVH
  const {bvh, textures, materials} = resultado, geometry = bvh.geometry;
  ptm.bvh.updateFrom(bvh);
  ptm.attributesArray.updateFrom(geometry.attributes.normal, geometry.attributes.tangent, geometry.attributes.uv, geometry.attributes.color);
  ptm.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
  if (rtRenderer) ptm.textures.setTextures(rtRenderer, tamanoTextura, tamanoTextura, textures);
  ptm.materials.updateFrom(materials, textures);
  materials.forEach((mt, i) => { if (mt.userData && mt.userData.rtSinSombra) ptm.materials.setCastShadow(i, false); });
  ptm.lights.updateFrom(luces);
  ptm.envMapInfo.updateFrom(mapaLuz);
  if (mapaFondo) ptm.backgroundMap = mapaFondo;
  return {bvh, geometry, materials, textures, triangulos: geometry.index.count / 3};
}

/** Material de trazado con los parámetros de calidad aplicados (los defines se fijan antes de compilar para no recompilar). */
export function crearMaterialPT({rebotes = 4, rebotesTransmision = 8, filtroGlossy = 0.2, intensidadEntorno = 1, ortografica = false, conFondo = false}) {
  const ptm = new PhysicalPathTracingMaterial();
  ptm.bounces = rebotes; ptm.transmissiveBounces = rebotesTransmision; ptm.filterGlossyFactor = filtroGlossy; ptm.environmentIntensity = intensidadEntorno;
  ptm.setDefine('FEATURE_DOF', 0); ptm.setDefine('FEATURE_FOG', 0);
  ptm.setDefine('FEATURE_BACKGROUND_MAP', conFondo ? 1 : 0); ptm.setDefine('CAMERA_TYPE', ortografica ? 1 : 0);
  return ptm;
}

/** Comprobación rápida (usa el contexto del visor, no crea otro) de si el equipo puede ejecutar el trazador. */
export function comprobarSoporte(renderer) {
  try {
    const gl = renderer.getContext();
    if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return {ok: false, motivo: 'Este navegador o equipo no ofrece WebGL 2, necesario para el render por ray tracing.'};
    if (!gl.getExtension('EXT_color_buffer_float')) return {ok: false, motivo: 'La GPU no puede renderizar a texturas de coma flotante (EXT_color_buffer_float).'};
    if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096) return {ok: false, motivo: 'La GPU admite texturas de menos de 4096 px; el render por ray tracing no es viable.'};
    if (gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 16) return {ok: false, motivo: 'La GPU ofrece menos de 16 unidades de textura en el fragmento; el sombreador del trazador no cabe.'};
    return {ok: true, motivo: ''};
  } catch (e) { return {ok: false, motivo: 'No se pudo comprobar WebGL 2: ' + e.message}; }
}

/* ------------------------------------------------------------------------- */
/* Interfaz (capa superpuesta)                                                */
/* ------------------------------------------------------------------------- */

const CSS = `
.rt-overlay{position:absolute;inset:0;z-index:6;background:#0c1110;overflow:hidden;color:#f3f5f1;font:13px system-ui,sans-serif}
.rt-overlay[hidden]{display:none}
.rt-zona{position:absolute;inset:0}
.rt-zona canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.rt-progreso{position:absolute;left:0;top:0;height:3px;background:#e6a24a;width:0;transition:width .3s}
.rt-aviso{position:absolute;left:50%;top:22px;transform:translateX(-50%);max-width:min(560px,calc(100% - 28px));padding:10px 14px;border-radius:10px;background:#10171cee;border:1px solid #ffffff30;line-height:1.45;text-align:center}
.rt-aviso:empty{display:none}
.rt-barra{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;max-width:calc(100% - 20px);padding:10px 12px;border-radius:12px;background:#10171cdd;box-shadow:0 4px 18px #0006}
.rt-barra label{display:flex;align-items:center;gap:6px;color:#cfd8d2}
.rt-barra button,.rt-barra select{font:inherit;color:#fff;background:#1f2b31;border:1px solid #ffffff40;border-radius:8px;padding:7px 11px;cursor:pointer;width:auto;margin:0;text-align:center}
.rt-barra button:hover:not(:disabled){border-color:#e6a24a;background:#2a3a42}
.rt-barra button.rt-primario{background:#9c5100;border-color:#9c5100}
.rt-barra button:disabled,.rt-barra select:disabled{opacity:.45;cursor:default}
.rt-estado{min-width:230px;text-align:center;font-variant-numeric:tabular-nums}
@media(max-width:760px){.rt-estado{min-width:0;width:100%}}
`;

function inyectarEstilos() {
  if (document.getElementById('rt-estilos')) return;
  const s = document.createElement('style'); s.id = 'rt-estilos'; s.textContent = CSS; document.head.appendChild(s);
}

function crearUI(contenedor, manejadores) {
  inyectarEstilos();
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const raiz = el('div', 'rt-overlay'); raiz.hidden = true;
  raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-label', 'Render fotorrealista por ray tracing');
  const zona = el('div', 'rt-zona'), progreso = el('div', 'rt-progreso'), aviso = el('div', 'rt-aviso'), barra = el('div', 'rt-barra');
  aviso.setAttribute('role', 'status');
  const estado = el('span', 'rt-estado', ''); estado.setAttribute('aria-live', 'polite');
  const selector = (etiqueta, opciones, valor, alCambiar) => {
    const l = el('label'), s = el('select');
    for (const [v, t] of opciones) { const o = el('option', '', t); o.value = String(v); s.appendChild(o); }
    s.value = String(valor); s.onchange = () => alCambiar(s.value);
    l.append(etiqueta + ' ', s); return {l, s};
  };
  const escala = selector('Resolución', [['auto', 'Auto'], [0.25, '25 %'], [0.5, '50 %'], [0.75, '75 %'], [1, '100 %'], [1.5, '150 %']], 'auto', manejadores.escala);
  const rebotes = selector('Rebotes', [2, 3, 4, 5, 6, 8].map(n => [n, String(n)]), 4, v => manejadores.rebotes(Number(v)));
  const bDetener = el('button', '', 'Detener'), bGuardar = el('button', 'rt-primario', 'Guardar PNG'), bCerrar = el('button', '', 'Cerrar');
  bDetener.onclick = manejadores.detener; bGuardar.onclick = manejadores.guardar; bCerrar.onclick = manejadores.cerrar;
  barra.append(estado, escala.l, rebotes.l, bDetener, bGuardar, bCerrar);
  raiz.append(zona, progreso, aviso, barra);
  for (const t of ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'contextmenu', 'touchstart']) raiz.addEventListener(t, e => e.stopPropagation());
  contenedor.appendChild(raiz);
  let lienzo = null;
  return {
    raiz,
    ponerLienzo(c) { if (lienzo && lienzo.parentNode) lienzo.parentNode.removeChild(lienzo); lienzo = c; if (c) zona.appendChild(c); },
    quitarLienzo() { this.ponerLienzo(null); },
    estado(t) { estado.textContent = t; },
    aviso(t) { aviso.textContent = t || ''; },
    progreso(f) { progreso.style.width = Math.max(0, Math.min(1, f)) * 100 + '%'; },
    habilitar(a) { bDetener.disabled = !a.detener; bGuardar.disabled = !a.guardar; escala.s.disabled = rebotes.s.disabled = !a.ajustes; },
    mostrar() { raiz.hidden = false; },
    ocultar() { raiz.hidden = true; },
    visible() { return !raiz.hidden; },
    quitar() { if (raiz.parentNode) raiz.parentNode.removeChild(raiz); },
  };
}

const formatoTiempo = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const siguienteFrame = () => new Promise(r => { let hecho = false; const f = () => { if (!hecho) { hecho = true; r(); } }; requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 150); });

/* ------------------------------------------------------------------------- */
/* API principal                                                              */
/* ------------------------------------------------------------------------- */

/**
 * createRenderRT({renderer, scene, world, getCamera, sun, hemi, sky, onStatus, ...opciones})
 *  - renderer : WebGLRenderer del visor (sólo se leen sus ajustes de tono/color).
 *  - world    : Object3D con el modelo, o una función () => Object3D (recomendado: el visor recrea `world` al editar).
 *  - getCamera: () => cámara activa (perspectiva u ortográfica).
 *  - scene    : escena del visor; sólo se usa para localizar sun / hemi / sky si no se pasan.
 *  - sun / hemi / sky (opcionales): DirectionalLight del Sol, HemisphereLight y malla 'Cielo' (intensidades y colores).
 *  - onStatus : (texto) => void para mensajes breves (p. ej. message() del visor).
 * Devuelve {iniciar, detener, guardarPNG, isActive, cerrar, renderizando, soportado, configurar, dispose, info}.
 */
export function createRenderRT(cfg) {
  const opt = {...OPCIONES_POR_DEFECTO, ...cfg};
  const {renderer, getCamera} = cfg;
  const avisar = t => { try { if (cfg.onStatus) cfg.onStatus(t); } catch (e) { /* el visor decide */ } };
  // Aviso breve dentro de la capa (el #status del visor queda tapado por ella) + onStatus.
  let tAviso = 0;
  const notificar = t => { avisar(t); if (ui && estado !== 'error') { ui.aviso(t); clearTimeout(tAviso); tAviso = setTimeout(() => { if (ui && estado !== 'error') ui.aviso(''); }, 3500); } };
  const mundo = () => (typeof cfg.world === 'function' ? cfg.world() : cfg.world);
  // sun / hemi / sky se pueden omitir: se buscan en `scene` (DirectionalLight, HemisphereLight y malla llamada 'Cielo').
  const hijo = prueba => (cfg.scene && cfg.scene.children ? cfg.scene.children.find(prueba) : null) || null;
  const getSol = () => cfg.sun || hijo(o => o.isDirectionalLight), getHemi = () => cfg.hemi || hijo(o => o.isHemisphereLight);
  const getCielo = () => cfg.sky || (cfg.scene && cfg.scene.getObjectByName ? cfg.scene.getObjectByName('Cielo') : null);

  let estado = 'inactivo';      // inactivo | preparando | renderizando | detenido | error
  let sesion = 0, ui = null, info = null;
  let rt = null, glCanvas = null, ptr = null, ptm = null, quad = null, luzSol = null, escenaInfo = null;
  let texEntorno = [], liberando = false, raf = 0, imagenFinal = null;
  let cam = null, contSol = 0, t0 = 0, ultFrame = 0, emaFrame = 0, nFrames = 0, ultTexto = 0, muestrasHist = [], baseSol = new THREE.Vector3(), distSol = 700, objetivoSol = new THREE.Vector3();
  let tResize = 0;

  const contenedor = () => opt.contenedor || renderer.domElement.parentElement || document.body;
  const soportado = () => comprobarSoporte(renderer);

  /* ---- cámara y tamaño ---- */
  function copiarCamara(aspecto) {
    const src = getCamera(); src.updateMatrixWorld(true);
    const c = src.clone(); c.matrixAutoUpdate = true;
    if (c.isPerspectiveCamera) c.aspect = aspecto;
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    return c;
  }
  function medir() {
    const cont = contenedor(), maxLado = Math.min(rt ? rt.capabilities.maxTextureSize : 4096, 4096);
    return calcularTamano(cont.clientWidth, cont.clientHeight, opt.escala, opt.pixelesAuto, maxLado);
  }
  function aplicarTamano() {
    const t = medir(), tiles = opt.teselas || elegirTeselas(t.w, t.h);
    rt.setSize(t.w, t.h, false);
    cam = copiarCamara(t.w / t.h);
    ptr.camera = cam;
    ptr.tiles.set(tiles[0], tiles[1]);
    ptr.setSize(t.w, t.h);
    ptr.reset();
    reiniciarContadores();
    return t;
  }
  function reiniciarContadores() { contSol = 0; t0 = performance.now(); ultFrame = 0; emaFrame = 0; nFrames = 0; muestrasHist = []; }

  /* ---- Sol: la dirección se difumina en cada llamada de dibujo ---- */
  function prepararSol() {
    const sun = getSol();
    if (!sun || sun.visible === false || !(sun.intensity > 0)) return [];
    sun.updateWorldMatrix(true, false); sun.target.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3().setFromMatrixPosition(sun.matrixWorld), obj = new THREE.Vector3().setFromMatrixPosition(sun.target.matrixWorld);
    objetivoSol.copy(obj); baseSol.subVectors(pos, obj); distSol = Math.max(baseSol.length(), 1); baseSol.normalize();
    luzSol = new THREE.DirectionalLight(sun.color.clone(), sun.intensity * opt.intensidadSol);
    luzSol.position.copy(pos); luzSol.target.position.copy(obj);
    luzSol.updateMatrixWorld(true); luzSol.target.updateMatrixWorld(true);
    return [luzSol];
  }
  const dirTmp = new THREE.Vector3();
  function actualizarSol() {
    if (!luzSol || !(opt.anguloSol > 0)) return;
    direccionSolDifusa(baseSol, THREE.MathUtils.degToRad(opt.anguloSol), contSol++, dirTmp);
    luzSol.position.copy(objetivoSol).addScaledVector(dirTmp, distSol);
    luzSol.updateMatrixWorld(true);
    ptm.lights.updateFrom([luzSol]);
  }

  /* ---- ciclo de vida de los recursos de GPU ---- */
  function liberarGPU() {
    liberando = true;
    cancelAnimationFrame(raf); raf = 0;
    if (glCanvas) { glCanvas.removeEventListener('webglcontextlost', alPerderContexto); }
    if (quad) { liberar(quad.material); }
    liberar(ptr);   // targets, mapa de Sobol y quads internos
    if (ptm) {
      for (const k of ['bvh', 'materials', 'textures', 'attributesArray', 'materialIndexAttribute', 'envMapInfo', 'iesProfiles', 'stratifiedTexture', 'stratifiedOffsetTexture']) liberar(ptm[k]);
      liberar(ptm.lights && ptm.lights.tex);
      liberar(ptm);
    }
    texEntorno.forEach(liberar); texEntorno = [];
    if (escenaInfo) { liberarEscenaRT(escenaInfo.recursos); escenaInfo = null; }
    if (rt) { try { rt.dispose(); rt.forceContextLoss(); } catch (e) { /* contexto ya perdido */ } }
    if (glCanvas) { glCanvas.width = glCanvas.height = 1; if (glCanvas.parentNode) glCanvas.parentNode.removeChild(glCanvas); }
    rt = glCanvas = ptr = ptm = quad = luzSol = cam = null;
    liberando = false;
  }
  function alPerderContexto(e) {
    if (liberando) return;
    e.preventDefault();
    const m = 'La GPU reinició el contexto WebGL (la escena o la resolución es demasiado exigente). Baja la resolución y vuelve a intentarlo.';
    liberarGPU(); estado = 'error';
    if (ui) { ui.aviso(m); ui.estado('Contexto perdido'); ui.habilitar({detener: false, guardar: !!imagenFinal, ajustes: false}); }
    avisar(m);
  }

  /* ---- bucle de acumulación ---- */
  function bucle(ahora) {
    if (estado !== 'renderizando' || !ptr) return;
    raf = requestAnimationFrame(bucle);
    const nt = ptr.tiles.x * ptr.tiles.y;
    for (let i = 0; i < nt; i++) { actualizarSol(); ptr.update(); }      // una muestra completa por fotograma
    quad.material.map = ptr.target.texture;
    quad.render(rt);
    // watchdog: si un fotograma tarda demasiado se subdivide más (sólo entre muestras completas)
    if (ultFrame && ++nFrames > 3) { const d = ahora - ultFrame; if (d < 3000) emaFrame = emaFrame ? emaFrame * 0.8 + d * 0.2 : d; }
    ultFrame = ahora;
    if (emaFrame > 900 && Number.isInteger(ptr.samples) && ptr.tiles.x < 8) { ptr.tiles.set(ptr.tiles.x + 1, ptr.tiles.y + 1); emaFrame = 0; }
    const muestras = Math.floor(ptr.samples);
    if (ahora - ultTexto > 250) {
      ultTexto = ahora;
      muestrasHist.push([ahora, ptr.samples]); while (muestrasHist.length > 1 && ahora - muestrasHist[0][0] > 3000) muestrasHist.shift();
      const h = muestrasHist[0], v = muestrasHist.length > 1 ? (ptr.samples - h[1]) / ((ahora - h[0]) / 1000) : 0;
      ui.estado('Muestras: ' + muestras + (opt.muestrasMax ? ' / ' + opt.muestrasMax : '') + ' · ' + v.toFixed(1) + ' /s · ' + formatoTiempo((ahora - t0) / 1000));
      ui.progreso(opt.muestrasMax ? ptr.samples / opt.muestrasMax : 0);
    }
    if (opt.muestrasMax > 0 && muestras >= opt.muestrasMax) congelar('Render completo');
  }

  /** Copia el último fotograma a un canvas 2D, libera la GPU y deja la imagen visible (se puede guardar). */
  function congelar(titulo) {
    if (estado !== 'renderizando') return;
    let img = null, muestras = 0;
    try {
      muestras = Math.floor(ptr.samples);
      quad.material.map = ptr.target.texture; quad.render(rt);
      img = document.createElement('canvas'); img.width = glCanvas.width; img.height = glCanvas.height;
      img.getContext('2d').drawImage(glCanvas, 0, 0);
    } catch (e) { img = null; }
    const seg = (performance.now() - t0) / 1000;
    liberarGPU();
    imagenFinal = img ? {lienzo: img, muestras} : null;
    estado = 'detenido';
    if (img) ui.ponerLienzo(img);
    ui.estado((titulo || 'Detenido') + ' · ' + muestras + ' muestras · ' + formatoTiempo(seg));
    ui.progreso(1); ui.habilitar({detener: false, guardar: !!img, ajustes: false});
    ui.aviso(img ? '' : 'No se pudo conservar la imagen.');
    avisar((titulo || 'Render detenido') + ': ' + muestras + ' muestras. Guarda el PNG o cierra la vista.');
  }

  /* ---- operaciones públicas ---- */
  async function iniciar() {
    if (estado === 'preparando') return false;
    if (estado === 'renderizando') { liberarGPU(); }
    else if (estado === 'detenido' || estado === 'error') { liberarGPU(); }
    imagenFinal = null;
    const token = ++sesion;
    const cancelado = () => token !== sesion;
    const sop = soportado();
    if (!sop.ok) { avisar('Render fotorrealista no disponible: ' + sop.motivo); if (ui && ui.visible()) { ui.aviso(sop.motivo); ui.estado('No disponible'); } return false; }
    if (!ui) ui = crearUI(contenedor(), {escala: v => cambiarEscala(v), rebotes: n => cambiarRebotes(n), detener: () => detener(), guardar: () => { guardarPNG().catch(e => avisar('No se pudo guardar el PNG: ' + e.message)); }, cerrar: () => cerrar()});
    ui.quitarLienzo(); ui.mostrar(); ui.aviso(''); ui.progreso(0); ui.habilitar({detener: true, guardar: false, ajustes: false});
    estado = 'preparando';
    window.addEventListener('resize', alCambiarVentana); document.addEventListener('keydown', alTeclear);
    const paso = async t => { ui.estado(t); await siguienteFrame(); if (cancelado()) throw Object.assign(new Error('cancelado'), {cancelado: true}); };
    try {
      await paso('Preparando escena…');
      // 1) segundo renderer en su propio canvas
      glCanvas = document.createElement('canvas');
      glCanvas.addEventListener('webglcontextlost', alPerderContexto);
      ui.ponerLienzo(glCanvas);
      rt = new THREE.WebGLRenderer({canvas: glCanvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true});
      rt.setPixelRatio(1); rt.setClearColor(0x000000, 1);
      rt.outputColorSpace = renderer.outputColorSpace; rt.toneMapping = renderer.toneMapping; rt.toneMappingExposure = renderer.toneMappingExposure;
      const mezclaF32 = rt.extensions.get('EXT_float_blend'), linealF32 = rt.extensions.get('OES_texture_float_linear');
      if (linealF32 && !mezclaF32) throw Object.assign(new Error('la GPU filtra texturas float32 pero no admite mezcla en float32 (EXT_float_blend).'), {soporte: true});
      // 2) escena temporal (copia plana del modelo)
      await paso('Convirtiendo el modelo (geometría y materiales)…');
      escenaInfo = construirEscenaRT(mundo(), opt);
      if (escenaInfo.stats.mallas === 0) throw new Error('No hay geometría visible para trazar.');
      // 3) entorno, Sol y cámara
      const hem = coloresHemisferio(getHemi(), opt.intensidadAmbiente) || {cielo: [0.55, 0.62, 0.72], suelo: [0.12, 0.16, 0.12], eje: new THREE.Vector3(0, 1, 0)};
      let mapaLuz = opt.entorno, mapaFondo = opt.fondo;
      if (!mapaLuz) { mapaLuz = crearEntornoHemisferio(hem); texEntorno.push(mapaLuz); }
      if (!mapaFondo && !opt.entorno) { const cc = coloresCielo(getCielo()); if (cc) { mapaFondo = crearFondoCielo(cc); texEntorno.push(mapaFondo); } }
      const luces = prepararSol();
      const t = aplicarTamanoInicial();
      // 4) material de trazado + comprobación de compatibilidad (compila el sombreador: puede tardar varios segundos)
      await paso('Compilando el sombreador de trazado (puede tardar unos segundos)…');
      ptm = crearMaterialPT({rebotes: opt.rebotes, rebotesTransmision: opt.rebotesTransmision, filtroGlossy: opt.filtroGlossy, ortografica: cam.projectionMatrix.elements[15] > 0, conFondo: !!mapaFondo});
      if (mapaFondo) ptm.backgroundMap = mapaFondo;
      rt.setRenderTarget(ptr.target);   // compila con el mismo objetivo que el trazado real: un solo sombreador
      let compat; try { compat = new CompatibilityDetector(rt, ptm).detect(); } finally { rt.setRenderTarget(null); }
      if (!compat.pass) throw Object.assign(new Error(compat.message || 'Dispositivo no compatible'), {soporte: true});
      await paso('Construyendo la estructura de aceleración (BVH)…');
      const prep = prepararDatosPT({ptm, escenaRT: escenaInfo.escena, luces, mapaLuz, mapaFondo, tamanoTextura: opt.tamanoTextura, rtRenderer: rt});
      info = {...escenaInfo.stats, triangulosBVH: prep.triangulos, ancho: t.w, alto: t.h, tiles: ptr.tiles.toArray ? ptr.tiles.toArray() : [ptr.tiles.x, ptr.tiles.y]};
      // Todo (BVH, atributos, materiales, texturas) ya vive en texturas de GPU: se suelta la escena temporal (CPU y las copias de textura).
      liberarEscenaRT(escenaInfo.recursos); escenaInfo.escena.clear();
      // 5) arrancar
      ptr.material = ptm;
      quad = new FullScreenQuad(new THREE.MeshBasicMaterial({map: ptr.target.texture}));
      ptr.reset(); reiniciarContadores();
      estado = 'renderizando'; ultTexto = 0;
      ui.aviso(''); ui.habilitar({detener: true, guardar: true, ajustes: true});
      avisar('Render por ray tracing en curso: ' + info.triangulosBVH + ' triángulos, ' + t.w + '×' + t.h + ' px.');
      raf = requestAnimationFrame(bucle);
      return true;
    } catch (e) {
      if (e.cancelado) return false;
      const msg = (e.soporte ? 'Este equipo no puede ejecutar el render por ray tracing: ' : 'No se pudo iniciar el render por ray tracing: ') + e.message;
      liberarGPU(); estado = 'error';
      ui.aviso(msg); ui.estado('Error'); ui.habilitar({detener: false, guardar: false, ajustes: false});
      avisar(msg); console.error('[render-rt]', e);
      return false;
    }
  }

  // El renderer PT y el PathTracingRenderer deben existir antes de medir; se crean aquí y aplicarTamano() los dimensiona.
  function aplicarTamanoInicial() {
    ptr = new PathTracingRenderer(rt);
    ptr.alpha = false; ptr.stableNoise = false;
    return aplicarTamano();
  }

  function alCambiarVentana() {
    if (estado !== 'renderizando') return;
    clearTimeout(tResize); tResize = setTimeout(() => { if (estado === 'renderizando') aplicarTamano(); }, 250);
  }
  function alTeclear(e) { if (e.key === 'Escape' && ui && ui.visible()) { e.preventDefault(); cerrar(); } }
  function cambiarEscala(v) { opt.escala = v === 'auto' ? 'auto' : Number(v); if (estado === 'renderizando') aplicarTamano(); }
  function cambiarRebotes(n) { opt.rebotes = n; if (estado === 'renderizando') { ptm.bounces = n; ptr.reset(); reiniciarContadores(); } }

  /** Detiene la acumulación, conserva la imagen y libera TODA la GPU. Durante la preparación cancela y cierra. */
  function detener() {
    if (estado === 'renderizando') { congelar('Detenido'); return; }
    if (estado === 'preparando') { sesion++; cerrar(); }
  }

  /** Cierra la capa (y libera todo si aún hay recursos). */
  function cerrar() {
    sesion++;
    clearTimeout(tResize);
    window.removeEventListener('resize', alCambiarVentana); document.removeEventListener('keydown', alTeclear);
    liberarGPU(); imagenFinal = null; estado = 'inactivo';
    if (ui) { ui.quitarLienzo(); ui.ocultar(); ui.aviso(''); }
  }

  /** Guarda un PNG de la imagen actual (en curso o congelada). Devuelve el Blob o null. */
  async function guardarPNG() {
    let fuente = null, muestras = 0;
    if (estado === 'renderizando' && glCanvas && ptr) { muestras = Math.floor(ptr.samples); quad.material.map = ptr.target.texture; quad.render(rt); fuente = glCanvas; }
    else if (imagenFinal) { fuente = imagenFinal.lienzo; muestras = imagenFinal.muestras; }
    if (!fuente || muestras < 1) { notificar('Todavía no hay imagen que guardar: espera a la primera muestra.'); return null; }
    const c = document.createElement('canvas'); c.width = fuente.width; c.height = fuente.height;
    const ctx = c.getContext('2d'); ctx.drawImage(fuente, 0, 0);
    if (opt.pie) {
      const f = Math.max(1, c.width / 1280), texto = typeof opt.pie === 'string' ? opt.pie : 'UAM Cuajimalpa · Render por ray tracing · ' + muestras + ' muestras';
      ctx.save(); ctx.textAlign = 'left'; ctx.font = (12 * f) + 'px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3 * f;
      ctx.fillText(texto, 18 * f, c.height - 18 * f); ctx.restore();
    }
    try { if (opt.dibujarMarca) opt.dibujarMarca(ctx, c); } catch (e) { console.error('[render-rt] dibujarMarca', e); }
    const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo crear el PNG.'))), 'image/png'));
    try {
      if (opt.guardar) await opt.guardar(blob, opt.nombreArchivo);
      else { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = opt.nombreArchivo; a.click(); setTimeout(() => URL.revokeObjectURL(url), 6000); }
      notificar('Imagen del render guardada (' + muestras + ' muestras).');
    } catch (e) { notificar('No se pudo guardar el PNG: ' + e.message); }
    return blob;
  }

  function dispose() { cerrar(); if (ui) { ui.quitar(); ui = null; } }

  return {
    iniciar, detener, guardarPNG, cerrar, dispose, soportado,
    isActive: () => estado !== 'inactivo',          // la capa está visible (preparando, renderizando, detenido o con error)
    renderizando: () => estado === 'renderizando',
    estado: () => estado,
    info: () => info,
    configurar(o) { Object.assign(opt, o); },
  };
}

/** Utilidades internas expuestas sólo para pruebas. */
export const _utils = {
  esExcluido, crearTexturaEquirect, coloresHemisferio, crearEntornoHemisferio, coloresCielo, colorDeCielo, crearFondoCielo, direccionSolDifusa,
  elegirTeselas, calcularTamano, hornearDetalle, proyectarUVMundo, infoDetalle, convertirMaterial, construirEscenaRT, liberarEscenaRT,
  prepararDatosPT, crearMaterialPT, comprobarSoporte, leerPixelesTextura, promedioDetalle,
};
