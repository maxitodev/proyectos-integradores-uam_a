// efectos-solar.js · Matemática pura del sol, paleta de luz por hora y color del cielo (sin three, sin DOM).
// Se importa desde efectos.js y también desde node (prueba-headless.mjs). Unidades: grados, horas locales, metros.
// Convención de la escena: +X = este, -Z = norte, +Y = arriba (como campusNorth() de app.js con georreferencia ≈ norte arriba).

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const lim = (x, a, b) => Math.min(b, Math.max(a, x));
const mezcla = (a, b, t) => a + (b - a) * t;
/** smoothstep clásico; si a>b la curva queda invertida (1 en x<=a, 0 en x>=b). */
export const suave = (a, b, x) => { const t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ───────────────────────── Sol ─────────────────────────
/** UAM Cuajimalpa, 22 de octubre (día 295), huso UTC−6 (CST; México ya no usa horario de verano). */
export const SITIO = {lat: 19.352, lon: -99.283, meridiano: -90, dia: 295};

/** Declinación solar (°) para el día del año N (1 = 1 de enero). Octubre 22 → ≈ −11.1°. */
export function declinacionSolar(dia) {
  const a = (0.98565 * (dia + 10) + 1.914 * Math.sin(0.98565 * (dia - 2) * RAD)) * RAD;
  return -Math.asin(0.39779 * Math.cos(a)) * DEG;
}
/** Ecuación del tiempo (minutos, positivo = el sol va adelantado al reloj). 22 oct → ≈ +15.9 min. */
export function ecuacionDelTiempo(dia) {
  const B = 360 / 365 * (dia - 81) * RAD;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * Posición del sol para una hora de reloj local (p. ej. 14.5 = 14:30).
 * opciones: {lat, lon, meridiano, dia, declinacion(°), ecuacionTiempo(min), desfaseAcimut(°)}.
 * Devuelve elevación (°, negativa bajo el horizonte) y acimut (° desde el norte hacia el este: 90 E, 180 S, 270 O).
 */
export function posicionSolar(hora, opciones = {}) {
  const {lat = SITIO.lat, lon = SITIO.lon, meridiano = SITIO.meridiano, dia = SITIO.dia, desfaseAcimut = 0} = opciones;
  const declinacion = opciones.declinacion ?? declinacionSolar(dia);
  const eot = opciones.ecuacionTiempo ?? ecuacionDelTiempo(dia);
  const horaSolar = hora + (lon - meridiano) / 15 + eot / 60;           // lon al oeste del meridiano del huso → sol atrasado
  const H = (horaSolar - 12) * 15 * RAD, phi = lat * RAD, d = declinacion * RAD;
  const elevacion = Math.asin(lim(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H), -1, 1)) * DEG;
  const desdeSur = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) * DEG; // 0 = sur, + hacia el oeste
  const acimut = (((180 + desdeSur + desfaseAcimut) % 360) + 360) % 360;
  return {elevacion, acimut, declinacion, horaSolar, anguloHorario: H * DEG};
}

/** Hora de reloj del mediodía solar (para documentar y para pruebas). */
export function mediodiaSolar(opciones = {}) {
  const {lon = SITIO.lon, meridiano = SITIO.meridiano, dia = SITIO.dia} = opciones;
  return 12 - (lon - meridiano) / 15 - (opciones.ecuacionTiempo ?? ecuacionDelTiempo(dia)) / 60;
}

/**
 * Dirección unitaria hacia el sol en ejes de la escena.
 * norte = {x,z}: vector unitario del norte geográfico en el plano XZ de la escena (por omisión (0,-1)).
 */
