(function(){
  'use strict';
  // Preserve the previous patrol geometry for a fair visual comparison.
  // Only the decorative stone border is replaced, by a ground-level route.
  const bandWidth=5,dashLength=4,dashGap=4,dashWidth=1;
  function geometry(spec,occupied,guardianWidth,guardianHeight){
    const previous=window.GardenStoneBorderPreview.geometry(spec,occupied,guardianWidth,guardianHeight);
    return {garden:previous.garden,patrol:previous.patrol,gap:previous.gap*2+previous.thickness,bandWidth,dashLength,dashGap,dashWidth};
  }
  function rectangles(info){
    const b=info.patrol,h=bandWidth/2,rects=[];
    // The four strips form a single continuous dark track without overlaps.
    rects.push({x:b.left-h,y:b.top-h,w:b.right-b.left+bandWidth,h:bandWidth,kind:'band'});
    rects.push({x:b.left-h,y:b.bottom-h,w:b.right-b.left+bandWidth,h:bandWidth,kind:'band'});
    rects.push({x:b.left-h,y:b.top+h,w:bandWidth,h:b.bottom-b.top-bandWidth,kind:'band'});
    rects.push({x:b.right-h,y:b.top+h,w:bandWidth,h:b.bottom-b.top-bandWidth,kind:'band'});
    // Keep corners free of overlapping marks; distribute the dashes evenly.
    function side(start,end,fixed,horizontal){
      const length=end-start,count=Math.max(1,Math.floor(length/(dashLength+dashGap)));
      const step=length/count;
      for(let i=0;i<count;i++){
        const a=start+(i+0.5)*step-dashLength/2;
        rects.push(horizontal?{x:a,y:fixed-dashWidth/2,w:dashLength,h:dashWidth,kind:'dash'}:
          {x:fixed-dashWidth/2,y:a,w:dashWidth,h:dashLength,kind:'dash'});
      }
    }
    side(b.left,b.right,b.top,true);side(b.left,b.right,b.bottom,true);
    side(b.top,b.bottom,b.left,false);side(b.top,b.bottom,b.right,false);
    return rects;
  }
  function draw(graphics,info){
    const P=window.GardenPalette.n;
    graphics.clear();
    for(const r of rectangles(info)){
      // Muted solid colors from the existing palette; not a raised barrier.
      graphics.fillStyle(r.kind==='band'?P.hud:P.panel,1).fillRect(r.x,r.y,r.w,r.h);
    }
    return graphics;
  }
  window.GardenPatrolPathPreview=Object.freeze({geometry,rectangles,draw,bandWidth,dashWidth,dashLength,dashGap});
}());
