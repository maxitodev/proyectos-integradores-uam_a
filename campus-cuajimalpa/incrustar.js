// Datos incrustados en Visor_UAM_autonomo.html para abrirlo con doble clic (file://), sin Node.js.
// Un solo formato para build.mjs y server.mjs (Node) y para app.js (navegador, al Guardar en la carpeta).
// Sin DOM ni dependencias. Las marcas se arman por partes para que su texto literal sólo exista en el bloque del HTML.
const MARCA = '<!--' + 'UAM_DATOS_', INICIO = MARCA + 'INICIO-->', FIN = MARCA + 'FIN-->';
export const ID_DATOS = 'uam-datos', ID_TEXTURAS = 'uam-texturas', VISOR = 'Visor_UAM_autonomo.html';
// JSON dentro de <script type="application/json">: sin '<' literal, así ningún texto puede cerrar la etiqueta.
const seguro = texto => texto.replace(/</g, '\\u003c');
// datos = {campus: <campus_editado.json>, georreferencia: <georreferencia.json>, guardado: ISO, origen: 'build'|'visor'|'servidor'}
// En líneas propias e indentado: en git un guardado sólo cambia las líneas de los valores tocados, no una línea de 4 MB.
export const bloqueDatos = datos => `${INICIO}\n<script type="application/json" id="${ID_DATOS}">\n${seguro(JSON.stringify(datos, null, 1))}\n</script>\n${FIN}`;
// Una textura por línea (data: URI de JPEG en base64).
export const bloqueTexturas = mapa => `<script type="application/json" id="${ID_TEXTURAS}">\n{${Object.entries(mapa).map(([k, v]) => seguro(JSON.stringify(k) + ':' + JSON.stringify(v))).join(',\n')}}\n</script>`;
export function reemplazarDatos(html, datos) {
  const i = html.indexOf(INICIO), f = i < 0 ? -1 : html.indexOf(FIN, i);
  if (f < 0) throw Error('Este visor no tiene bloque de datos incrustados: vuelve a generarlo con build.mjs.');
  return html.slice(0, i) + bloqueDatos(datos) + html.slice(f + FIN.length);
}
// Lee el bloque de datos de un HTML como texto (Node): build.mjs conserva la fecha si el diseño no cambió (compilación repetible).
export function extraerDatos(html) {
  const i = html.indexOf(INICIO), f = i < 0 ? -1 : html.indexOf(FIN, i);
  if (f < 0) return null;
  const b = html.slice(i, f), a = b.indexOf('>', b.indexOf('<script')) + 1, c = b.lastIndexOf('</script>');
  try { return JSON.parse(b.slice(a, c)); } catch { return null; }
}
export function leerIncrustado(doc, id = ID_DATOS) {
  const el = doc?.getElementById?.(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch { return null; }
}
