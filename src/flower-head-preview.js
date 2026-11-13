(function () {
  'use strict';
  // User SVGs: 1(4) person, 3(3) daisy, 4(4) tulip, 5(2) sunflower, 6(1) blue flowers.
  // Only head parts, tight alpha bounds, aspect preserved, native 22/32px rasterization,
  // binary alpha and Garden 16 material roles. RLE: decimal count + palette index.
  const roles = [null,'teal','sand','gold','red','bark','sky','silver','slate'];
  const runs = {
  "guardian:24": "100,41,180,71,170,81,150,91,150,91,150,91,150,91,160,71,180,61,170,81,150,101,130,121,100,141,100,31,20,51,20,31,100,11,30,51,30,21,140,51,190,51,180,71,170,31,10,31,170,31,10,31,160,31,30,31,150,31,30,31,150,31,30,31,150,21,50,21,80",
  "daisy:22": "90,42,170,62,150,72,150,82,90,42,10,72,20,42,30,62,10,62,10,62,10,212,10,92,43,82,10,82,63,72,20,62,83,62,30,42,93,42,60,32,103,42,30,62,83,62,10,72,83,152,63,172,33,102,10,62,10,62,10,72,10,52,20,72,10,52,40,22,20,82,150,72,150,62,170,32,100",
  "daisy:32": "140,42,260,82,230,92,230,102,220,102,220,102,40,22,70,62,30,102,20,62,40,82,20,102,10,82,30,92,20,82,10,92,20,112,10,72,10,112,10,122,10,22,23,22,10,112,10,122,83,112,20,102,103,102,20,92,123,82,40,82,123,72,70,52,133,62,90,22,20,143,52,60,82,123,82,30,92,123,92,10,102,123,92,10,112,103,232,83,252,53,22,10,222,10,202,10,92,10,102,10,92,30,72,20,102,20,72,50,52,30,112,30,32,150,102,220,102,230,82,240,72,270,42,140",
  "tulip:22": "540,24,190,44,100,54,20,64,30,44,20,1534,10,204,20,204,30,184,50,164,70,144,90,114,140,54,750",
  "tulip:32": "1420,44,270,64,160,24,70,84,80,14,50,64,40,94,30,74,20,94,10,204,20,304,10,2244,10,314,10,304,20,304,30,284,40,284,50,264,70,244,90,214,130,174,170,134,230,64,1410",
  "sunflower:22": "310,33,180,53,130,23,20,53,10,43,60,173,50,173,50,63,55,63,50,53,85,43,60,33,95,53,30,43,115,53,10,53,115,113,115,113,115,63,10,43,115,43,50,33,95,43,50,53,75,53,50,73,35,73,50,173,60,113,10,33,80,33,10,63,170,43,310",
  "sunflower:32": "460,33,270,63,260,73,190,23,30,83,20,53,100,63,10,163,80,253,70,253,70,253,70,93,85,83,70,73,115,63,90,53,135,53,90,43,155,73,40,63,155,83,20,63,165,163,175,153,175,153,175,153,165,83,20,73,155,73,40,63,155,53,80,53,135,63,80,63,115,73,70,93,85,83,70,113,35,113,70,253,70,243,90,73,10,83,30,33,110,53,20,83,250,63,270,43,460",
  "hydrangea:22": "290,26,20,26,40,17,100,86,10,47,90,76,77,70,76,97,50,86,107,30,96,107,126,107,146,27,46,17,10,96,28,106,20,76,38,106,30,56,48,106,40,56,48,96,40,46,58,96,40,36,68,96,60,78,96,60,78,86,80,98,170,58,180,38,520",
  "hydrangea:32": "740,36,30,36,220,116,30,57,120,136,10,67,120,116,107,110,106,117,100,106,147,70,116,147,60,126,157,20,156,157,10,176,147,206,47,56,27,10,226,17,76,20,136,48,136,20,116,68,136,30,106,58,146,50,86,58,146,60,76,68,136,60,76,78,126,60,66,78,146,50,56,88,146,70,26,98,146,90,98,146,90,98,136,100,108,56,180,138,240,88,250,68,270,38,770"
};
  const flowers = Object.freeze(['daisy','tulip','sunflower','hydrangea']);
  const key = (name,size) => 'flower-head-preview:'+name+':'+size;
  const guardianMode = new URLSearchParams(window.location.search).get('person');
  const guardianSizes = Object.freeze([24,28,32,36,40,44,48,56]);
  const guardianSize = guardianSizes.includes(Number(guardianMode)) ? Number(guardianMode) : 32;
  // Keep the outline inside the cell, so adjacent flowers never overlap.
  function outlinedPixels(pixels, size) {
    const inner = size - 2, result = new Uint8Array(size * size);
    for (let y=0;y<inner;y++) for (let x=0;x<inner;x++) {
      const sx=Math.floor((x+0.5)*size/inner), sy=Math.floor((y+0.5)*size/inner);
      result[(y+1)*size+x+1]=Number(pixels[sy*size+sx]);
    }
    const core=result.slice();
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const i=y*size+x;
      if(core[i]) continue;
      if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a>=0&&a<size&&b>=0&&b<size&&core[b*size+a])) result[i]=9;
    }
    return result;
  }
  function install(scene) {
    for (const [id,packed] of Object.entries(runs)) {
      const [name,sizeText] = id.split(':'), size = Number(sizeText), k = key(name,size);
      if (scene.textures.exists(k)) continue;
      const pixels = packed.split(',').map(run=>run.slice(-1).repeat(Number(run.slice(0,-1)))).join('');
      if (pixels.length !== size * size) throw new Error('Invalid preview sprite: '+id);
      const texture = scene.textures.createCanvas(k,size,size);
      const ctx = texture.getContext(), image = ctx.createImageData(size,size);
      const display=name==='guardian'?pixels:outlinedPixels(pixels,size);
      for (let i=0;i<display.length;i++) {
        const index=Number(display[i]);
        if (!index) continue;
        const color = window.GardenPalette.n[index===9?'ink':roles[index]];
        if (color===undefined) throw new Error('Invalid palette role: '+index);
        image.data.set([(color>>16)&255,(color>>8)&255,color&255,255],i*4);
      }
      ctx.putImageData(image,0,0); texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
  function draw(scene, spec, colors, gardenRaster, patrolBounds, patrolPosition) {
    install(scene);
    const g=spec.garden;
    const occupied=new Set(Array.from({length:g.columns*g.rows},(_,i)=>i));
    const textureKey='flower-head-preview:soil:'+g.cell;
    const texture=scene.textures.exists(textureKey)?scene.textures.get(textureKey):
      scene.textures.createCanvas(textureKey,g.size,g.size);
    const soil=scene.add.image(g.x+g.size/2,g.y+g.size/2,textureKey)
      .setDepth(-1).setName('garden-preview-soil');
    function refreshSoil() {
      const z=scene.cameras.main.zoom, raster=gardenRaster(occupied,g,z);
      if(texture.width!==raster.width||texture.height!==raster.height)texture.setSize(raster.width,raster.height);
      soil.setTexture(textureKey).setDisplaySize(raster.width/z,raster.height/z)
        .setPosition((raster.x+raster.width/2)/z,(raster.y+raster.height/2)/z);
      const ctx=texture.getContext();
      ctx.clearRect(0,0,raster.width,raster.height);
      // Continuous soil, no internal seams. Preserve only the existing outer frame
      // and its four cut corners, snapped to native output pixels.
      const w=raster.width,h=raster.height;
      const left=Math.max(1,Math.round((g.x+g.line)*z)-raster.x);
      const top=Math.max(1,Math.round((g.y+g.line)*z)-raster.y);
      const right=Math.max(1,raster.x+w-Math.round((g.x+g.size-g.line)*z));
      const bottom=Math.max(1,raster.y+h-Math.round((g.y+g.size-g.line)*z));
      ctx.fillStyle='#'+colors.gardenBorder.toString(16).padStart(6,'0');
      ctx.fillRect(left,0,w-left-right,top);
      ctx.fillRect(left,h-bottom,w-left-right,bottom);
      ctx.fillRect(0,top,left,h-top-bottom);
      ctx.fillRect(w-right,top,right,h-top-bottom);
      ctx.fillStyle='#'+colors.gardenSoil.toString(16).padStart(6,'0');
      ctx.fillRect(left,top,w-left-right,h-top-bottom);
      texture.refresh(); texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for(const index of occupied){
      const col=index%g.columns,row=Math.floor(index/g.columns);
      const name=flowers[(col+row)%flowers.length];
      scene.add.image(g.x+col*g.pitch+g.line+g.cell/2,g.y+row*g.pitch+g.line+g.cell/2,key(name,g.cell))
        .setDisplaySize(g.cell,g.cell).setDepth(1).setName('garden-preview-flower:'+index);
    }
    const bounds=patrolBounds(occupied);
    // Keep larger comparison sprites inside the battlefield, including ?garden=32.
    // Default garden patrol coordinates remain unchanged at every comparison size.
    const half=guardianSize/2;
    bounds.top=Math.max(bounds.top,spec.top+half);
    bounds.bottom=Math.min(bounds.bottom,spec.height-spec.bottom-half);
    let distance=(bounds.right-bounds.left)/2;
    const start=patrolPosition(bounds,distance);
    const guardian=scene.add.image(start.x,start.y,key('guardian',24))
      .setDisplaySize(guardianSize,guardianSize).setDepth(2).setName('placeholder:guardian:0');
    const update=(_time,delta)=>{
      distance+=Math.max(0,Math.min(delta,100))*0.072;
      const p=patrolPosition(bounds,distance);guardian.setPosition(p.x,p.y);
    };
    refreshSoil();
    scene.events.on('update',update);
    scene.scale.on('resize',refreshSoil);
    scene.events.once('shutdown',()=>{
      scene.events.off('update',update);
      scene.scale.off('resize',refreshSoil);
    });
  }
  window.GardenFlowerHeadPreview=Object.freeze({draw,install,flowers,key,guardianSize,outlinedPixels});
}());
