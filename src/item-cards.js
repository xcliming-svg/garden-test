(function(){
  'use strict';
  // Inspect all supplied items independently of combat, using their vector artwork.
  const G=window.GardenFlowerGrowth,U=window.GardenUI,P=window.GardenPalette;
  const params=new URLSearchParams(window.location.search);
  const enabled=window.GardenFairyPatrol.enabled&&!window.GardenEnemyPreview.enabled&&G.enabled&&params.get('cards')!=='0'&&params.get('cards')!=='legacy';
  const entries=Object.freeze([
    ['shoe','신발','01_shoe.svg'],
    ['balloon','풍선','05_balloon.svg'],
    ['boomerang','부메랑','05_boomerang.svg'],
    ['shield','방패','05_shield.svg'],
    ['wheel','바퀴','05_wheel.svg'],
    ['flowerpot','화분','06_flowerpot.svg'],
    ['paper-plane','종이비행기','1_종이비행기_단일파츠(1).svg'],
    ['bouncy-ball','탱탱볼','2_탱탱볼_단일파츠(3).svg'],
    ['yellow-floor','노랑 장판','3_노랑장판_단일파츠(1).svg'],
    ['sprinkler','스프링쿨러','3_스프링쿨러_단일파츠(4).svg'],
    ['rock','돌','4_돌_단일파츠(1).svg'],
    ['broom','빗자루','4_빗자루_단일파츠(1).svg']
  ].map(([id,name,file])=>Object.freeze({id,name,file})));
  const relics=Object.freeze([
    Object.freeze({id:'gem',name:'보석',file:'07_gem.svg',span:12}),
    Object.freeze({id:'heart',name:'하트',file:'07_heart.svg',span:14})
  ]);
  const raw=id=>'item-svg:source:'+id, key=id=>'item-svg:trim:'+id;
  const flowerId=name=>'flower-'+name;
  function preload(scene){
    if(!enabled)return;
    for(const item of [...entries,...relics]){
      const k=raw(item.id);
      if(!scene.textures.exists(k))scene.load.svg(k,window.GardenSvgPalette.path('items/'+item.file),{width:512,height:512});
    }
    // Growth already preloads healthy full-bloom SVGs at native source resolution.
  }
  function trim(scene,id,sourceKey){
    const k=key(id);
    if(scene.textures.exists(k))return k;
    if(!scene.textures.exists(sourceKey))throw Error('Missing item SVG: '+sourceKey);
    const source=scene.textures.get(sourceKey).getSourceImage();
    const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,0,0);
    const {data}=ctx.getImageData(0,0,c.width,c.height);
    let left=c.width,right=-1,top=c.height,bottom=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      if(data[(y*c.width+x)*4+3]===0)continue;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(right<left)throw Error('Empty item SVG: '+sourceKey);
    const w=right-left+1,h=bottom-top+1;
    const tex=scene.textures.createCanvas(k,w,h);
    tex.getContext().drawImage(c,left,top,w,h,0,0,w,h);
    tex.refresh();tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return k;
  }
  // A 512px texture sampled directly at 24px in WebGL loses thin strokes.
  // Pre-filter the artwork at the current output pixel size, then sample the
  // near-native texture with LINEAR. Keep the source and logical bounds intact.
  const displayState=new WeakMap();
  function state(scene){
    if(displayState.has(scene))return displayState.get(scene);
    const images=new Map(),keys=new Set();
    const resize=()=>{
      const previous=new Set(keys);keys.clear();
      for(const [image,info] of images)fit(image,info.texture,info.span);
      for(const k of previous)if(!keys.has(k)&&scene.textures.exists(k))scene.textures.remove(k);
    };
    const cleanup=()=>{
      scene.scale.off('resize',resize);
      images.clear();displayState.delete(scene);
      // Textures are tiny and shared across restarts; old scale variants
      // are released on resize, not while display objects are shutting down.
    };
    scene.scale.on('resize',resize);
    scene.events.once('shutdown',cleanup);
    const result={images,keys};displayState.set(scene,result);return result;
  }
  function downsample(source,width,height,ctx){
    let current=source;
    // Successive area-like reductions prevent aliasing of narrow SVG details.
    while(current.width>width*2||current.height>height*2){
      const c=document.createElement('canvas');
      c.width=Math.max(width,Math.ceil(current.width/2));
      c.height=Math.max(height,Math.ceil(current.height/2));
      const step=c.getContext('2d');
      step.imageSmoothingEnabled=true;step.imageSmoothingQuality='high';
      step.drawImage(current,0,0,c.width,c.height);current=c;
    }
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(current,0,0,width,height);
  }
  function fit(image,texture,span){
    const scene=image.scene,source=scene.textures.get(texture).getSourceImage();
    const scale=span/Math.max(source.width,source.height);
    const logicalW=source.width*scale,logicalH=source.height*scale;
    const zoom=scene.cameras.main.zoom||1;
    const width=Math.max(1,Math.round(logicalW*zoom)),height=Math.max(1,Math.round(logicalH*zoom));
    const k=texture+':display:'+width+'x'+height;
    const cache=state(scene);cache.keys.add(k);cache.images.set(image,{texture,span});
    if(!scene.textures.exists(k)){
      const tex=scene.textures.createCanvas(k,width,height);
      downsample(source,width,height,tex.getContext());
      tex.refresh();tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    if(image.texture.key!==k)image.setTexture(k);
    return image.setDisplaySize(logicalW,logicalH);
  }
  const itemSpan=(size,id)=>size-(id==='broom'?4:8);
  function card(scene,x,y,size,texture,kind,id){
    const R=P.reference.n;
    const border=U.pixelBox(scene,0,0,size,size,R.tabBorder);
    const face=U.pixelBox(scene,0,0,size-2,size-2,R.tab,{cut:false});
    const image=fit(scene.add.image(0,0,texture),texture,kind==='item'?itemSpan(size,id):size-6);
    const group=scene.add.container(x,y,[border,face,image]).setSize(size,size).setDepth(5);
    group.setStrokeStyle=(_width,_color,alpha)=>{
      border.setFillStyle(alpha?(kind==='flower'?R.flowerBorder:R.itemBorder):R.tabBorder,1);return group;
    };
    return group;
  }
  function setIcon(group,item){
    if(item?.texture)fit(group.list[2],item.texture,itemSpan(group.width,item.id));
  }
  function draw(scene,spec,assets){
    const cards=[],flowers=[],ground=[];
    for(let i=0;i<G.names.length;i++){
      const name=G.names[i],texture=trim(scene,flowerId(name),G.key(name,G.maxStage,100));
      const x=156+(i%3)*56,y=192+Math.floor(i/3)*56;
      const marker=card(scene,x,y,assets.flower.dropSize,texture,'flower').setName('placeholder:flower:'+i);
      flowers.push({marker,x,y,spriteName:name,idleDepth:marker.depth});
    }
    for(let i=0;i<entries.length;i++){
      const item=entries[i],texture=trim(scene,item.id,raw(item.id));
      const x=682+(i%4)*56,y=126+Math.floor(i/4)*56;
      const marker=card(scene,x,y,assets.item.dropSize,texture,'item',item.id).setName('placeholder:item:'+String(i).padStart(2,'0'));
      cards.push({marker,x,y,idleDepth:marker.depth,item:Object.freeze({id:item.id,name:item.name,texture,desc:'일반 아이템 · 효과 미구현',stats:Object.freeze({})})});
    }
    for(let i=0;i<relics.length;i++){
      const item=relics[i],texture=trim(scene,item.id,raw(item.id));
      const x=212+i*56,y=360;
      const image=fit(scene.add.image(x,y,texture),texture,item.span).setDepth(4).setName('ground-relic:'+item.id);
      ground.push(image);
    }
    scene.itemCardPreview={cards,flowers,ground};
    scene.events.once('shutdown',()=>delete scene.itemCardPreview);
    return {cards,flowers};
  }
  window.GardenItemCards=Object.freeze({enabled,entries,relics,preload,draw,setIcon,key});
}());
