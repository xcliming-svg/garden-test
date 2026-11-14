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
  // User 7(1).svg: all caterpillar parts; 30×16 core, 1px ink outline.
  // Native 32×32 transparent frame, visible bounds 32×18; preserve source aspect.
  const caterpillarRle = '2260,22,40,22,230,12,21,12,20,12,21,12,220,12,31,12,10,12,31,12,210,12,31,22,31,12,230,12,21,22,21,12,240,12,61,12,240,12,61,12,10,42,30,42,110,12,81,12,41,32,41,72,30,12,281,12,20,12,291,12,10,12,301,22,301,12,10,12,291,12,10,12,291,12,20,12,271,12,40,82,51,12,131,12,120,52,10,72,41,22,260,42,2280';
  const flowers = Object.freeze(['daisy','tulip','sunflower','hydrangea']);
  const key = (name,size) => 'flower-head-preview:'+name+':'+size;
  const guardianMode = new URLSearchParams(window.location.search).get('person');
  const guardianSizes = Object.freeze([24,28,32,36,38,40,44,48,56]);
  const guardianSize = guardianSizes.includes(Number(guardianMode)) ? Number(guardianMode) : 40;
  const enemySize = 32;
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
  // User-supplied pink-haired sprout guardian. Alpha threshold 128 crop:
  // 511×673 source pixels, downsampled to 30×40 with Garden 16 color roles.
  // The existing drawn outline is included in the 40px height, not added outside.
  const guardianRows = [
  "000000011111000000111110000000",
  "000001122222100001222221100000",
  "000001122222100001222221100000",
  "000001122222211112222221100000",
  "000001122222211112222221100000",
  "000000012222221122222210000000",
  "000000012222221122222210000000",
  "000000001111122221111100000000",
  "000000111133311113331111000000",
  "000000111133311113331111000000",
  "000001133333333333333331100000",
  "000001333333333333333333100000",
  "001111333333333333333333111100",
  "001111333333333333333333111100",
  "111333333311333333113333333111",
  "113333333311333333113333333311",
  "113333333311333333113333333311",
  "113333333144133331441333333311",
  "113333111444411114444111333311",
  "001333114444444444444411333100",
  "001333114441444444144411333100",
  "000113114441444444144411311000",
  "000113114441444444144411311000",
  "000011114444444444444411111000",
  "000001111444444444444111100000",
  "000000011444444444444110000000",
  "000000000114444444411000000000",
  "000000000111111111111000000000",
  "000000011112222222211110000000",
  "000001111222222222222111100000",
  "000001144222222222222441100000",
  "000001144222222222222441100000",
  "000001144122222222221441100000",
  "000000111122222222221111000000",
  "000000111122222222221111000000",
  "000000000111111111111000000000",
  "000000000155551155551000000000",
  "000000000155551155551000000000",
  "000000000155551155551000000000",
  "000000000011110011110000000000"
];
  const guardianRoles = [null,'slate','growth','red','sand','bark'];
  const guardianWidth = Math.round(guardianSize * 30 / 40);
  function installGuardian(scene) {
    const w=guardianWidth,h=guardianSize,k=key('guardian-sprout',h);
    if(scene.textures.exists(k)) return k;
    const texture=scene.textures.createCanvas(k,w,h),ctx=texture.getContext(),image=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const index=Number(guardianRows[Math.floor((y+0.5)*40/h)][Math.floor((x+0.5)*30/w)]);
      if(!index)continue;
      const c=window.GardenPalette.n[guardianRoles[index]];
      image.data.set([(c>>16)&255,(c>>8)&255,c&255,255],(y*w+x)*4);
    }
    ctx.putImageData(image,0,0);texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return k;
  }
  function installEnemy(scene) {
    const k=key('caterpillar',enemySize);
    if(scene.textures.exists(k)) return;
    const pixels=caterpillarRle.split(',').map(run=>run.slice(-1).repeat(Number(run.slice(0,-1)))).join('');
    if(pixels.length!==enemySize*enemySize) throw new Error('Invalid caterpillar pixels');
    const texture=scene.textures.createCanvas(k,enemySize,enemySize);
    const ctx=texture.getContext(),image=ctx.createImageData(enemySize,enemySize);
    for(let i=0;i<pixels.length;i++){
      if(pixels[i]==='0') continue;
      const c=window.GardenPalette.n[pixels[i]==='1'?'growth':'slate'];
      image.data.set([(c>>16)&255,(c>>8)&255,c&255,255],i*4);
    }
    ctx.putImageData(image,0,0);texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  function draw(scene, spec, colors, gardenRaster, patrolBounds, patrolPosition, updateHud, itemPreview) {
    install(scene);installEnemy(scene);
    const g=spec.garden,occupied=new Set([44,45,54,55]);
    const textureKey='flower-head-preview:soil:'+g.cell;
    const texture=scene.textures.exists(textureKey)?scene.textures.get(textureKey):
      scene.textures.createCanvas(textureKey,g.size,g.size);
    const soil=scene.add.image(g.x+g.size/2,g.y+g.size/2,textureKey)
      .setDepth(-1).setName('garden-preview-soil');
    let hover=null;
    function refreshSoil(target=hover){
      hover=target;
      const z=scene.cameras.main.zoom,raster=gardenRaster(occupied,g,z);
      if(texture.width!==raster.width||texture.height!==raster.height)texture.setSize(raster.width,raster.height);
      soil.setTexture(textureKey).setDisplaySize(raster.width/z,raster.height/z)
        .setPosition((raster.x+raster.width/2)/z,(raster.y+raster.height/2)/z);
      const ctx=texture.getContext();
      ctx.clearRect(0,0,raster.width,raster.height);
      function fill(index,color,alpha){
        const x=g.x+index%g.columns*g.pitch,y=g.y+Math.floor(index/g.columns)*g.pitch;
        const x0=Math.round(x*z)-raster.x,y0=Math.round(y*z)-raster.y;
        const x1=Math.round((x+g.outer)*z)-raster.x,y1=Math.round((y+g.outer)*z)-raster.y;
        ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.globalAlpha=alpha;
        ctx.fillRect(x0,y0,x1-x0,y1-y0);
      }
      for(const i of occupied)fill(i,colors.gardenSoil,1);
      if(hover!==null){
        const candidates=window.GardenGameLayout.gardenCandidates(occupied);
        if(candidates.has(hover))fill(hover,colors.flowerBorder,0.4);
        else for(const i of candidates)fill(i,colors.flowerBorder,0.22);
      }
      ctx.globalAlpha=1;texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    function center(i){return {x:g.x+(i%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2};}
    function addFlower(i,name){
      const p=center(i);
      scene.add.image(p.x,p.y,key(name,g.cell)).setDisplaySize(g.cell,g.cell).setDepth(1).setName('garden-preview-flower:'+i);
    }
    [...occupied].forEach((i,n)=>addFlower(i,flowers[n]));
    function clampedBounds(keys){
      const b=patrolBounds(keys),half=guardianSize/2;
      b.top=Math.max(b.top,spec.top+half);b.bottom=Math.min(b.bottom,spec.height-spec.bottom-half);
      return b;
    }
    function plant(model,drop,index){
      const next=new Set(occupied);next.add(index);
      if(!model.plant(drop.id,index,clampedBounds(next)))return false;
      occupied.add(index);addFlower(index,drop.name);refreshSoil(null);return true;
    }
    const bounds=clampedBounds(occupied),start=patrolPosition(bounds,(bounds.right-bounds.left)/2);
    const guardian=scene.add.image(start.x,start.y,installGuardian(scene))
      .setDisplaySize(guardianWidth,guardianSize).setDepth(2).setName('placeholder:guardian:0');
    const loot=window.GardenLootPreview.attach(scene,spec,{occupied,refresh:refreshSoil,center,plant},itemPreview);
    refreshSoil(null);
    const resize=()=>refreshSoil();
    scene.scale.on('resize',resize);
    scene.events.once('shutdown',()=>scene.scale.off('resize',resize));
    window.GardenCombatPreview.attach(scene,spec,bounds,patrolPosition,guardian,key('caterpillar',enemySize),enemySize,updateHud,loot);
  }
  window.GardenFlowerHeadPreview=Object.freeze({draw,install,flowers,key,guardianSize,outlinedPixels,enemySize});
}());
