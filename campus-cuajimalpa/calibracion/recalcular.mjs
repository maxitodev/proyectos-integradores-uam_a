import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const geo=JSON.parse(await fs.readFile(new URL('georreferencia.json',root)));
const points=JSON.parse(await fs.readFile(new URL('calibracion/puntos.json',root)));
const cfg=geo.calibracion,R=6378137,[cx,cy]=cfg.referenciaMercator,c=cfg.cosLatitud;
if(points.length<4)throw Error('Se necesitan al menos cuatro controles distribuidos.');
const rows=points.map(p=>[...p.modelo,1]);
const targets=points.map(p=>{const [lat,lon]=p.latLon;return [(R*lon*Math.PI/180-cx)*c,(R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))-cy)*c];});
function solve(b){
 const m=Array.from({length:3},(_,i)=>[...Array.from({length:3},(_,j)=>rows.reduce((s,r)=>s+r[i]*r[j],0)),rows.reduce((s,r,k)=>s+r[i]*b[k],0)]);
 for(let i=0;i<3;i++){let k=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[k][i]))k=j;[m[k],m[i]]=[m[i],m[k]];const pivot=m[i][i];if(Math.abs(pivot)<1e-10)throw Error('Controles colineales o ajuste degenerado.');for(let j=i;j<4;j++)m[i][j]/=pivot;for(let k=0;k<3;k++)if(k!==i){const q=m[k][i];for(let j=i;j<4;j++)m[k][j]-=q*m[i][j];}}
 return m.map(r=>r[3]);
}
const east=solve(targets.map(p=>p[0])),north=solve(targets.map(p=>p[1]));
const fit=east.map((e,i)=>[e,north[i]]),project=(x,z)=>[east[0]*x+east[1]*z+east[2],north[0]*x+north[1]*z+north[2]];
const errors=rows.map((r,i)=>Math.hypot(...project(r[0],r[1]).map((n,k)=>n-targets[i][k]))),rms=Math.sqrt(errors.reduce((s,n)=>s+n*n,0)/errors.length);
function corner(x,z){const [e,n]=project(x,z);return [Number(((2*Math.atan(Math.exp((cy+n/c)/R))-Math.PI/2)*180/Math.PI).toFixed(9)),Number(((cx+e/c)/R*180/Math.PI).toFixed(9))];}
const f=cfg.encuadre;
const corners={superiorIzquierda:corner(f.xMin,f.zMin),superiorDerecha:corner(f.xMax,f.zMin),inferiorIzquierda:corner(f.xMin,f.zMax)};
if(process.argv.includes('--write')){
 Object.assign(geo,corners);Object.assign(cfg,{matrizAfinEsteNorte:fit,rmsMetros:Number(rms.toFixed(4)),maximoMetros:Number(Math.max(...errors).toFixed(4)),numeroPuntos:points.length,volumenes:new Set(points.map(p=>p.edificio)).size});
 geo.metrosPorUnidad=Math.sqrt(Math.abs(east[0]*north[1]-east[1]*north[0]));
 geo.descripcion='Croquis inicial; ajuste afín RMS interno '+rms.toFixed(2)+' m. No exactitud absoluta; ver calibracion/puntos.json y FUENTES.md.';
 points.forEach((p,i)=>p.residuoMetros=Number(errors[i].toFixed(4)));
 await fs.writeFile(new URL('georreferencia.json',root),JSON.stringify(geo,null,2));await fs.writeFile(new URL('calibracion/puntos.json',root),JSON.stringify(points,null,2));
}else{
 if(Math.abs(rms-cfg.rmsMetros)>.001)throw Error('El RMS registrado no coincide con los puntos.');
 for(const key of Object.keys(corners))if(corners[key].some((n,i)=>Math.abs(n-geo[key][i])>1e-8))throw Error('Las esquinas no coinciden con la calibración: '+key);
}
console.log(JSON.stringify({controles:points.length,volumenes:new Set(points.map(p=>p.edificio)).size,rmsMetros:rms,maximoMetros:Math.max(...errors),esquinas:corners,escrito:process.argv.includes('--write')},null,2));
