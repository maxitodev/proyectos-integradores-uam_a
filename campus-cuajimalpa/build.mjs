import fs from 'node:fs/promises';
import {ORIGINAL} from './model-data.js';
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const read=p=>fs.readFile(new URL(p,import.meta.url),'utf8');
const imports={'copyright-layout':uri(await read('./copyright-layout.js')),three:uri(await read('./vendor/three.module.js')),orbit:uri(await read('./vendor/OrbitControls.js')),exporter:uri((await read('./vendor/GLTFExporter.js')).replace(/'\.\/(?:\.\.\/utils\/)?TextureUtils\.js'/,"'texture-utils'")),'texture-utils':uri(await read('./vendor/TextureUtils.js')),'model-data':uri(await read('./model-data.js')),vegetacion:uri(await read('./vegetacion.js'))};
// Efectos (cielo físico y postproceso): módulos propios + add-ons de three r160 con nombres planos (vendor/), inlinados como el resto.
const EFECTOS={efectos:'./efectos.js','efectos-solar':'./efectos-solar.js',sky:'./vendor/Sky.js','post-composer':'./vendor/EffectComposer.js','post-pass':'./vendor/Pass.js','post-shader':'./vendor/ShaderPass.js','post-mask':'./vendor/MaskPass.js','post-render':'./vendor/RenderPass.js','post-gtao':'./vendor/GTAOPass.js','post-bloom':'./vendor/UnrealBloomPass.js','post-output':'./vendor/OutputPass.js','post-smaa':'./vendor/SMAAPass.js','shader-copy':'./vendor/CopyShader.js','shader-gtao':'./vendor/GTAOShader.js','shader-poisson':'./vendor/PoissonDenoiseShader.js','shader-luminosity':'./vendor/LuminosityHighPassShader.js','shader-output':'./vendor/OutputShader.js','shader-smaa':'./vendor/SMAAShader.js','simplex-noise':'./vendor/SimplexNoise.js'};
for(const [nombre,ruta] of Object.entries(EFECTOS))imports[nombre]=uri(await read(ruta));
let html=await read('./index.html');html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,`<script type="importmap">${JSON.stringify({imports})}</script>`).replace('<script type="module" src="./app.js"></script>',`<script type="module">${await read('./app.js')}</script>`);
await fs.writeFile(new URL('./Visor_UAM_autonomo.html',import.meta.url),html);await fs.writeFile(new URL('./campus_base.json',import.meta.url),JSON.stringify(ORIGINAL,null,2));
// La versión servida también resuelve la utilidad de exportación en la carpeta local.
const exporter=await read('./vendor/GLTFExporter.js');await fs.writeFile(new URL('./vendor/GLTFExporter.js',import.meta.url),exporter.replace("'./../utils/TextureUtils.js'","'./TextureUtils.js'"));
console.log('Visor autónomo y datos base creados.');
