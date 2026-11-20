(function(){
  'use strict';
  const R=window.GardenPalette.reference.n;
  const colors=Object.freeze({base:R.flowerFrame,active:R.flowerBorder,wrong:window.GardenPalette.n.red});

  const all=g=>new Set(Array.from({length:g.columns*g.rows},(_,i)=>i));
  const visible=(occupied,candidates)=>new Set([...occupied,...candidates]);
  // The guardian's full sprite stays outside the visible grid, not merely
  // outside the planted cells. Retain the existing rectangular patrol motion.
  function geometry(spec,occupied,guardianWidth,guardianHeight){
    const g=spec.garden,candidates=window.GardenRunRules?.active?window.GardenRunRules.plantCandidates(occupied):window.GardenGameLayout.gardenCandidates(occupied);
    const keys=[...visible(occupied,candidates)],xs=keys.map(i=>i%g.columns),ys=keys.map(i=>Math.floor(i/g.columns));
    const py=g.pitchY||g.pitch;
    const garden={left:g.x+Math.min(...xs)*g.pitch,top:g.y+Math.min(...ys)*py,
      right:g.x+Math.max(...xs)*g.pitch+g.outer,bottom:g.y+Math.max(...ys)*py+g.outer};
    const gap=5;
    const patrol={left:garden.left-gap-guardianWidth/2,right:garden.right+gap+guardianWidth/2,
      top:garden.top-gap-guardianHeight/2,bottom:garden.bottom+gap+guardianHeight/2};
    return {garden,patrol,gap};
  }
  // Shared 1px corner brackets, 5px arms including each junction.
  // Active edges take precedence; interiors and edge middles stay transparent.
  // Playable mode uses the approved comparison: independent inset corners
  // with the same 1px/5px arms, so a wrong flower never colors a neighbor.
  function cellRectangles(g,occupied,candidates,hover,wrong){
    const rects=[],p=g.pitch,lo=g.line,hi=p-1,arm=Math.min(5,Math.floor((hi-lo+1)/2));
    for(const id of visible(occupied,candidates)){
      const x=id%g.columns*p,y=Math.floor(id/g.columns)*p;
      const active=hover!==null&&candidates.has(id)&&(!candidates.has(hover)||id===hover);
      const color=occupied.has(id)&&wrong.has(id)?colors.wrong:active?colors.active:colors.base;
      for(const [a,b,w,h] of [[lo,lo,arm,1],[lo,lo+1,1,arm-1],[hi-arm+1,lo,arm,1],[hi,lo+1,1,arm-1],[lo,hi,arm,1],[lo,hi-arm+1,1,arm-1],[hi-arm+1,hi,arm,1],[hi,hi-arm+1,1,arm-1]])
        rects.push({x:x+a,y:y+b,w,h,color});
    }
    return rects;
  }
  function rectangles(g,occupied,candidates,hover=null,wrong=null){
    if(wrong!==null)return cellRectangles(g,occupied,candidates,hover,wrong);
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
      for(const [t,len] of window.GardenUI.cornerSegments(p))
        rects.push(horizontal?{x:x+t,y,w:len,h:1,color:c}:{x,y:y+t,w:1,h:len,color:c});
    }
    for(let y=0;y<=g.rows;y++)for(let x=0;x<g.columns;x++)
      edge(x*p,y*p,true,color(get(x,y-1),get(x,y)));
    for(let x=0;x<=g.columns;x++)for(let y=0;y<g.rows;y++)
      edge(x*p,y*p,false,color(get(x-1,y),get(x,y)));
    for(let y=0;y<=g.rows;y++)for(let x=0;x<=g.columns;x++){
      const cells=[get(x-1,y-1),get(x,y-1),get(x-1,y),get(x,y)];
      const incident=[color(cells[0],cells[1]),color(cells[2],cells[3]),color(cells[0],cells[2]),color(cells[1],cells[3])];
      const c=incident.includes(colors.active)?colors.active:incident.includes(colors.base)?colors.base:null;
      if(c!==null)rects.push({x:x*p,y:y*p,w:1,h:1,color:c});
    }
    return rects;
  }
  function draw(ctx,g,z,raster,occupied,candidates,hover,wrong=null){
    ctx.clearRect(0,0,raster.width,raster.height);ctx.globalAlpha=1;

    // Match gardenRaster's shared axis mapping, including 1 physical px
    // minimum border thickness when scaled below the logical resolution.
    const axis=(base,offset)=>v=>{
      const n=Math.floor(v/g.pitch),start=Math.round((base+n*g.pitch)*z);
      if(v%g.pitch===0)return start-offset;
      return Math.min(Math.round((base+(n+1)*g.pitch)*z),Math.max(start+1,Math.round((base+v)*z)))-offset;
    };
    const ax=axis(g.x,raster.x),ay=axis(g.y,raster.y);
    for(const r of rectangles(g,occupied,candidates,hover,wrong)){
      const x=ax(r.x),y=ay(r.y),w=ax(r.x+r.w)-x,h=ay(r.y+r.h)-y;
      if(w<=0||h<=0)continue;
      ctx.fillStyle='#'+r.color.toString(16).padStart(6,'0');ctx.fillRect(x,y,w,h);
    }
  }
  window.GardenDashedGridPreview=Object.freeze({colors,all,visible,geometry,rectangles,draw});
}());
