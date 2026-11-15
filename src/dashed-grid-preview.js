(function(){
  'use strict';
  const P=window.GardenPalette.n;
  const colors=Object.freeze({base:P.slate,active:P.growth});
  const all=g=>new Set(Array.from({length:g.columns*g.rows},(_,i)=>i));
  const visible=(occupied,candidates)=>new Set([...occupied,...candidates]);
  // The guardian's full sprite stays outside the visible grid, not merely
  // outside the planted cells. Retain the existing rectangular patrol motion.
  function geometry(spec,occupied,guardianWidth,guardianHeight){
    const g=spec.garden,candidates=window.GardenGameLayout.gardenCandidates(occupied);
    const keys=[...visible(occupied,candidates)],xs=keys.map(i=>i%g.columns),ys=keys.map(i=>Math.floor(i/g.columns));
    const garden={left:g.x+Math.min(...xs)*g.pitch,top:g.y+Math.min(...ys)*g.pitch,
      right:g.x+Math.max(...xs)*g.pitch+g.outer,bottom:g.y+Math.max(...ys)*g.pitch+g.outer};
    const gap=5;
    const patrol={left:garden.left-gap-guardianWidth/2,right:garden.right+gap+guardianWidth/2,
      top:garden.top-gap-guardianHeight/2,bottom:garden.bottom+gap+guardianHeight/2};
    return {garden,patrol,gap};
  }
  // A shared one-pixel edge is drawn exactly once. Leave the intersections
  // empty and cut the edge into short dashes in logical (not screen) pixels.
  function rectangles(g,occupied,candidates,hover=null){
    const rects=[],p=g.pitch,shown=visible(occupied,candidates);
    const get=(x,y)=>x>=0&&x<g.columns&&y>=0&&y<g.rows?y*g.columns+x:-1;
    function color(a,b){
      if(hover!==null&&(candidates.has(a)||candidates.has(b))){
        if(!candidates.has(hover)||a===hover||b===hover)return colors.active;
      }
      return shown.has(a)||shown.has(b)?colors.base:null;
    }
    function edge(x,y,horizontal,c){
      if(c===null)return;
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
  window.GardenDashedGridPreview=Object.freeze({colors,all,visible,geometry,rectangles,draw});
}());
