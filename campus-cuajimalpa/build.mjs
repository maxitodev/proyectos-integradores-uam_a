import fs from 'node:fs/promises';
import {ORIGINAL} from './model-data.js';
import {bloqueDatos,bloqueTexturas,extraerDatos} from './incrustar.js';
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>fs.readFile(new URL(p,import.meta.url),'utf8');
const imports={'copyright-layout':uri(await read('./copyright-layout.js')),three:uri(await read('./vendor/three.module.js')),orbit:uri(await read('./vendor/OrbitControls.js')),exporter:uri((await read('./vendor/GLTFExporter.js')).replace(/'\.\/(?:\.\.\/utils\/)?TextureUtils\.js'/,"'texture-utils'")),'texture-utils':uri(await read('./vendor/TextureUtils.js')),'model-data':uri(await read('./model-data.js')),vegetacion:uri(await read('./vegetacion.js')),incrustar:uri(await read('./incrustar.js')),geometria:uri(await read('./geometria.js')),agora:uri(await read('./agora.js')),'plaza-trasera':uri(await read('./plaza_trasera.js'))};
// Efectos (cielo físico y postproceso): módulos propios + add-ons de three r160 con nombres planos (vendor/), inlinados como el resto.
const EFECTOS={efectos:'./efectos.js','efectos-solar':'./efectos-solar.js',sky:'./vendor/Sky.js','post-composer':'./vendor/EffectComposer.js','post-pass':'./vendor/Pass.js','post-shader':'./vendor/ShaderPass.js','post-mask':'./vendor/MaskPass.js','post-render':'./vendor/RenderPass.js','post-gtao':'./vendor/GTAOPass.js','post-bloom':'./vendor/UnrealBloomPass.js','post-output':'./vendor/OutputPass.js','post-smaa':'./vendor/SMAAPass.js','shader-copy':'./vendor/CopyShader.js','shader-gtao':'./vendor/GTAOShader.js','shader-poisson':'./vendor/PoissonDenoiseShader.js','shader-luminosity':'./vendor/LuminosityHighPassShader.js','shader-output':'./vendor/OutputShader.js','shader-smaa':'./vendor/SMAAShader.js','simplex-noise':'./vendor/SimplexNoise.js'};
for(const [nombre,ruta] of Object.entries(EFECTOS))imports[nombre]=uri(await read(ruta));
// Abrir con doble clic (file://): el navegador bloquea por CORS fetch() y las imágenes de ./texturas/, así que el HTML lleva
// dentro el diseño del equipo (campus_editado.json), la georreferencia y las texturas. Guardar en la carpeta reescribe sólo el bloque de datos.
const existe=async p=>{try{await fs.access(new URL(p,import.meta.url));return true;}catch{return false;}};
const campus=await existe('./campus_editado.json')?JSON.parse(await read('./campus_editado.json')):ORIGINAL;
const georreferencia=JSON.parse(await read('./georreferencia.json'));
const texturas={};
for(const f of (await fs.readdir(new URL('./texturas/',import.meta.url))).filter(f=>f.endsWith('.jpg')).sort())texturas[f.slice(0,-4)]='data:image/jpeg;base64,'+(await fs.readFile(new URL('./texturas/'+f,import.meta.url))).toString('base64');
// Si el diseño y la georreferencia no cambiaron se conserva la fecha del bloque anterior: compilar dos veces da el mismo archivo.
const previo=extraerDatos(await read('./Visor_UAM_autonomo.html').catch(()=>''));
const igual=previo&&JSON.stringify(previo.campus)===JSON.stringify(campus)&&JSON.stringify(previo.georreferencia)===JSON.stringify(georreferencia);
const incrustado=bloqueDatos({campus,georreferencia,guardado:igual?previo.guardado:new Date().toISOString(),origen:igual?previo.origen:'build'})+'\n'+bloqueTexturas(texturas)+'\n';
const app=await read('./app.js');
let html=await read('./index.html');
// Reemplazos con función: el texto insertado no interpreta $&, $' ni $` (app.js usa $ como atajo).
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,()=>`${incrustado}<script type="importmap">${JSON.stringify({imports})}</script>`).replace('<script type="module" src="./app.js"></script>',()=>`<script type="module">${app}</script>`);
await fs.writeFile(new URL('./Visor_UAM_autonomo.html',import.meta.url),html);await fs.writeFile(new URL('./campus_base.json',import.meta.url),JSON.stringify(ORIGINAL,null,2));
// La versión servida también resuelve la utilidad de exportación en la carpeta local.
const exporter=await read('./vendor/GLTFExporter.js');await fs.writeFile(new URL('./vendor/GLTFExporter.js',import.meta.url),exporter.replace("'./../utils/TextureUtils.js'","'./TextureUtils.js'"));
const mb=n=>(n/1048576).toFixed(2)+' MB';
console.log(`Visor autónomo y datos base creados: ${mb(Buffer.byteLength(html))} (texturas ${Object.keys(texturas).length}: ${mb(Object.values(texturas).reduce((s,t)=>s+t.length,0))}; datos ${campus===ORIGINAL?'model-data.js':'campus_editado.json'}).`);
