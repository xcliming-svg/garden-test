(function(){
  'use strict';
  const P=window.GardenPalette;
  // Sampled from the supplied screenshot (not a screenshot-as-background).
  const grass=[0x83a650,0x8cae56,0x7a9b49,0x92b35d,0x759748,0x9cba65,0x688a3f];
  const dirt=[0xa16a3e,0xad7849,0x81512e,0xc18c54];
  function hash(x,y){let h=(Math.imul(x+17,374761393)+Math.imul(y+31,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
  const css=c=>'#'+c.toString(16).padStart(6,'0');
  function field(scene,spec){
    const key='theme-one:field:'+spec.fieldHeight;
    if(!scene.textures.exists(key)){
      const t=scene.textures.createCanvas(key,spec.width,spec.fieldHeight),ctx=t.getContext();
      ctx.fillStyle=css(grass[0]);ctx.fillRect(0,0,spec.width,spec.fieldHeight);
      // Sparse 1–2px flecks and tiny two-blade tufts, stable on restart.
      for(let y=0;y<spec.fieldHeight;y+=5)for(let x=0;x<spec.width;x+=5){
        const h=hash(x,y);if(h%5===0)continue;
        const px=x+(h%4),py=y+((h>>>5)%4),c=grass[1+((h>>>9)%6)];
        ctx.fillStyle=css(c);ctx.fillRect(px,py,1+(h%3===0?1:0),1);
        if(h%7===0){ctx.fillStyle=css(grass[3]);ctx.fillRect(px,py-1,1,2);ctx.fillStyle=css(grass[6]);ctx.fillRect(px+1,py,1,1);}
      }
      t.refresh();t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    return scene.add.image(spec.width/2,spec.top+spec.fieldHeight/2,key).setDepth(-1.8).setName('theme-one-field');
  }
  function garden(ctx,g,z,raster,occupied,candidates,hover){
    ctx.clearRect(0,0,raster.width,raster.height);ctx.globalAlpha=1;
    const L=window.GardenGameLayout;
    const shown=new Set([...occupied,...candidates]);
    const active=hover===null?new Set():candidates.has(hover)?new Set([hover]):candidates;
    function rect(x,y,w,h,c){
      const a=Math.round((g.x+x)*z)-raster.x,b=Math.round((g.y+y)*z)-raster.y;
      const r=Math.round((g.x+x+w)*z)-raster.x,d=Math.round((g.y+y+h)*z)-raster.y;
      ctx.fillStyle=css(c);ctx.fillRect(a,b,r-a,d-b);
    }
    // Use the same disjoint shared cell geometry as the original garden.
    const blocks=L.gardenGridRects(shown,g,active);
    for(const r of blocks){
      rect(r.x,r.y,r.w,r.h,r.border?(r.highlight?P.reference.n.flowerBorder:P.reference.n.gardenBorder):dirt[0]);
      if(r.border)continue;
      for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
        const h=hash(x,y);if(h%17===0)rect(x,y,1,1,dirt[1+((h>>>8)%3)]);
      }
    }
  }
  window.GardenLightFieldPreview=Object.freeze({field,garden,grass:Object.freeze(grass),dirt:Object.freeze(dirt)});
}());