export function direccionSolar(elevacion, acimut, norte = {x: 0, z: -1}) {
  const n = Math.hypot(norte.x, norte.z) || 1, nx = norte.x / n, nz = norte.z / n;
  const ex = -nz, ez = nx;                                              // este = norte girado 90° a la derecha visto desde arriba
  const e = elevacion * RAD, a = acimut * RAD, h = Math.cos(e);
  return {x: h * (Math.cos(a) * nx + Math.sin(a) * ex), y: Math.sin(e), z: h * (Math.cos(a) * nz + Math.sin(a) * ez)};
}

// ───────────────────────── Paleta de luz por elevación ─────────────────────────
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const mezclaRGB = (a, b, t) => a.map((v, i) => mezcla(v, b[i], t));
/** Luminancia aproximada (sRGB codificado) para desaturar sin cambiar el brillo. */
const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const gris = (c, t) => { const l = luma(c); return mezclaRGB(c, [l, l, l], t); };

// Cada fila: elevación solar, color y fuerza del sol, hemisférica (cielo, suelo, fuerza), exposición.
// La fila de 45° reproduce la iluminación original del visor (sol #ffeccb 3.3, hemisférica #fff6e6/#4b6750 2.3, exposición 1.15).
const FILAS = [
  //  el   solColor    solInt  hemiCielo   hemiSuelo   hemiInt  expo
  [-18, '#ff6a3a', 0.00, '#1d2a52', '#0b1120', 0.55, 1.80],
  [-9, '#ff6a3a', 0.00, '#24335e', '#0d1323', 0.60, 1.75],
  [-3, '#ff6a3a', 0.00, '#46537f', '#192031', 0.85, 1.55],
  [0, '#ff7e3e', 0.55, '#b48a8c', '#2c322f', 1.15, 1.38],
  [3, '#ff9550', 1.20, '#e0b39a', '#37433a', 1.45, 1.30],
  [7, '#ffae68', 1.85, '#f4cfae', '#42553d', 1.75, 1.24],
  [14, '#ffcb8d', 2.55, '#fbe3c9', '#4a6148', 2.00, 1.19],
  [25, '#ffe0b6', 3.05, '#fff0da', '#4b6750', 2.20, 1.15],
  [45, '#ffeccb', 3.30, '#fff6e6', '#4b6750', 2.30, 1.15],
  [90, '#fff2d8', 3.40, '#fff8ee', '#4b6750', 2.35, 1.15],
].map(f => ({el: f[0], solColor: hex(f[1]), solInt: f[2], hemiCielo: hex(f[3]), hemiSuelo: hex(f[4]), hemiInt: f[5], expo: f[6]}));

function tramo(filas, el) {
  if (el <= filas[0].el) return [filas[0], filas[0], 0];
  const u = filas[filas.length - 1];
  if (el >= u.el) return [u, u, 0];
  let i = 1; while (filas[i].el < el) i++;
  return [filas[i - 1], filas[i], (el - filas[i - 1].el) / (filas[i].el - filas[i - 1].el)];
}

/** Luz de «luna» de relleno (sol por debajo de −3°): azulada y tenue, aparece entre −3° y −9°. */
export const LUNA = {color: hex('#9db4ff'), intensidad: 0.24, elevacion: 50, acimut: 135};

/**
 * Parámetros de luz para una elevación solar y una nubosidad 0..1.
 * Devuelve colores como [r,g,b] sRGB 0..1 (usar Color.setRGB(r,g,b,SRGBColorSpace) en three).
 * `luna` = true cuando la luz direccional representa a la luna (el integrador puede encender las luminarias con `noche`).
 */
