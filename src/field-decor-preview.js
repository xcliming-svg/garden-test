(function(){
  'use strict';
  const P=window.GardenPalette.n;
  // Fixed seeded placement, independent of combat RNG, no collision or input.
  function layout(spec){
    let seed=0x4da19e27;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const out=[],g=spec.garden,b=spec.blueprint;
    const intersects=(x,y,w,h,r,pad)=>x+w>r.x-pad&&x<r.x+r.width+pad&&y+h>r.y-pad&&y<r.y+r.height+pad;
    for(const [kind,count] of [['grass',14],['rock',8]]){
      for(let i=0;i<count;i++){
        for(let attempt=0;attempt<500;attempt++){
          const variant=Math.floor(random()*2),w=kind==='grass'?(variant?10:8):(variant?12:8),h=kind==='grass'?7:6;
          const x=12+Math.floor(random()*(spec.width-24-w)),y=spec.top+16+Math.floor(random()*(spec.fieldHeight-32-h));
          if(intersects(x,y,w,h,{x:g.x,y:g.y,width:g.size,height:g.size},45)||
             intersects(x,y,w,h,b,12)||intersects(x,y,w,h,{x:spec.width-180,y:spec.top,width:180,height:22},8))continue;
          if(out.some(o=>Math.hypot(o.x+o.w/2-x-w/2,o.y+o.h/2-y-h/2)<48))continue;
          out.push({kind,variant,x,y,w,h});break;
        }
      }
    }
    return out;
  }
  function draw(scene,spec){
    const graphics=window.GardenUI.pixelGraphics(scene).setDepth(-1.5).setName('field-decor');
    for(const d of layout(spec)){
      const {x,y,w,h,kind,variant}=d;
      const fill=(c,dx,dy,a,b)=>graphics.fillStyle(c,1).fillRect(x+dx,y+dy,a,b);
      if(kind==='grass'){
        // Three little blades, each with an offset pixel and dark root.
        fill(P.ink,0,h-2,w,2);fill(P.teal,1,3,2,3);fill(P.growth,0,2,2,2);
        fill(P.growth,3,0,2,4);fill(P.teal,4,4,2,2);
        fill(P.growth,w-2,2,2,2);fill(P.teal,w-3,4,2,2);
        fill(P.teal,2,h-1,w-4,1);
      }else{
        fill(P.ink,1,2,w-2,4);fill(P.slate,0,2,w,2);
        fill(P.slate,1,1,w-2,4);fill(P.stone,2,0,w-4,2);
        fill(P.panel,2,4,w-4,1);
        if(variant)fill(P.stone,3,2,3,1);
      }
    }
    return graphics;
  }
  window.GardenFieldDecorPreview=Object.freeze({layout,draw});
}());
