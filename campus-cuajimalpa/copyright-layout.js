// Patrón local en metros. Sólo presentación: nunca cambia huellas ni georreferencia.
export function copyrightPanelsForSite(site,scale=1,style={}){
 const polygon=site.map(p=>[(p[0]-895)*scale,(p[1]-390)*scale]);
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
 const maxWidth=style.maxWidth||160,rowSpacing=style.rowSpacing||32,margin=maxWidth/16+2,panels=[];
 function inside(x,z){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
 for(let z=zmin+margin;z<zmax-margin;z+=rowSpacing){
  let start=null;
  function flush(end){if(start===null)return;const span=end-start-4,count=Math.ceil(span/(maxWidth+10));if(count>0){const cell=span/count,width=Math.min(maxWidth,cell-8);if(width>=28)for(let k=0;k<count;k++)panels.push({x:start+2+(k+.5)*cell,z,width});}start=null;}
  for(let x=xmin;x<=xmax+2;x+=2){const fits=x<=xmax&&[-margin,0,margin].every(dz=>inside(x,z+dz));if(fits){if(start===null)start=x;}else flush(x-2);}
 }
 // Tres bandas grandes para lectura a distancia, además del mosaico para acercamientos.
 return [...(style.largePanels||[]),...panels];
}
