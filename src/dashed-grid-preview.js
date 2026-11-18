(function(){
  'use strict';
  const P=window.GardenPalette,R=P.reference.n;
  const params=new URLSearchParams(window.location.search);
  const requested=params.get('gridColor');
  const colorName=['slate','graphite','charcoal'].includes(requested)?requested:'slate';
  const requestedStyle=params.get('gridStyle');
  const lineStyle=requestedStyle===null||requestedStyle==='unified'?'unified':['dashed','drag'].includes(requestedStyle)?requestedStyle:'solid';
  const unified=P.uiType!==1&&lineStyle==='unified';
  const colors=Object.freeze({base:P.uiType===1?R.gardenBorder:P.n[colorName],active:R.flowerBorder});

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
  // Shared 1px borders: solid junctions by default or the previous 3px
  // dash / 2px gap pattern with transparent junctions. Geometry is unchanged.
  // Occupied cells retain the card face. Empty cells are transparent.
  // Shared borders prioritize the valid target, then the candidate, then
  // the occupied cell so that every candidate has a complete green outline.
  function unifiedRectangles(g,occupied,candidates,hover){
    const p=g.pitch,rects=[],target=candidates.has(hover)?hover:null;
    const get=(x,y)=>x>=0&&x<g.columns&&y>=0&&y<g.rows?y*g.columns+x:-1;
    for(const i of occupied)rects.push({x:i%g.columns*p+1,y:Math.floor(i/g.columns)*p+1,w:g.cell,h:g.cell,color:R.tab});
    if(target!==null)rects.push({x:target%g.columns*p+1,y:Math.floor(target/g.columns)*p+1,w:g.cell,h:g.cell,color:R.tab,alpha:.45});
    const state=(a,b)=>{
      if(target!==null&&(a===target||b===target))return {color:colors.active,solid:true,priority:3};
      if(hover!==null&&(candidates.has(a)||candidates.has(b)))return {color:colors.active,solid:false,priority:2};
      if(occupied.has(a)||occupied.has(b))return {color:colors.base,solid:true,priority:1};
      if(candidates.has(a)||candidates.has(b))return {color:colors.base,solid:false,priority:0};
      return null;
    };
    const edge=(x,y,horizontal,s)=>{
      if(!s)return;
      for(const [t,len] of window.GardenUI.placementSegments(p,!s.solid))
        rects.push(horizontal?{x:x+t,y,w:len,h:1,color:s.color}:{x,y:y+t,w:1,h:len,color:s.color});
    };
    for(let y=0;y<=g.rows;y++)for(let x=0;x<g.columns;x++)edge(x*p,y*p,true,state(get(x,y-1),get(x,y)));
    for(let x=0;x<=g.columns;x++)for(let y=0;y<g.rows;y++)edge(x*p,y*p,false,state(get(x-1,y),get(x,y)));
    for(let y=0;y<=g.rows;y++)for(let x=0;x<=g.columns;x++){
      const a=get(x-1,y-1),b=get(x,y-1),c=get(x-1,y),d=get(x,y);
      const s=[state(a,b),state(c,d),state(a,c),state(b,d)].filter(s=>s?.solid).sort((a,b)=>b.priority-a.priority)[0];
      if(s)rects.push({x:x*p,y:y*p,w:1,h:1,color:s.color});
    }
    return rects;
  }
  function rectangles(g,occupied,candidates,hover=null){
    if(unified)return unifiedRectangles(g,occupied,candidates,hover);
    const rects=[],p=g.pitch,shown=visible(occupied,candidates);
    if(lineStyle==='drag'&&hover===null)return rects;
    const get=(x,y)=>x>=0&&x<g.columns&&y>=0&&y<g.rows?y*g.columns+x:-1;
    function color(a,b){
      if(hover!==null&&(candidates.has(a)||candidates.has(b))){
        if(!candidates.has(hover)||a===hover||b===hover)return colors.active;
      }
      return lineStyle!=='drag'&&(shown.has(a)||shown.has(b))?colors.base:null;
    }
    function edge(x,y,horizontal,c){
      if(c===null)return;
      if(lineStyle==='dashed'){
        for(let t=2;t<p-1;t+=5){
          const length=Math.min(3,p-1-t);
          rects.push(horizontal?{x:x+t,y,w:length,h:1,color:c}:{x,y:y+t,w:1,h:length,color:c});
        }
      }else rects.push(horizontal?{x:x+1,y,w:p-1,h:1,color:c}:{x,y:y+1,w:1,h:p-1,color:c});
    }
    for(let y=0;y<=g.rows;y++)for(let x=0;x<g.columns;x++)
      edge(x*p,y*p,true,color(get(x,y-1),get(x,y)));
    for(let x=0;x<=g.columns;x++)for(let y=0;y<g.rows;y++)
      edge(x*p,y*p,false,color(get(x-1,y),get(x,y)));
    if(lineStyle!=='dashed')for(let y=0;y<=g.rows;y++)for(let x=0;x<=g.columns;x++){
      const cells=[get(x-1,y-1),get(x,y-1),get(x-1,y),get(x,y)];
      const incident=[color(cells[0],cells[1]),color(cells[2],cells[3]),color(cells[0],cells[2]),color(cells[1],cells[3])];
      const c=incident.includes(colors.active)?colors.active:incident.includes(colors.base)?colors.base:null;
      if(c!==null)rects.push({x:x*p,y:y*p,w:1,h:1,color:c});
    }
    return rects;
  }
  function draw(ctx,g,z,raster,occupied,candidates,hover){
    ctx.clearRect(0,0,raster.width,raster.height);ctx.globalAlpha=1;

    // Match gardenRaster's shared axis mapping, including 1 physical px
    // minimum border thickness when scaled below the logical resolution.
    const axis=(base,offset)=>v=>{
      const n=Math.floor(v/g.pitch),start=Math.round((base+n*g.pitch)*z);
      if(v%g.pitch===0)return start-offset;
      return Math.min(Math.round((base+(n+1)*g.pitch)*z),Math.max(start+1,Math.round((base+v)*z)))-offset;
    };
    const ax=axis(g.x,raster.x),ay=axis(g.y,raster.y);
    for(const r of rectangles(g,occupied,candidates,hover)){
      const x=ax(r.x),y=ay(r.y),w=ax(r.x+r.w)-x,h=ay(r.y+r.h)-y;
      if(w<=0||h<=0)continue;
      ctx.globalAlpha=r.alpha??1;ctx.fillStyle='#'+r.color.toString(16).padStart(6,'0');ctx.fillRect(x,y,w,h);
    }
    ctx.globalAlpha=1;
  }
  window.GardenDashedGridPreview=Object.freeze({colors,colorName,lineStyle,unified,all,visible,geometry,rectangles,draw});
}());
