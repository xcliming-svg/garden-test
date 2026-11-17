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
  const config=Object.freeze({preset,enemyTone:flag('enemyTone'),fairyOutline:flag('fairyOutline'),
    ySort:flag('ySort'),heroMarker:flag('heroMarker'),flowerFocus:flag('flowerFocus'),
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
  window.GardenClarityPreview=Object.freeze({config,tonePixels,toneKey,enemyTexture,fairyTexture,enemyDepth,fairyDepth,gardenFocus,heroMarker});
}());
