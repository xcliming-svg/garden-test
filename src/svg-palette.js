(function () {
  'use strict';
  // Original SVG colors are the default. The archived palette experiment is opt-in only.
  const enabled=new URLSearchParams(window.location.search).get('svgcolors')==='palette16';
  const path=relative=>'assets/'+(enabled?'palette16/':'')+relative;
  const rgb=Object.values(window.GardenPalette.n).map(n=>[n>>16&255,n>>8&255,n&255]);
  const cache=new Map();
  function nearest(r,g,b){
    r=Math.round(r);g=Math.round(g);b=Math.round(b);
    const k=(r<<16)|(g<<8)|b;
    if(cache.has(k))return cache.get(k);
    let best=rgb[0],distance=Infinity;
    for(const c of rgb){
      const mean=(r+c[0])/2,dr=r-c[0],dg=g-c[1],db=b-c[2];
      const d=(2+mean/256)*dr*dr+4*dg*dg+(2+(255-mean)/256)*db*db;
      if(d<distance){distance=d;best=c;}
    }
    cache.set(k,best);return best;
  }
  function apply(imageData){
    if(!enabled)return imageData;
    const data=imageData.data;
    for(let i=0;i<data.length;i+=4){
      if(!data[i+3])continue;
      const c=nearest(data[i],data[i+1],data[i+2]);
      data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];
    }
    return imageData;
  }
  window.GardenSvgPalette=Object.freeze({enabled,path,apply});
}());