export function paletaLuz(el, nublado = 0) {
  const [a, b, t] = tramo(FILAS, el);
  const m = (k) => mezcla(a[k], b[k], t), mc = (k) => mezclaRGB(a[k], b[k], t);
  const luna = el < -3, fLuna = luna ? 1 - suave(-9, -3, el) : 0;
  let solColor = luna ? LUNA.color : mc('solColor'), solInt = luna ? LUNA.intensidad * fLuna : m('solInt');
  let hemiCielo = mc('hemiCielo'), hemiSuelo = mc('hemiSuelo'), hemiInt = m('hemiInt'), expo = m('expo');
  const c = lim(nublado, 0, 1);
  if (c > 0) {                                     // cielo cubierto: poca luz directa, mucha difusa y más gris
    solInt *= 1 - 0.85 * c; solColor = gris(solColor, 0.7 * c);
    hemiInt *= 1 + 0.15 * c; hemiCielo = gris(hemiCielo, 0.6 * c); hemiSuelo = gris(hemiSuelo, 0.3 * c);
    expo *= 1 + 0.10 * c * suave(-6, 10, el);
  }
  // fuerza de oscuridad para luminarias/ambiente (0 de día, 1 de noche cerrada); 0.5 ≈ sol a −3°
  const noche = 1 - suave(-9, 4, el);
  return {solColor, solInt, hemiCielo, hemiSuelo, hemiInt, expo, luna, noche};
}

// ───────────────────────── Parámetros del cielo de Preetham (Sky de three) ─────────────────────────
// Filas: elevación, turbidez, rayleigh, mie, g de mie, ganancia (multiplica la radiancia antes del mapeo tonal), saturación, tinte RGB.
// Valores base de despejado; el nublado los acerca a un gris lechoso (turbidez alta, rayleigh bajo).
// Ganancia, saturación y tinte son un «grado de color» propio: el shader original de Preetham sale pálido con ACES a exposición 1.15.
const CIELO = [
  [-18, 2.0, 1.0, 0.005, 0.80, 0.100, 1.0, [0.35, 0.70, 1.70]],
  [-9, 2.0, 1.0, 0.005, 0.80, 0.110, 1.0, [0.35, 0.70, 1.70]],
  [-4, 3.0, 1.4, 0.005, 0.78, 0.200, 1.2, [0.60, 0.80, 1.30]],
  [0, 6.0, 2.0, 0.005, 0.76, 0.360, 1.4, [0.95, 0.92, 1]],
  [4, 6.0, 2.0, 0.005, 0.76, 0.420, 1.5, [0.90, 0.86, 1]],
  [12, 3.5, 1.4, 0.005, 0.78, 0.440, 1.7, [0.85, 0.80, 1]],
  [30, 2.5, 1.1, 0.005, 0.80, 0.440, 1.8, [0.83, 0.78, 1]],
  [90, 2.0, 1.0, 0.005, 0.80, 0.440, 1.8, [0.82, 0.77, 1]],
].map(f => ({el: f[0], turbidity: f[1], rayleigh: f[2], mieCoefficient: f[3], mieDirectionalG: f[4], ganancia: f[5], saturacion: f[6], tinte: f[7]}));

export function parametrosCielo(el, nublado = 0) {
  const [a, b, t] = tramo(CIELO, el);
  const n = k => mezcla(a[k], b[k], t);
  const p = {turbidity: n('turbidity'), rayleigh: n('rayleigh'), mieCoefficient: n('mieCoefficient'), mieDirectionalG: n('mieDirectionalG'),
    ganancia: n('ganancia'), saturacion: n('saturacion'), tinte: a.tinte.map((v, i) => mezcla(v, b.tinte[i], t)), disco: 1};
  const c = lim(nublado, 0, 1);
  if (c > 0) {
    const dia = suave(-6, 8, el);                   // de noche el nublado casi no cambia el cielo
    p.turbidity = mezcla(p.turbidity, 18, c * dia); p.rayleigh = mezcla(p.rayleigh, 0.45, c * dia);
    p.mieCoefficient = mezcla(p.mieCoefficient, 0.035, c * dia); p.mieDirectionalG = mezcla(p.mieDirectionalG, 0.62, c * dia);
    p.ganancia *= mezcla(1, 0.80, c * dia); p.saturacion = mezcla(p.saturacion, 0.65, c * dia);
    p.tinte = p.tinte.map((v, i) => mezcla(v, [0.97, 1, 1.03][i], c * dia));
    p.disco = 1 - suave(0.1, 0.65, c);              // el disco solar desaparece con el cielo cubierto
  }
  return p;
}

