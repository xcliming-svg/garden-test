(function(){
  'use strict';
  // Opt-in rendering-only comparison. No SVG, movement, or combat changes.
  const params=new URLSearchParams(window.location.search);
  const preset=params.get('clarity')==='1';
  const flag=name=>params.get(name)==='1'||(params.get(name)!=='0'&&preset);
  function percent(name,fallback){
    const value=params.get(name);
    return value!==null&&/^\d+$/.test(value)?Math.max(0,Math.min(100,Number(value)))/100:fallback;
  }
  function outlineWidth(){
    const v=params.get('enemyOutlineWidth');
    return v!==null&&/^\d+(?:\.\d+)?$/.test(v)?Math.max(.25,Math.min(2,Number(v))):1;
  }
  const config=Object.freeze({preset,enemyTone:flag('enemyTone'),fairyOutline:flag('fairyOutline'),
    ySort:flag('ySort'),heroMarker:flag('heroMarker'),flowerFocus:flag('flowerFocus'),heroOcclusion:flag('heroOcclusion'),
    waterOcclusion:params.get('waterOcclusion')==='1',flowerOcclusion:params.get('flowerOcclusion')==='1',
    flowerTone:params.get('flowerTone')==='1',enemyOutline:params.get('enemyOutline')==='1',
    flowerBrightness:percent('flowerBrightness',.85),flowerSaturation:percent('flowerSaturation',.65),
    flowerContrast:percent('flowerContrast',.85),
    enemyOutlineWidth:outlineWidth(),
    enemyOutlineColor:params.get('enemyOutlineColor')==='light'?'light':'dark',
    occlusionAlpha:percent('occlusionAlpha',.50),
    brightness:percent('enemyBrightness',.90),saturation:percent('enemySaturation',.75)});
  const toneKey=k=>'clarity:tone:'+k;
  function tonePixels(data,brightness=config.brightness,saturation=config.saturation){
    for(let i=0;i<data.length;i+=4){
      if(!data[i+3])continue;
      const l=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
      for(let c=0;c<3;c++)data[i+c]=Math.round((l+(data[i+c]-l)*saturation)*brightness);
    }
    return data;
  }
  function enemyTexture(scene,k){
    if(!config.enemyTone)return k;
    const target=toneKey(k);
    if(!scene.textures.exists(target)){
      const src=scene.textures.get(k).getSourceImage();
      const t=scene.textures.createCanvas(target,src.width,src.height),ctx=t.getContext();
      ctx.drawImage(src,0,0);
      const img=ctx.getImageData(0,0,src.width,src.height);
      tonePixels(img.data);ctx.putImageData(img,0,0);t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    return target;
  }
  // Muted flower material: lower chroma, highlights and internal contrast
  // without changing transparency, growth geometry, or the original textures.
  const flowerToneKey=k=>'clarity:flower-tone:'+k;
  function flowerPixels(data,brightness=config.flowerBrightness,saturation=config.flowerSaturation,contrast=config.flowerContrast){
    for(let i=0;i<data.length;i+=4){
      if(!data[i+3])continue;
      const l=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
      for(let c=0;c<3;c++)data[i+c]=Math.round((96+(l+(data[i+c]-l)*saturation-96)*contrast)*brightness);
    }
    return data;
  }
  function flowerTexture(scene,k){
    if(!config.flowerTone)return k;
    const target=flowerToneKey(k);
    if(!scene.textures.exists(target)){
      const src=scene.textures.get(k).getSourceImage();
      const t=scene.textures.createCanvas(target,src.width,src.height),ctx=t.getContext();
      ctx.drawImage(src,0,0);
      const img=ctx.getImageData(0,0,src.width,src.height);
      flowerPixels(img.data);ctx.putImageData(img,0,0);t.refresh();
      t.setFilter(scene.textures.get(k).source[0].scaleMode===Phaser.Textures.FilterMode.NEAREST?Phaser.Textures.FilterMode.NEAREST:Phaser.Textures.FilterMode.LINEAR);
    }
    return target;
  }
  // A separate outline around enemies, not a tint on their bodies.
  // Keep the original 512px coordinate system/anchor and cache each pose key.
  const enemyOutlineKey=(k,scale)=>'clarity:enemy-outline:'+Math.max(1,Math.round(config.enemyOutlineWidth/scale))+':'+k;
  function enemyRenderTexture(scene,k,scale){
    const body=enemyTexture(scene,k);
    if(!config.enemyOutline)return body;
    const radius=Math.max(1,Math.round(config.enemyOutlineWidth/scale)),target=enemyOutlineKey(body,scale);
    if(!scene.textures.exists(target)){
      const src=scene.textures.get(body).getSourceImage();
      const t=scene.textures.createCanvas(target,src.width,src.height),ctx=t.getContext();
      // 32 samples around the outer edge limit jagged gaps at large raster radii.
      for(let i=0;i<32;i++){
        const a=i*Math.PI/16;
        ctx.drawImage(src,Math.round(Math.cos(a)*radius),Math.round(Math.sin(a)*radius));
      }
      ctx.globalCompositeOperation='source-in';
      ctx.fillStyle=config.enemyOutlineColor==='light'?window.GardenPalette.hex.silver:window.GardenPalette.roles.hex.ink;
      ctx.fillRect(0,0,src.width,src.height);
      ctx.globalCompositeOperation='source-over';ctx.drawImage(src,0,0);
      t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    return target;
  }
  // Alpha silhouette dilation cached per expression and raster radius. A one
  // logical-pixel outline is independent of the source's transparent margin.
  function fairyTexture(scene,k,logicalScale){
    if(!config.fairyOutline)return k;
    const src=scene.textures.get(k).getSourceImage();
    const radius=Math.max(1,Math.round(src.width/(1000*logicalScale)));
    const target='clarity:outline:'+radius+':'+k;
    if(!scene.textures.exists(target)){
      const t=scene.textures.createCanvas(target,src.width,src.height),ctx=t.getContext();
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8;
        ctx.drawImage(src,Math.round(Math.cos(a)*radius),Math.round(Math.sin(a)*radius));
      }
      ctx.globalCompositeOperation='source-in';ctx.fillStyle=window.GardenPalette.hex.paper;
      ctx.fillRect(0,0,src.width,src.height);
      ctx.globalCompositeOperation='source-over';ctx.drawImage(src,0,0);
      t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    return target;
  }
  const enemyDepth=(ground,spec)=> (config.ySort?2:3)+ground/spec.height;
  const fairyDepth=(center,height,spec)=>2+(config.ySort?(center+height/2)/spec.height+.000001:center/spec.height);
  // Cache only the visible alpha silhouette. One logical-pixel sampling of
  // the overlap avoids false positives from the transparent 512px canvas.
  const silhouettes=new WeakMap();
  function silhouette(texture){
    if(silhouettes.has(texture))return silhouettes.get(texture);
    const src=texture.getSourceImage(),w=src.width,h=src.height;
    // Healthy SVG flowers may be HTMLImageElements, unlike composited enemies.
    const canvas=typeof src.getContext==='function'?src:document.createElement('canvas');
    if(canvas!==src){canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(src,0,0);}
    const rgba=canvas.getContext('2d').getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);
    let l=w,t=h,r=0,b=0;
    for(let i=0;i<mask.length;i++)if(rgba[i*4+3]>=128){
      mask[i]=1;const x=i%w,y=Math.floor(i/w);
      l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);
    }
    const data={w,h,mask,l,t,r,b};silhouettes.set(texture,data);return data;
  }
  function occlusionShape(image){
    const m=silhouette(image.texture),sx=image.scaleX*(image.flipX?-1:1),sy=image.scaleY*(image.flipY?-1:1);
    const cos=Math.cos(image.rotation),sin=Math.sin(image.rotation),ox=image.displayOriginX,oy=image.displayOriginY;
    const x=image.x,y=image.y;
    let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
    for(const px of [m.l,m.r])for(const py of [m.t,m.b]){
      const dx=(px-ox)*sx,dy=(py-oy)*sy,wx=x+dx*cos-dy*sin,wy=y+dx*sin+dy*cos;
      l=Math.min(l,wx);r=Math.max(r,wx);t=Math.min(t,wy);b=Math.max(b,wy);
    }
    return {m,sx,sy,cos,sin,ox,oy,x,y,l,t,r,b,depth:image.depth};
  }
  function opaqueAt(s,x,y){
    const dx=x-s.x,dy=y-s.y;
    const u=Math.floor((dx*s.cos+dy*s.sin)/s.sx+s.ox),v=Math.floor((-dx*s.sin+dy*s.cos)/s.sy+s.oy);
    return u>=0&&u<s.m.w&&v>=0&&v<s.m.h&&s.m.mask[v*s.m.w+u]===1;
  }
  function coversHero(hero,enemy){
    if(!hero||enemy.depth<=hero.depth)return false;
    const l=Math.max(hero.l,enemy.l),r=Math.min(hero.r,enemy.r),t=Math.max(hero.t,enemy.t),b=Math.min(hero.b,enemy.b);
    if(l>=r||t>=b)return false;
    // Sample at most one logical pixel apart; both silhouettes must be
    // sufficiently opaque at the same point, not just intersecting boxes.
    const nx=Math.max(1,Math.ceil(r-l)),ny=Math.max(1,Math.ceil(b-t));
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const x=l+(i+.5)*(r-l)/nx,y=t+(j+.5)*(b-t)/ny;
      if(opaqueAt(hero,x,y)&&opaqueAt(enemy,x,y))return true;
    }
    return false;
  }
  function heroEnemyAlpha(hero,image){
    if(!config.heroOcclusion||!hero||image.depth<=hero.depth)return 1;
    return coversHero(hero,occlusionShape(image))?config.occlusionAlpha:1;
  }
  // Resolve visible protected targets once per frame. Flower stages and newly
  // planted flowers use the current texture, with the same cached alpha masks.
  function occlusionTargets(scene,patrol){
    const targets=[];
    const add=image=>{if(image&&image.visible&&image.active&&image.alpha>0)targets.push(occlusionShape(image));};
    if(config.heroOcclusion)add(patrol.actors[0]?.image);
    if(config.waterOcclusion)for(const a of patrol.actors.slice(1))add(a.image);
    if(config.flowerOcclusion){
      if(scene.flowerGrowth)for(const f of scene.flowerGrowth.entries.values())add(f.image);
      else for(const image of scene.children.list)if(image.name?.startsWith('garden-preview-flower:'))add(image);
    }
    return targets;
  }
  function protectedEnemyAlpha(targets,image){
    if(!targets.length)return 1;
    const enemy=occlusionShape(image);
    return targets.some(target=>coversHero(target,enemy))?config.occlusionAlpha:1;
  }
  function gardenFocus(scene,spec,occupied){
    if(!config.flowerFocus)return null;
    const gfx=scene.add.graphics().setDepth(.8).setName('clarity:flower-focus');
    let signature='';
    return {gfx,render(){
      const next=[...occupied].sort((a,b)=>a-b).join(',');
      if(next===signature)return;signature=next;gfx.clear();
      const g=spec.garden;gfx.fillStyle(window.GardenPalette.n.growthLight,.13);
      for(const i of occupied)gfx.fillRect(g.x+i%g.columns*g.pitch+g.line,g.y+Math.floor(i/g.columns)*g.pitch+g.line,g.cell,g.cell);
    }};
  }
  function heroMarker(scene,spec){
    if(!config.heroMarker)return null;
    const gfx=scene.add.graphics().setDepth(4.5).setName('clarity:hero-marker');
    gfx.fillStyle(window.GardenPalette.n.bark,1).fillTriangle(-5,-1,5,-1,0,6);
    gfx.fillStyle(window.GardenPalette.n.gold,1).fillTriangle(-3,0,3,0,0,4);
    return {gfx,render(hero){
      gfx.setPosition(hero.image.x,Math.max(spec.top+2,hero.image.y-hero.visibleHeight-7));
    }};
  }
  window.GardenClarityPreview=Object.freeze({config,tonePixels,toneKey,enemyTexture,flowerPixels,flowerToneKey,flowerTexture,enemyOutlineKey,enemyRenderTexture,fairyTexture,enemyDepth,fairyDepth,gardenFocus,heroMarker,occlusionShape,coversHero,heroEnemyAlpha,occlusionTargets,protectedEnemyAlpha});
}());
