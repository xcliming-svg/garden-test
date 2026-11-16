(function(){
  'use strict';
  // Adapt the supplied Fairy Game Assets manifest to the Phaser scene.
  // The original vector files are never edited. Only two eye frames are
  // composited at runtime; all motion is a transform on the complete sprite.
  const enabled=new URLSearchParams(window.location.search).get('combat')!=='1';
  const root='assets/fairies/',size=512,atlas='fairy:eyes',manifestKey='fairy:manifest';
  const types=['garden','water'],expressions=['normal','closed'];
  const count=11,speed=24;
  const gait=Object.freeze({frequency:1.6,lift:.5,tilt:1.25,lean:.5});
  const key=(type,expression)=>'fairy:'+type+':'+expression;
  const baseKey=type=>'fairy:base:'+type;
  function preload(scene){
    if(!enabled)return;
    if(!scene.cache.json.exists(manifestKey))scene.load.json(manifestKey,root+'manifest.json');
    for(const type of types)if(!scene.textures.exists(baseKey(type)))
      scene.load.svg(baseKey(type),root+type+'.svg',{width:size,height:size});
    if(!scene.textures.exists(atlas))scene.load.svg(atlas,root+'eyes.svg',{width:1792,height:256});
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
    const m=install(scene),scale=heroHeight/m.characters.garden.visibleHeight;
    const width=430*scale,height=heroHeight;
    // Allow for foot-pivot rotation and the small step lift. Route uses the
    // largest character envelope. Expand horizontally if 11 would crowd.
    const shape=geometry(occupied,width+10,height+4);
    const b={...shape.patrol};
    const required=count*(heroHeight*1.2+4);
    const perimeter=()=>2*(b.right-b.left+b.bottom-b.top);
    const extra=Math.max(0,(required-perimeter())/4);
    b.left-=extra;b.right+=extra;
    const length=perimeter(),spacing=length/count;
    const actors=Array.from({length:count},(_,index)=>{
      const type=index===0?'garden':'water';
      const visibleHeight=m.characters[type].visibleHeight*scale;
      const image=scene.add.image(0,0,key(type,'normal'))
        .setOrigin(m.anchor.x/m.canvas.width,m.anchor.y/m.canvas.height)
        .setDisplaySize(m.canvas.width*scale,m.canvas.height*scale)
        .setDepth(2).setName('fairy:'+type+':'+index);
      return {index,type,image,visibleHeight,blink:blinkSchedule(index),expression:'normal',direction:'right',center:{x:0,y:0},phase:index*1.83};
    });
    let elapsed=0;
    const start=(b.right-b.left)/2;
    function render(){
      for(const a of actors){
        const distance=start+elapsed*speed+a.index*spacing;
        const p=patrolPosition(b,distance),q=patrolPosition(b,distance+.01);
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
          .setDepth(2+p.y/spec.height);
        const expression=a.blink(elapsed);
        if(expression!==a.expression){a.expression=expression;a.image.setTexture(key(a.type,expression));}
      }
      updateHud(elapsed,0,0,occupied.size);
    }
    function advance(seconds){elapsed+=Math.max(0,seconds);render();return elapsed;}
    const controller={actors,bounds:b,length,spacing,speed,advance,get elapsed(){return elapsed;}};
    scene.fairyPatrol=controller;
    const update=(_time,delta)=>advance(Math.min(.1,Math.max(0,delta/1000)));
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);delete scene.fairyPatrol;});
    render();return controller;
  }
  window.GardenFairyPatrol=Object.freeze({enabled,preload,install,attach,key,count,speed});
}());