// ───────────────────────── Réplica en JS del shader de Sky (r160) ─────────────────────────
// Sirve para derivar el color de niebla del horizonte y para validar los tonos sin WebGL.
const TOTAL_RAYLEIGH = [5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5];
const MIE_CONST = [1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14];
const intensidadSolar = (cosZenit) => 1000 * Math.max(0, 1 - Math.pow(Math.E, -((1.6110731556870734 - Math.acos(lim(cosZenit, -1, 1))) / 1.5)));

/** Radiancia lineal (antes del mapeo tonal) del cielo en la dirección `dir` con el sol en `sol` (ambos unitarios, Y arriba). */
export function radianciaCielo(dir, sol, p, conDisco = true) {
  const sunE = intensidadSolar(sol.y);
  const sunfade = 1 - lim(1 - Math.exp(sol.y / 450000), 0, 1);
  const rayleighCoef = p.rayleigh - (1 - sunfade), c = (0.2 * p.turbidity) * 10e-18;
  const betaR = TOTAL_RAYLEIGH.map(v => v * rayleighCoef), betaM = MIE_CONST.map(v => 0.434 * c * v * p.mieCoefficient);
  const zenit = Math.acos(Math.max(0, dir.y));
  const inverso = 1 / (Math.cos(zenit) + 0.15 * Math.pow(93.885 - zenit * 180 / Math.PI, -1.253));
  const sR = 8.4E3 * inverso, sM = 1.25E3 * inverso;
  const cosT = dir.x * sol.x + dir.y * sol.y + dir.z * sol.z;
  const rFase = 0.05968310365946075 * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
  const g2 = p.mieDirectionalG ** 2, mFase = 0.07957747154594767 * ((1 - g2) / Math.pow(1 - 2 * p.mieDirectionalG * cosT + g2, 1.5));
  const mezclaSol = lim(Math.pow(1 - sol.y, 5), 0, 1);
  const disco = conDisco ? (cosT > 0.99995667 ? 1 : 0) * p.disco : 0;
  const rc = [0, 1, 2].map(i => {
    const fex = Math.exp(-(betaR[i] * sR + betaM[i] * sM));
    const rel = sunE * ((betaR[i] * rFase + betaM[i] * mFase) / (betaR[i] + betaM[i]));
    let lin = Math.pow(rel * (1 - fex), 1.5);
    lin *= mezcla(1, Math.pow(rel * fex, 0.5), mezclaSol);
    const l0 = 0.1 * fex + sunE * 19000 * fex * disco;
    const tex = (lin + l0) * 0.04 + [0, 0.0003, 0.00075][i];
    return Math.pow(tex, 1 / (1.2 + 1.2 * sunfade)) * p.ganancia;
  });
  // Grado de color idéntico al del shader parcheado en efectos.js: saturación respecto a la luminancia, tinte y tope anti-destello.
  const lum = 0.2126 * rc[0] + 0.7152 * rc[1] + 0.0722 * rc[2];
  return rc.map((v, i) => Math.min(Math.max(mezcla(lum, v, p.saturacion), 0) * p.tinte[i], 12));
}

/** Color medio del horizonte (lineal, antes del mapeo tonal): promedio de 12 acimutes a 0° de elevación. */
export function colorHorizonte(sol, p) {
  const acc = [0, 0, 0], N = 12;
  for (let k = 0; k < N; k++) {
    const a = k / N * 2 * Math.PI, r = radianciaCielo({x: Math.cos(a), y: 0, z: Math.sin(a)}, sol, p, false);
    for (let i = 0; i < 3; i++) acc[i] += r[i] / N;
  }
  return acc;
}

