(function(){
  'use strict';
  const P=window.GardenPalette.n;
  const colors=Object.freeze({base:P.panel,planted:P.slate,candidate:P.stone,active:P.growth});
  const all=g=>new Set(Array.from({length:g.columns*g.rows},(_,i)=>i));
  // A shared one-pixel edge is drawn exactly once. Leave the intersections
  // empty and cut the edge into short dashes in logical (not screen) pixels.
  function rectangles(g,occupied,candidates,hover=null){
    const rects=[],p=g.pitch;
    const get=(x,y)=>x>=0&&x<g.columns&&y>=0&&y<g.rows?y*g.columns+x:-1;
    function color(a,b){
      if(hover!==null&&(candidates.has(a)||candidates.has(b))){
        if(!candidates.has(hover)||a===hover||b===hover)return colors.active;
      }
      if(occupied.has(a)||occupied.has(b))return colors.planted;
      if(candidates.has(a)||candidates.has(b))return colors.candidate;
      return colors.base;
    }
    function edge(x,y,horizontal,c){
      for(let t=2;t<p-1;t+=5){
        const length=Math.min(3,p-1-t);
        rects.push(horizontal?{x:x+t,y,w:length,h:1,color:c}:{x,y:y+t,w:1,h:length,color:c});
      }
    }
    for(let y=0;y<=g.rows;y++)for(let x=0;x<g.columns;x++)
      edge(x*p,y*p,true,color(get(x,y-1),get(x,y)));
    for(let x=0;x<=g.columns;x++)for(let y=0;y<g.rows;y++)
      edge(x*p,y*p,false,color(get(x-1,y),get(x,y)));
    return rects;
  }
  function draw(ctx,g,z,raster,occupied,candidates,hover){
    ctx.clearRect(0,0,raster.width,raster.height);ctx.globalAlpha=1;
    for(const r of rectangles(g,occupied,candidates,hover)){
      let x=Math.round((g.x+r.x)*z)-raster.x,y=Math.round((g.y+r.y)*z)-raster.y;
      const right=Math.round((g.x+r.x+r.w)*z)-raster.x,bottom=Math.round((g.y+r.y+r.h)*z)-raster.y;
      // At fractional zoom the outermost one-pixel edge may round to the
      // canvas endpoint. Snap it inward rather than clipping the edge away.
      if(r.w===1)x=Math.min(x,raster.width-1);
      if(r.h===1)y=Math.min(y,raster.height-1);
      const w=Math.min(raster.width-x,r.w===1?Math.max(1,right-x):right-x),h=Math.min(raster.height-y,r.h===1?Math.max(1,bottom-y):bottom-y);
      if(w<=0||h<=0)continue;
      ctx.fillStyle='#'+r.color.toString(16).padStart(6,'0');ctx.fillRect(x,y,w,h);
    }
  }
  window.GardenDashedGridPreview=Object.freeze({colors,all,rectangles,draw});
}());
