(function(){
  'use strict';
  // Adapt the supplied Fairy Game Assets manifest to the Phaser scene.
  // Original vector art is preserved; expressions are composited at runtime.
  const enabled=new URLSearchParams(window.location.search).get('combat')!=='1';
  const root='assets/fairies/',size=512,atlas='fairy:eyes',manifestKey='fairy:manifest';
  const types=['garden','water'],expressions=['normal','closed','dizzy','happy'],tearsAtlas='fairy:tears';
  const fairyStates=Object.freeze(['normal','hit','win','lose']);
  const isResult=state=>state==='win'||state==='lose';
  function emotionPose(state,time,visibleHeight,phase=0){
    const scale=visibleHeight/40;
    if(state==='win')return {expression:'happy',dx:0,lift:Math.abs(Math.sin(time*2*Math.PI*2.2+phase))*2.5*scale};
    if(state==='lose')return {expression:'closed',dx:Math.sin(time*2*Math.PI*2+phase)*.9*scale,lift:0};
    return {expression:state==='hit'?'dizzy':null,dx:0,lift:0};
  }
  const count=11,speed=40,maxSpeed=80;
  const ranks=Object.freeze([0,5]);
  const validRank=rank=>ranks.includes(rank);
  const speedAt=(base,rank,max=base*1.5)=>rank===5?max:base;
  const gait=Object.freeze({frequency:1.6,lift:.5,tilt:1.25,lean:.5});
  const key=(type,expression)=>'fairy:'+type+':'+expression;
  const baseKey=type=>'fairy:base:'+type;
  const params=new URLSearchParams(window.location.search),palette=window.GardenPalette.hex;
  const rawColor=params.get('outlineColor'),rawWidth=params.get('outlineWidth');
  const outlineColor=Object.prototype.hasOwnProperty.call(palette,rawColor)?rawColor:'stone';
  const requestedWidth=rawWidth===null?1:Number(rawWidth);
  const outlineWidth=Number.isFinite(requestedWidth)&&requestedWidth>=.5&&requestedWidth<=1.5?requestedWidth:1;
  const outlineConfig=Object.freeze({enabled:params.get('outline')!=='0',color:outlineColor,width:outlineWidth,hex:palette[outlineColor]});
  // A separate silhouette ring keeps body textures and collision masks intact.
  function outlineKey(scene,type,scale){
    const radius=outlineWidth*size/(1000*scale),k='fairy-outline:'+type+':'+outlineColor+':'+radius.toFixed(3);
    if(scene.textures.exists(k))return k;
    const source=scene.textures.get(baseKey(type)).getSourceImage();
    const texture=scene.textures.createCanvas(k,size,size),ctx=texture.getContext();
    for(let i=0;i<24;i++){
      const angle=i*Math.PI/12;
      ctx.drawImage(source,Math.cos(angle)*radius,Math.sin(angle)*radius,size,size);
    }
    ctx.globalCompositeOperation='source-in';
    ctx.fillStyle=outlineConfig.hex;ctx.fillRect(0,0,size,size);
    ctx.globalCompositeOperation='destination-out';ctx.drawImage(source,0,0,size,size);
    ctx.globalCompositeOperation='source-over';
    texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return k;
  }
  function syncOutline(actor){
    const {image,outline}=actor;
    if(!outline)return;
    outline.setPosition(image.x,image.y).setOrigin(image.originX,image.originY)
      .setScale(image.scaleX,image.scaleY).setRotation(image.rotation).setFlip(image.flipX,image.flipY)
      .setDepth(image.depth).setAlpha(image.alpha).setVisible(image.visible);
  }
  function preload(scene){
    if(!enabled)return;
    window.GardenPebbleBoundary.preload(scene);
    if(!scene.cache.json.exists(manifestKey))scene.load.json(manifestKey,root+'manifest.json');
    for(const type of types)if(!scene.textures.exists(baseKey(type)))
      scene.load.svg(baseKey(type),window.GardenSvgPalette.path('fairies/'+type+'.svg'),{width:size,height:size});
    if(!scene.textures.exists(atlas))scene.load.svg(atlas,window.GardenSvgPalette.path('fairies/eyes.svg'),{width:1792,height:256});
    if(!scene.textures.exists(tearsAtlas))scene.load.svg(tearsAtlas,window.GardenSvgPalette.path('fairies/tears.svg'),{width:256,height:256});
  }
  function install(scene){
    const m=scene.cache.json.get(manifestKey),eyeImage=scene.textures.get(atlas).getSourceImage();
    if(!m||m.canvas.width!==1000||m.canvas.height!==1000)throw Error('Invalid fairy manifest');
    for(const type of types)for(const expression of expressions){
      const k=key(type,expression);
      if(scene.textures.exists(k))continue;
      const t=scene.textures.createCanvas(k,size,size),ctx=t.getContext(),factor=size/m.canvas.width;
      ctx.drawImage(scene.textures.get(baseKey(type)).getSourceImage(),0,0,size,size);
      const f=m.sheets.eyes.frames[expression];
      for(const [i,side] of ['left','right'].entries()){
        const d=m.characters[type].destinationRects[side];
        ctx.drawImage(eyeImage,f.x+i*f.width/2,f.y,f.width/2,f.height,d.x*factor,d.y*factor,d.width*factor,d.height*factor);
      }
      t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    const sheet=scene.textures.get(tearsAtlas).getSourceImage();
    for(const [i,side] of ['left','right'].entries()){
      const k=tearsAtlas+':'+side;if(scene.textures.exists(k))continue;
      const t=scene.textures.createCanvas(k,128,256);t.getContext().drawImage(sheet,i*128,0,128,256,0,0,128,256);t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    return m;
  }
  // Seeded independent blink schedules; initial state is always normal.
  function blinkSchedule(index){
    let seed=(0x31feac+Math.imul(index+1,0x9e3779b9))>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const duration=.12+random()*.06;
    let next=.9+index*.31+random()*.75;
    return t=>{
      while(t>=next+duration)next+=duration+2.4+random()*2.5;
      return t>=next?'closed':'normal';
    };
  }
  function attach(scene,spec,occupied,geometry,patrolPosition,updateHud,heroHeight){
    const m=install(scene),B=window.GardenPebbleBoundary,border=B.attach(scene);
    const depthBase=window.GardenEnemyOcclusion.config.fairyFront&&window.GardenEnemyPreview.enabled?4:2;
    const compute=()=>B.layout(spec,geometry(occupied,0,0).garden,heroHeight,gait,count);
    let info=compute(),b=info.patrol,length=info.length,spacing=length/count;
    let scale=info.height/m.characters.garden.visibleHeight;
    let signature=[...occupied].sort((a,b)=>a-b).join(',');
    border.render(info);
    const actors=Array.from({length:count},(_,index)=>{
      const type=index===0?'garden':'water';
      const visibleHeight=m.characters[type].visibleHeight*scale;
      const outline=outlineConfig.enabled?scene.add.image(0,0,outlineKey(scene,type,scale)).setName('fairy-outline:'+index):null;
      const image=scene.add.image(0,0,key(type,'normal'))
        .setOrigin(m.anchor.x/m.canvas.width,m.anchor.y/m.canvas.height)
        .setDisplaySize(m.canvas.width*scale,m.canvas.height*scale)
        .setDepth(2).setName('fairy:'+type+':'+index);
      const tears=[];
      for(const [i,side] of ['left','right'].entries())for(let j=0;j<2;j++){
        const c=m.sourceEyeCenters[side],d=m.characters[type].destinationRects[side];
        const sprite=scene.add.image(0,0,tearsAtlas+':'+side).setOrigin((c.x-i*128)/128,(c.y+65)/256).setVisible(false).setName('fairy:tear:'+index+':'+side+':'+j);
        tears.push({sprite,side,offset:j*.5,rect:d});
      }
      return {index,type,image,outline,tears,visibleHeight,blink:blinkSchedule(index),expression:'normal',direction:'right',center:{x:0,y:0},phase:index*1.83};
    });
    let elapsed=0,rank=0,currentSpeed=speed,state='normal',emotionTime=0;
    let distance=(b.right-b.left)/2;
    // Retained for future upgrades and combat/result events; no preview UI.
    function setState(next){
      if(!fairyStates.includes(next))return false;
      if(next!==state){state=next;emotionTime=0;}render();return true;
    }
    function setSpeedRank(next){
      if(!validRank(next))return false;
      rank=next;currentSpeed=speedAt(speed,rank,maxSpeed);return true;
    }
    function refreshBoundary(){
      const next=[...occupied].sort((a,b)=>a-b).join(',');
      if(next===signature)return;
      signature=next;
      const progress=((distance%length)+length)%length/length;
      info=compute();b=info.patrol;length=info.length;spacing=length/count;
      distance=progress*length;
      scale=info.height/m.characters.garden.visibleHeight;
      for(const a of actors){a.visibleHeight=m.characters[a.type].visibleHeight*scale;a.image.setDisplaySize(m.canvas.width*scale,m.canvas.height*scale);if(a.outline)a.outline.setTexture(outlineKey(scene,a.type,scale));}
      border.render(info);
    }
    function refreshHud(){updateHud(elapsed,scene.enemyPreview?.model.kills||0,0,occupied.size);}
    function render(){
      refreshBoundary();
      for(const a of actors){
        const d=distance+a.index*spacing;
        const p=patrolPosition(b,d),q=patrolPosition(b,d+.01);
        const dx=q.x-p.x,dy=q.y-p.y;
        a.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
        a.center=p;
        const phase=elapsed*gait.frequency*Math.PI*2+a.phase;
        const lift=Math.abs(Math.sin(phase))*gait.lift*(a.visibleHeight/40);
        const tilt=Math.sin(phase)*gait.tilt;
        const facing=a.direction==='left'?-1:a.direction==='right'?1:0;
        // The base art is front-facing only. Mirror horizontally on left/right;
        // up/down retain a front view, with gait and directional lean.
        if(facing)a.image.setFlipX(facing<0);
        a.image.setPosition(p.x,p.y+a.visibleHeight/2-lift)
          .setAngle(tilt+facing*gait.lean)
          .setDepth(depthBase+p.y/spec.height);
        const emotion=emotionPose(state,emotionTime,a.visibleHeight,a.phase);
        if(isResult(state))a.image.setPosition(p.x+emotion.dx,p.y+a.visibleHeight/2-emotion.lift).setAngle(0);
        for(const tear of a.tears){
          const show=state==='lose';tear.sprite.setVisible(show);if(!show)continue;
          const eye=m.characters[a.type].eyeCenters[tear.side],t=((emotionTime*1.45+tear.offset+a.index*.17)%1),h=a.visibleHeight/40,flip=a.image.flipX?-1:1;
          const x=a.image.x+(eye.x-m.anchor.x)*scale*flip,y=a.image.y+(eye.y-m.anchor.y)*scale+(2.8+t*8)*h;
          tear.baseAlpha=Math.min(1,(1-t)*4);
          tear.sprite.setPosition(x,y).setDisplaySize(tear.rect.width*scale,tear.rect.height*scale).setAlpha(tear.baseAlpha).setDepth(a.image.depth+.01);
        }
        const expression=emotion.expression||a.blink(elapsed);
        if(expression!==a.expression){a.expression=expression;a.image.setTexture(key(a.type,expression));}
        syncOutline(a);
      }
      refreshHud();
    }
    function advance(seconds){const dt=Math.max(0,seconds);emotionTime+=dt;if(!isResult(state)){elapsed+=dt;distance=(distance+dt*currentSpeed)%length;}render();return elapsed;}
    const controller={actors,border,advance,refreshHud,setSpeedRank,setState,get state(){return state;},get finished(){return isResult(state);},get emotionTime(){return emotionTime;},get speed(){return currentSpeed;},get speedRank(){return rank;},get distance(){return distance;},get bounds(){return b;},get length(){return length;},get spacing(){return spacing;},get boundary(){return info;},get occupied(){return [...occupied];},get elapsed(){return elapsed;}};
    scene.fairyPatrol=controller;
    const update=(_time,delta)=>advance(Math.min(.1,Math.max(0,delta/1000)));
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);delete scene.fairyPatrol;});
    render();return controller;
  }
  window.GardenFairyPatrol=Object.freeze({enabled,preload,install,attach,key,count,speed,maxSpeed,ranks,validRank,speedAt,blinkSchedule,fairyStates,isResult,emotionPose,outlineConfig});
}());