// ───────────────────────── Color: ACES y sRGB (misma fórmula que three r160) ─────────────────────────
const ajusteACES = v => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
/** Mapeo tonal ACES Filmic de three (entrada lineal, salida lineal de pantalla 0..1). */
export function acesFilmic(c, exposicion) {
  const k = exposicion / 0.6, r = c[0] * k, g = c[1] * k, b = c[2] * k;
  const x = ajusteACES(0.59719 * r + 0.35458 * g + 0.04823 * b), y = ajusteACES(0.07600 * r + 0.90834 * g + 0.01566 * b), z = ajusteACES(0.02840 * r + 0.13383 * g + 0.83777 * b);
  return [1.60475 * x - 0.53108 * y - 0.07367 * z, -0.10208 * x + 1.10813 * y - 0.00605 * z, -0.00327 * x - 0.07276 * y + 1.07602 * z].map(v => lim(v, 0, 1));
}
export const linealASrgb = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
export const srgbALineal = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
export const aHex = (srgb) => '#' + srgb.map(v => Math.round(lim(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');

/**
 * Color de niebla [r,g,b] en el espacio de trabajo lineal de three (valor para fog.color).
 *  · con efectos (el render va a un buffer lineal y el mapeo tonal ocurre después): la niebla es la radiancia tal cual;
 *  · sin efectos (three mezcla la niebla ya mapeada y en sRGB): hay que pasarle el color tras el mapeo tonal.
 * `horizonte` = colorHorizonte(); así la niebla coincide con el cielo de fondo en ambos caminos.
 */
export function colorNiebla(horizonte, exposicion, conPost, nublado = 0) {
  const l0 = luma(horizonte), neutro = mezclaRGB(horizonte, [l0, l0, l0], 0.3 + 0.3 * lim(nublado, 0, 1)); // la media de acimutes sale muy teñida
  return conPost ? neutro : acesFilmic(neutro, exposicion);
}

/** «H:MM» a partir de horas decimales (14.5 → «14:30»). */
export function formatoHora(h) {
  const t = Math.round(((h % 24) + 24) % 24 * 60), hh = Math.floor(t / 60) % 24, mm = t % 60;
  return hh + ':' + String(mm).padStart(2, '0');
}

// ───────────────────────── Sky: parche de color ─────────────────────────
// Tres cambios mínimos al fragmento de Sky (r160): disco solar apagable, ganancia/saturación/tinte antes del mapeo tonal y tope anti-destello.
// El shader de Preetham sale pálido con ACES a exposición 1.15 y casi gris de noche; este «grado de color» lo corrige sin tocar vendor/Sky.js.
const GRADO_COLOR = 'vec3 sc = retColor * uGanancia;\n float lum = dot( sc, vec3( 0.2126, 0.7152, 0.0722 ) );\n sc = max( mix( vec3( lum ), sc, uSaturacion ), vec3( 0.0 ) ) * uTinte;\n gl_FragColor = vec4( min( sc, vec3( 12.0 ) ), 1.0 );';
/** Aplica el parche a la fuente GLSL; `fallos` lista las cadenas que no se encontraron (otra versión de three). Exportado para pruebas. */
export function parchearFragmentoCielo(src) {
  const fallos = [];
  const cambiar = (buscar, poner) => { if (src.includes(buscar)) src = src.replace(buscar, () => poner); else fallos.push(buscar); };
  cambiar('uniform float mieDirectionalG;', 'uniform float mieDirectionalG;\nuniform float uGanancia;\nuniform float uSaturacion;\nuniform float uDisco;\nuniform vec3 uTinte;');
  cambiar('L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', 'L0 += ( vSunE * 19000.0 * Fex ) * sundisk * uDisco;');
  cambiar('gl_FragColor = vec4( retColor, 1.0 );', GRADO_COLOR);
  return {src, fallos};
}

export {hex as hexARGB, mezclaRGB, gris, lim, mezcla};
