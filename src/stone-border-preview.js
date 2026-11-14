(function(){
  'use strict';
  // Rectangular enclosing border for the growing garden; no physics wall.
  const thickness=6, preferredGap=5, segment=12;
  function geometry(spec,occupied,guardianWidth,guardianHeight){
    const g=spec.garden,keys=[...occupied],xs=keys.map(i=>i%g.columns),ys=keys.map(i=>Math.floor(i/g.columns));
    const garden={left:g.x+Math.min(...xs)*g.pitch,top:g.y+Math.min(...ys)*g.pitch,
      right:g.x+Math.max(...xs)*g.pitch+g.outer,bottom:g.y+Math.max(...ys)*g.pitch+g.outer};
    // Reserve both full guardian extents for all future garden growth and size modes.
    const gap=Math.max(0,Math.min(preferredGap,Math.floor((spec.fieldHeight-g.size-2*guardianHeight-2*thickness)/4)));
    const expand=(r,x,y=x)=>({left:r.left-x,right:r.right+x,top:r.top-y,bottom:r.bottom+y});
    const inner=expand(garden,gap),outer=expand(inner,thickness);
    const patrol=expand(outer,gap+guardianWidth/2,gap+guardianHeight/2);
    return {garden,inner,outer,patrol,gap,thickness};
  }
  // Split each side into almost equal integer segments; no tiny end stone.
  function parts(start,end){
    const count=Math.max(1,Math.round((end-start)/segment));
    return Array.from({length:count},(_,i)=>[start+Math.round(i*(end-start)/count),start+Math.round((i+1)*(end-start)/count)]);
  }
  function rectangles(info){
    const {outer:o,inner:i}=info,t=info.thickness,rects=[];
    for(const [a,b] of parts(o.left,o.right)){
      rects.push({x:a,y:o.top,w:b-a,h:t,horizontal:true});
      rects.push({x:a,y:i.bottom,w:b-a,h:t,horizontal:true});
    }
    for(const [a,b] of parts(i.top,i.bottom)){
      rects.push({x:o.left,y:a,w:t,h:b-a,horizontal:false});
      rects.push({x:i.right,y:a,w:t,h:b-a,horizontal:false});
    }
    return rects;
  }
  function draw(graphics,info){
    const P=window.GardenPalette.n;
    graphics.clear();
    // 1px slate outline, stone/panel faces, a short slate/stone highlight.
    // Shared tile bounds, inset corner pixels create discrete little stone blocks.
    rectangles(info).forEach(({x,y,w,h,horizontal},index)=>{
      graphics.fillStyle(P.slate,1).fillRect(x+1,y,w-2,h).fillRect(x,y+1,w,h-2);
      graphics.fillStyle(index%3===0?P.stone:P.panel,1).fillRect(x+1,y+1,w-2,h-2);
      graphics.fillStyle(index%3===0?P.slate:P.stone,1);
      if(horizontal)graphics.fillRect(x+2,y+1,Math.max(1,w-5),1);
      else graphics.fillRect(x+1,y+2,1,Math.max(1,h-5));
      // Dark seam inside the stone, not an additional external gap.
      graphics.fillStyle(P.ink,1);
      if(horizontal)graphics.fillRect(x+w-1,y+1,1,h-2);
      else graphics.fillRect(x+1,y+h-1,w-2,1);
    });
    return graphics;
  }
  window.GardenStoneBorderPreview=Object.freeze({geometry,rectangles,draw,preferredGap,thickness});
}());
