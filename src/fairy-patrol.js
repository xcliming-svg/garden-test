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
  const count=11,speed=window.GardenSimulationConfig?.fairy?.speed??40,maxSpeed=window.GardenSimulationConfig?.fairy?.maxSpeed??80;
  const playable=!!window.GardenRunRules?.active;
  const survival=!!window.GardenRunRules?.survival;
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
  // Explicit color comparisons stay static unless adaptive is requested.
  const adaptive=params.get('outlineMode')==='adaptive'||(params.get('outlineMode')!=='static'&&rawColor===null);
  const densityTuning=Object.freeze({radius:32,enter:40,exit:22,enterHold:2.5,exitHold:1.5,fadeIn:4,fadeOut:3});
  function createDensity(){
    let dense=false,held=0,mix=0,from=0,elapsed=0,transitions=0,near=0;
    function advance(dt){
      const duration=dense?densityTuning.fadeIn:densityTuning.fadeOut;
      elapsed=Math.min(duration,elapsed+dt);
      const t=elapsed/duration,ease=t*t*(3-2*t);
      mix=from+((dense?1:0)-from)*ease;
      if(elapsed>=duration-1e-9)mix=dense?1:0;
    }
    function update(count,seconds){
      near=count;
      let dt=Math.max(0,Number.isFinite(seconds)?seconds:0);
      // Evaluate both thresholds even during a dissolve. Reversal starts
      // from the current rendered color, never from an endpoint.
      const condition=dense?near<=densityTuning.exit:near>=densityTuning.enter;
      if(condition){
        const hold=dense?densityTuning.exitHold:densityTuning.enterHold;
        const used=Math.min(dt,Math.max(0,hold-held));
        advance(used);held+=used;dt-=used;
        if(held>=hold-1e-9){
          dense=!dense;held=0;transitions++;from=mix;elapsed=0;
        }
      }else held=0;
      advance(dt);
      return snapshot();
    }
    function snapshot(){return {dense,near,progress:mix,mix,transitions};}
    return {update,snapshot};
  }
  function mixColor(t){
    const from=parseInt(palette.stone.slice(1),16),to=parseInt(palette.paper.slice(1),16);
    let result=0;for(const shift of [16,8,0])result|=Math.round(((from>>shift)&255)*(1-t)+((to>>shift)&255)*t)<<shift;
    return result;
  }
  // Shared cached silhouette ring. The body/occlusion/attack textures stay intact.
  function ringKey(scene,sourceKey,prefix,scale,pad=0,mask=false){
    const radius=outlineWidth/scale,k=prefix+':'+(mask?'mask':outlineColor)+':'+radius.toFixed(3)+':'+pad;
    if(scene.textures.exists(k))return k;
    const source=scene.textures.get(sourceKey).getSourceImage(),w=source.width,h=source.height;
    const texture=scene.textures.createCanvas(k,w+2*pad,h+2*pad),ctx=texture.getContext();
    for(let i=0;i<24;i++){
      const angle=i*Math.PI/12;
      ctx.drawImage(source,pad+Math.cos(angle)*radius,pad+Math.sin(angle)*radius,w,h);
    }
    ctx.globalCompositeOperation='source-in';
    ctx.fillStyle=mask?'#FFFFFF':outlineConfig.hex;ctx.fillRect(0,0,texture.width,texture.height);
    ctx.globalCompositeOperation='destination-out';ctx.drawImage(source,pad,pad,w,h);
    ctx.globalCompositeOperation='source-over';
    texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return k;
  }
  function outlineKey(scene,type,scale){
    return ringKey(scene,baseKey(type),'fairy-outline:'+type,1000*scale/size,0,adaptive);
  }
  function syncOutline(actor,pad=0){
    const {image,outline}=actor;
    if(!outline)return;
    outline.setPosition(image.x,image.y).setOrigin(
      pad?(image.displayOriginX+pad)/outline.width:image.originX,
      pad?(image.displayOriginY+pad)/outline.height:image.originY)
      .setScale(image.scaleX,image.scaleY).setRotation(image.rotation).setFlip(image.flipX,image.flipY)
      .setDepth(image.depth-(playable?.001:0)).setAlpha(image.alpha).setVisible(image.visible);
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
    const depthBase=playable?window.GardenRunRules.depth.fairy:window.GardenEnemyOcclusion.config.fairyFront&&window.GardenEnemyPreview.enabled?4:2;
    let activeCount=playable?1:count;
    const compute=()=>B.layout(spec,geometry(occupied,0,0).garden,heroHeight,gait,activeCount);
    let info=compute(),b=info.patrol,length=info.length,spacing=length/activeCount;
    let scale=info.height/m.characters.garden.visibleHeight;
    let signature=[...occupied].sort((a,b)=>a-b).join(',');
    border.render(info);
    const allActors=Array.from({length:count},(_,index)=>{
      const type=index===0?'garden':'water';
      const visibleHeight=m.characters[type].visibleHeight*scale;
      const outline=outlineConfig.enabled?scene.add.image(0,0,outlineKey(scene,type,scale)).setName('fairy-outline:'+index):null;
      const image=scene.add.image(0,0,key(type,'normal'))
        .setOrigin(m.anchor.x/m.canvas.width,m.anchor.y/m.canvas.height)
        .setDisplaySize(m.canvas.width*scale,m.canvas.height*scale)
        .setDepth(2).setName('fairy:'+type+':'+index);
      const partner=survival&&index>0?scene.add.image(0,0,key('water','normal'))
        .setOrigin(m.anchor.x/m.canvas.width,m.anchor.y/m.canvas.height)
        .setDisplaySize(m.canvas.width*scale,m.canvas.height*scale)
        .setDepth(2).setName('fairy:water:partner:'+index).setVisible(false):null;
      const tears=[];
      for(const [i,side] of ['left','right'].entries())for(let j=0;j<2;j++){
        const c=m.sourceEyeCenters[side],d=m.characters[type].destinationRects[side];
        const sprite=scene.add.image(0,0,tearsAtlas+':'+side).setOrigin((c.x-i*128)/128,(c.y+65)/256).setVisible(false).setName('fairy:tear:'+index+':'+side+':'+j);
        tears.push({sprite,side,offset:j*.5,rect:d});
      }
      return {index,type,image,partner,outline,tears,visibleHeight,blink:blinkSchedule(index),expression:'normal',direction:'right',center:{x:0,y:0},phase:index*1.83};
    });
    let actors=allActors.slice(0,activeCount),pairItems=Array(10).fill(null),pairDistances=new Map();
    for(const a of allActors.slice(activeCount)){a.image.setVisible(false);a.outline?.setVisible(false);}
    const density=createDensity();
    function updateDensity(near,dt){
      const value=density.update(near,dt);
      if(adaptive&&outlineConfig.enabled){
        const tint=mixColor(value.mix);
        for(const a of actors)if(a.outline&&a.outline.tintTopLeft!==tint)a.outline.setTint(tint);
      }
      return value;
    }
    updateDensity(0,0);
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
      if(!occupied.size||next===signature)return;
      signature=next;
      const progress=((distance%length)+length)%length/length;
      info=compute();b=info.patrol;length=info.length;spacing=length/activeCount;
      distance=progress*length;
      scale=info.height/m.characters.garden.visibleHeight;
      for(const a of actors){a.visibleHeight=m.characters[a.type].visibleHeight*scale;a.image.setDisplaySize(m.canvas.width*scale,m.canvas.height*scale);a.partner?.setDisplaySize(m.canvas.width*scale,m.canvas.height*scale);if(a.outline)a.outline.setTexture(outlineKey(scene,a.type,scale));}
      border.render(info);
    }
    function setCount(n){
      n=Math.max(1,Math.min(count,n));if(n===activeCount)return;
      activeCount=n;actors=allActors.slice(0,n);
      for(const a of allActors){const show=a.index<n;a.image.setVisible(show);a.outline?.setVisible(show);if(!show)for(const t of a.tears)t.sprite.setVisible(false);}
      signature='';render();updateDensity(density.snapshot().near,0);
    }
    function setPairs(items){
      if(!survival)return false;
      pairItems=Array.from({length:10},(_,i)=>[items[i*2]?.id||null,items[i*2+1]?.id||null]);
      actors=[allActors[0],...allActors.slice(1).filter(a=>pairItems[a.index-1].some(Boolean))];
      activeCount=actors.length;spacing=length/activeCount;
      for(const a of allActors){
        const visible=a.index===0||pairItems[a.index-1].some(Boolean);
        a.image.setVisible(visible);a.outline?.setVisible(visible);
        a.partner?.setVisible(visible&&pairItems[a.index-1].every(Boolean));
        if(!visible)for(const tear of a.tears)tear.sprite.setVisible(false);
        if(visible&&a.index>0&&!pairDistances.has(a.index))pairDistances.set(a.index,(distance+a.index*length/11)%length);
      }
      render();return true;
    }
    function setSpeed(value){if(survival)return;currentSpeed=Math.max(speed,Math.min(maxSpeed,value));}
    function refreshHud(){updateHud(scene.run?.state.elapsed??elapsed,scene.enemyPreview?.model.kills||0,scene.run?.state.displayGems??scene.relicCollection?.state.gems??0,occupied.size);}
    function render(){
      refreshBoundary();
      for(const a of actors){
        const d=survival&&a.index>0?(pairDistances.get(a.index)||0):distance+a.index*spacing;
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
        const together=survival&&!!a.partner&&a.partner.visible;
        const separation=together?7:0;
        a.image.setPosition(p.x-separation,p.y+a.visibleHeight/2-lift)
          .setAngle(tilt+facing*gait.lean)
          .setDepth(depthBase+Math.max(0,Math.min(.98,p.y/spec.height)));
        if(a.partner){
          a.partner.setPosition(p.x+separation,p.y+a.visibleHeight/2-lift)
            .setFlipX(facing<0).setAngle(-tilt+facing*gait.lean)
            .setDepth(a.image.depth+.005);
        }
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
        if(expression!==a.expression){a.expression=expression;a.image.setTexture(key(a.type,expression));a.partner?.setTexture(key('water',expression));}
        syncOutline(a);
      }
      refreshHud();
    }
    function advance(seconds){
      const dt=Math.max(0,seconds);emotionTime+=dt;
      if(!isResult(state)){
        elapsed+=dt;distance=(distance+dt*currentSpeed)%length;
        if(survival)for(const a of actors)if(a.index>0){
          const shoes=pairItems[a.index-1].filter(id=>id==='shoe').length;
          const pace=speed*(shoes===2?1.8:shoes===1?1.35:1);
          pairDistances.set(a.index,((pairDistances.get(a.index)||0)+dt*pace)%length);
        }
      }
      render();return elapsed;
    }
    const controller={get actors(){return actors;},border,advance,refreshHud,setCount,setPairs,setSpeed,setSpeedRank,setState,updateDensity,density,get state(){return state;},get finished(){return isResult(state);},get emotionTime(){return emotionTime;},get speed(){return currentSpeed;},get speedRank(){return rank;},get distance(){return distance;},get bounds(){return b;},get length(){return length;},get spacing(){return spacing;},get boundary(){return info;},get occupied(){return [...occupied];},get elapsed(){return elapsed;}};
    scene.fairyPatrol=controller;
    const update=(_time,delta)=>advance(Math.min(.1,Math.max(0,delta/1000)));
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);delete scene.fairyPatrol;});
    render();return controller;
  }
  window.GardenFairyPatrol=Object.freeze({enabled,preload,install,attach,key,count,speed,maxSpeed,gait,ranks,validRank,speedAt,blinkSchedule,fairyStates,isResult,emotionPose,outlineConfig,adaptive,densityTuning,createDensity,mixColor,ringKey,syncOutline});
}());
