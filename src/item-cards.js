(function(){
  'use strict';
  // Inspect all supplied items independently of combat, using their vector artwork.
  const G=window.GardenFlowerGrowth,U=window.GardenUI,P=window.GardenPalette;
  const params=new URLSearchParams(window.location.search);
  const weaponCombat=window.GardenEnemyPreview.enabled&&params.get('weapons')==='1'&&params.get('attack')!=='0';
  const enabled=window.GardenFairyPatrol.enabled&&(!window.GardenEnemyPreview.enabled||weaponCombat)&&G.enabled&&params.get('cards')!=='0'&&params.get('cards')!=='legacy';
  // UI-only specimen values. These never feed patrol, projectile or enemy state.
  const minLevel=1,maxLevel=3;
  const balance=window.GardenWeaponBalance;
  const entries=Object.freeze([
    ['shoe','신발','01_shoe.svg','이동 속도가 증가합니다.','moveSpeed',10],
    ['balloon','물풍선','05_balloon.svg','떨어진 지점에서 터지며 주변 적들에게 피해를 줍니다.','dps',24],
    ['boomerang','부메랑','05_boomerang.svg','날아갔다 돌아오며 경로상의 적들을 공격합니다.','dps',18],
    ['shield','방패','05_shield.svg','방어력이 증가합니다.','defense',6],
    ['wheel','바퀴','05_wheel.svg','적을 향해 돌진하며 경로상의 적들에게 피해를 줍니다.','dps',22],
    ['flowerpot','화분','06_flowerpot.svg','적의 머리 위로 떨어져 피해를 줍니다.','dps',26],
    ['paper-plane','종이비행기','1_종이비행기_단일파츠(1).svg','적을 추적해 명중할 때까지 날아갑니다.','dps',20],
    ['bouncy-ball','탱탱볼','2_탱탱볼_단일파츠(3).svg','적에게 부딪히면 튕겨 나가 다른 적을 공격합니다.','dps',16],
    ['yellow-floor','끈끈이','3_노랑장판_단일파츠(1).svg','영역에 들어온 적의 이동 속도를 감소시킵니다.',null,0,'적 이동 속도 -30%'],
    ['sprinkler','스프링클러','3_스프링쿨러_단일파츠(4).svg','원형으로 물을 뿌려 주변 적들을 공격합니다.','dps',18],
    ['rock','돌멩이','4_돌_단일파츠(1).svg','적을 향해 돌멩이를 던져 기본 공격을 합니다.','dps',12],
    ['broom','빗자루','4_빗자루_단일파츠(1).svg','설치 지점 주변을 돌며 적들을 쓸어 공격합니다.','dps',20]
  ].map(([id,name,file,desc,stat,value,tooltipEffect])=>Object.freeze({id,name,file,desc,level:minLevel,stats:Object.freeze(stat?{[stat]:value}:{}),tooltipEffect})));
  // The source's bristle centre (1097,572) and handle tip (1183,380)
  // define its longitudinal axis. Rotate that axis to -45° before cropping,
  // so the diagonal can occupy the card without enlarging the card itself.
  const broomRotation=-Math.PI/4-Math.atan2(380-572,1183-1097);
  const relics=Object.freeze([
    Object.freeze({id:'gem',name:'보석',file:'gem_1000.svg',span:12}),
    Object.freeze({id:'heart',name:'하트',file:'heart_1000.svg',span:12})
  ]);
  // Attack-only effect: not a card, weapon choice or relic.
  const effects=Object.freeze([Object.freeze({id:'water-splash',file:'03_water_splash.svg'})]);
  const raw=id=>'item-svg:source:'+id, key=id=>'item-svg:trim:'+id;
  const flowerId=name=>'flower-'+name;
  function preload(scene){
    // HUD gem is shared by every game mode, even when SVG drop cards are disabled.
    for(const item of enabled?[...entries,...relics,...effects]:relics){
      const k=raw(item.id);
      if(!scene.textures.exists(k))scene.load.svg(k,window.GardenSvgPalette.path('items/'+item.file),{width:512,height:512});
    }
    // Growth already preloads healthy full-bloom SVGs at native source resolution.
  }
  const cropGeometry=new WeakMap();
  function trim(scene,id,sourceKey){
    const k=key(id);
    if(scene.textures.exists(k))return k;
    if(!scene.textures.exists(sourceKey))throw Error('Missing item SVG: '+sourceKey);
    const source=scene.textures.get(sourceKey).getSourceImage();
    const c=document.createElement('canvas');
    const rotate=id==='broom'?broomRotation:0;
    c.width=rotate?Math.ceil(Math.hypot(source.width,source.height))+2:source.width;
    c.height=rotate?c.width:source.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    if(rotate){
      ctx.translate(c.width/2,c.height/2);ctx.rotate(rotate);
      ctx.drawImage(source,-source.width/2,-source.height/2);
      ctx.setTransform(1,0,0,1,0,0);
    }else ctx.drawImage(source,0,0);
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
    cropGeometry.set(tex,{left,top,width:w,height:h,sourceWidth:source.width,sourceHeight:source.height});
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
  // HUD icons reuse the same cropped SVG and output-size texture as ground drops.
  function gemIcon(scene,span){
    const texture=trim(scene,'gem',raw('gem'));
    return fit(scene.add.image(0,0,texture).setOrigin(0,0),texture,span);
  }
  const gemBounds=new WeakMap();
  function gemInk(image){
    const texture=image.texture,source=texture.getSourceImage();
    if(!gemBounds.has(texture)){
      const {width,height}=source,data=source.getContext('2d').getImageData(0,0,width,height).data;
      let left=width,top=height,right=0,bottom=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        if(data[(y*width+x)*4+3]<64)continue;
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
      }
      gemBounds.set(texture,right>left?{left,top,right,bottom}:{left:0,top:0,right:width,bottom:height});
    }
    // Align to the physical pixel grid at exactly the prefiltered texture size.
    const z=image.scene.cameras.main.zoom;
    image.setDisplaySize(source.width/z,source.height/z);
    return gemBounds.get(texture);
  }
  const itemSpan=size=>Math.min(24,size-8);
  function card(scene,x,y,size,texture,kind,id){
    const R=P.reference.n;
    const flower=kind==='flower'&&window.GardenPalette.uiType!==1;
    const baseBorder=flower?R.flowerFrame:R.tabBorder;
    const border=flower?U.cornerFrame(scene,0,0,size,baseBorder):U.pixelBox(scene,0,0,size,size,baseBorder);
    const face=U.pixelBox(scene,0,0,size-2,size-2,R.tab,{cut:false,alpha:flower?0:1});
    const image=fit(scene.add.image(0,0,texture),texture,kind==='item'?itemSpan(size):size-6);
    const group=scene.add.container(x,y,[border,face,image]).setSize(size,size).setDepth(5);
    group.setStrokeStyle=(_width,_color,alpha)=>{
      border.setFillStyle(alpha?(kind==='flower'?R.flowerBorder:R.itemBorder):baseBorder,1);return group;
    };
    return group;
  }
  // Position the entire painted glyph AND shadow inside the bottom-right edge.
  // Padding prevents the 1px shadow from being clipped by the text texture.
  function setLevelLabel(group,level){
    if(!Number.isInteger(level)||level<minLevel||level>maxLevel){
      group.levelLabel?.setVisible(false);return;
    }
    const value='Lv.'+level;
    let label=group.levelLabel;
    if(!label){
      label=U.text(group.scene,0,0,value,8,P.hex.paper).setName('item-level');
      label.setPadding(0,0,2,2);
      group.add(label);group.levelLabel=label;
      label.alignVisible=()=>{
        const c=label.canvas,ctx=label.context,z=label.style.resolution;
        const data=ctx.getImageData(0,0,c.width,c.height).data;
        let right=0,bottom=0;
        for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
          if(!data[(y*c.width+x)*4+3])continue;
          right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
        }
        const edge=group.width/2-2;
        label.levelBaseY=edge-bottom/z;
        label.setPosition(edge-right/z,label.levelBaseY-(group.floatLift||0));
      };
      label.alignVisible();
    }else if(label.text!==value){
      label.setText(value);label.alignVisible();
    }
    label.setVisible(true);
  }
  function setIcon(group,item){
    if(item?.texture)fit(group.list[2],item.texture,itemSpan(group.width));
    setLevelLabel(group,item?.texture?item.level:undefined);
  }
  // Combat art uses visible height, except the approved longest-side boomerang.
  // Card/relic sizing stays independent. The sprinkler's original hub is not
  // the center of its asymmetric alpha bounds: map source points through crop.
  function attackSize(scene,id,span){
    if(!entries.some(item=>item.id===id)&&!effects.some(effect=>effect.id===id))throw Error('Unknown attack art: '+id);
    const texture=trim(scene,id,raw(id)),tex=scene.textures.get(texture),source=tex.getSourceImage();
    const scale=span/(id==='boomerang'?Math.max(source.width,source.height):source.height);
    const result={width:source.width*scale,height:source.height*scale};
    if(id==='sprinkler'){
      const crop=cropGeometry.get(tex);
      // Source path coordinate system (the same transform in original/palette SVG).
      const point=(x,y)=>{
        const sx=1.024174965995*(500+3.2710280374*(x-157.75))-11.965094088847;
        const sy=1.024174965995*(500+3.2710280374*(y-547.25))-11.923102915242;
        return {x:(sx/1000*crop.sourceWidth-crop.left)/crop.width,y:(sy/1000*crop.sourceHeight-crop.top)/crop.height};
      };
      result.pivot=point(157,525);
      result.nozzles=[[254,476],[61,476],[157,628]].map(([x,y])=>{
        const q=point(x,y);
        return {x:(q.x-result.pivot.x)*result.width,y:(q.y-result.pivot.y)*result.height};
      });
    }
    return result;
  }
  function attackImage(scene,id,x,y,span){
    const size=attackSize(scene,id,span),texture=key(id);
    const image=fit(scene.add.image(x,y,texture),texture,Math.max(size.width,size.height));
    if(size.pivot)image.setOrigin(size.pivot.x,size.pivot.y);
    return image;
  }
  function weaponImage(scene,id,x,y,span){return attackImage(scene,id,x,y,span);}
  function effectImage(scene,id,x,y,span){return attackImage(scene,id,x,y,span);}
  function relicImage(scene,kind,x,y){
    const item=relics.find(r=>r.id===kind),texture=trim(scene,kind,raw(kind));
    return fit(scene.add.image(x,y,texture),texture,item.span).setDepth(4);
  }
  function destroyRelic(image){
    displayState.get(image.scene)?.images.delete(image);image.destroy();
  }
  function draw(scene,spec,assets,showGround=true){
    const cards=[],flowers=[],ground=[];
    for(let i=0;i<G.names.length;i++){
      const name=G.names[i],texture=trim(scene,flowerId(name),G.key(name,G.maxStage,100));
      const x=156+(i%3)*56,y=192+Math.floor(i/3)*56;
      const marker=card(scene,x,y,assets.flower.dropSize,texture,'flower').setName('placeholder:flower:'+i);
      flowers.push({marker,x,y,spriteName:name,idleDepth:marker.depth});
    }
    for(let i=0;i<entries.length;i++){
      const original=entries[i],st=weaponCombat?balance.stats(original.id,balance.level):null;
      let item=original;
      if(weaponCombat){
        const desc=st?original.desc:'전투 효과 미구현 (비교용 카드)';
        const detail=st?(original.id==='yellow-floor'?'감속 '+Math.round(st.slow*100)+'%':'피해 '+(Array.isArray(st.damage)?st.damage.join('/'):st.damage))+' · '+st.cooldown+'초 · '+st.range+'px':'';
        item={...original,desc,level:balance.level,stats:st?{dps:balance.nominalDps(original.id,balance.level)}:{},tooltipEffect:detail};
      }
      const texture=trim(scene,item.id,raw(item.id));
      const x=682+(i%4)*56,y=126+Math.floor(i/4)*56;
      const marker=card(scene,x,y,assets.item.dropSize,texture,'item',item.id).setName('placeholder:item:'+String(i).padStart(2,'0'));
      setLevelLabel(marker,item.level);
      cards.push({marker,x,y,idleDepth:marker.depth,item:Object.freeze({id:item.id,name:item.name,texture,desc:item.desc,level:item.level,stats:item.stats,tooltipEffect:item.tooltipEffect})});
    }
    for(let i=0;showGround&&i<relics.length;i++){
      const item=relics[i],texture=trim(scene,item.id,raw(item.id));
      const x=212+i*56,y=360;
      const image=fit(scene.add.image(x,y,texture),texture,item.span).setDepth(4).setName('ground-relic:'+item.id);
      ground.push(image);
    }
    window.GardenGameLayout.animateFloatingDrops(scene,[...flowers,...cards].map(entry=>entry.marker));
    scene.itemCardPreview={cards,flowers,ground};
    scene.events.once('shutdown',()=>delete scene.itemCardPreview);
    return {cards,flowers};
  }
  window.GardenItemCards=Object.freeze({enabled,entries,relics,preload,draw,setIcon,key,broomRotation,itemSpan,minLevel,maxLevel,setLevelLabel,gemIcon,gemInk,relicImage,destroyRelic,weaponImage,effectImage,attackSize});
}());
