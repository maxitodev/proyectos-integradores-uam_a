import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const port=Number(process.env.PORT||8769);
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'};
http.createServer(async(req,res)=>{try{
 if(req.method==='POST' && ['/guardar/glb','/guardar/json','/guardar/png','/guardar/plano'].includes(req.url)){
  if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin)){res.writeHead(403);res.end();return;}
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>100e6)throw Error('Archivo demasiado grande');chunks.push(c);}
  const ext=req.url.split('/').pop();const name={glb:'UAM_Cuajimalpa.glb',json:'campus_editado.json',png:'Vista_actual.png',plano:'plano_2d.png'}[ext];
  await fs.writeFile(path.join(root,name),Buffer.concat(chunks));res.end(JSON.stringify({saved:name}));return;
 }
 const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const p=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));
 if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 const bytes=await fs.readFile(p);res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(bytes);
}catch(e){res.writeHead(404);res.end(String(e.message));}}).listen(port,'127.0.0.1',()=>console.log(`Visor UAM: http://127.0.0.1:${port}`));
