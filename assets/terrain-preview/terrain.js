// Temporary visual experiment. Loaded ONLY by assets/terrain-preview/index.html.
(function () {
  'use strict';
  const original=window.GardenGameLayout;
  const textureKey='temporary:grass-preview';
  const rgb = n => [n>>16&255,n>>8&255,n&255];
  function rng(seed) {return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function grass(scene) {
    const spec=original.spec;
    let t=scene.textures.exists(textureKey)?scene.textures.get(textureKey):scene.textures.createCanvas(textureKey,spec.width,spec.fieldHeight);
    const ctx=t.getContext(),tile=document.createElement('canvas');
    tile.width=tile.height=128;
    const c=tile.getContext('2d'),r=rng(4121);
    c.fillStyle='#416D38';c.fillRect(0,0,128,128);
    // Restrained 1–3 px pixel speckles and short grass tufts; no high-frequency grid.
    const colors=['#3C6533','#46743B','#4B783E','#39612F'];
    for(let i=0;i<420;i++){
      c.fillStyle=colors[Math.floor(r()*colors.length)];
      c.fillRect(Math.floor(r()*128),Math.floor(r()*128),1+Math.floor(r()*3),1+Math.floor(r()*2));
    }
    for(let i=0;i<21;i++){
      const x=3+Math.floor(r()*122),y=3+Math.floor(r()*122);
      c.fillStyle='#32582C';c.fillRect(x,y+1,4,1);
      c.fillStyle='#568444';c.fillRect(x+1,y-2,1,3);c.fillRect(x,y-1,1,1);c.fillRect(x+2,y,1,1);c.fillRect(x+3,y-1,1,2);
    }
    ctx.fillStyle=ctx.createPattern(tile,'repeat');ctx.fillRect(0,0,spec.width,spec.fieldHeight);
    t.refresh();t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.children.getByName('battlefield').setVisible(false);
    scene.add.image(0,spec.top,textureKey).setOrigin(0).setDepth(-2).setName('temporary-grass-field');
  }
  function soil(scene) {
    const g=original.spec.garden,key='ui-test:garden-soil:'+g.cell;
    const t=scene.textures.get(key),image=scene.children.getByName('garden-preview-soil');
    const face=rgb(original.colors.gardenSoil),edge=rgb(original.colors.gardenBorder);
    const nativeRefresh=t.refresh;
    // Color the existing raster only, retaining the original alpha mask and active borders.
    // No geometry, flower sprite, input, or gameplay changes.
    function shade(){
      const ctx=t.getContext(),im=ctx.getImageData(0,0,t.width,t.height),p=im.data;
      const z=scene.cameras.main.zoom;
      const x0=Math.round((image.x-image.displayWidth/2)*z),y0=Math.round((image.y-image.displayHeight/2)*z);
      for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){
        const i=(y*t.width+x)*4;if(p[i+3]!==255)continue;
        let v;
        if(p[i]===face[0]&&p[i+1]===face[1]&&p[i+2]===face[2]){
          const gx=Math.floor((x+x0)/z)-g.x,gy=Math.floor((y+y0)/z)-g.y;
          const h=(Math.imul(gx+11,73856093)^Math.imul(gy+17,19349663))>>>0;
          const n=h%37;
          v=n===0?0xA5754B:n===1?0x71482F:n<5?0x92613F:0x845537;
        }else if(p[i]===edge[0]&&p[i+1]===edge[1]&&p[i+2]===edge[2])v=0x573922;
        else continue;
        p[i]=v>>16&255;p[i+1]=v>>8&255;p[i+2]=v&255;
      }
      ctx.putImageData(im,0,0);
    }
    t.refresh=function(...args){shade();return nativeRefresh.apply(this,args);};
    t.refresh();
    scene.events.once('shutdown',()=>{t.refresh=nativeRefresh;});
  }
  window.GardenGameLayout=Object.freeze({...original,draw(scene){original.draw(scene);grass(scene);soil(scene);}});
}());
