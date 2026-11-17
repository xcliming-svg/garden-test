(function(){
  'use strict';
  // Random incoming enemy population. Original SVGs keep their embedded eyes hidden.
  const enabled=window.GardenFairyPatrol.enabled&&new URLSearchParams(window.location.search).get('enemies')!=='0';
  const size=512,root='assets/enemies/',anchorKey='enemy-preview:anchors';
  const enemyStates=Object.freeze(['auto','normal','attack','hit']);
  function expressionFor(state,phase,blink){
    if(state==='hit')return 'dizzy';
    if(state==='attack'||(state==='auto'&&['windup','strike'].includes(phase)))return 'angry';
    return blink;
  }
  const key=(id,expression)=>'enemy-preview:'+id+':'+expression;
  const baseKey=id=>key(id,'base');
  // Longest visible side in logical px: 22px flower cell, 40px garden fairy.
  // Attack type and level select preview motion only, not combat rules.
  const roster=Object.freeze([
    {id:'1_butterfly',span:24,attackType:'fly',level:1,side:'left',row:0,col:0},
    {id:'2_grasshopper',span:24,attackType:'jump',level:1,side:'left',row:0,col:1},
    {id:'6_mouse',span:34,attackType:'approach',level:3,side:'left',row:1,col:0},
    {id:'2_gray_bug',span:26,attackType:'charge',level:1,side:'left',row:1,col:1},
    {id:'1_cat',span:32,attackType:'charge',level:2,side:'left',row:2,col:0},
    {id:'3_caterpillar',span:24,attackType:'approach',level:1,side:'left',row:2,col:1},
    {id:'6_sparrow',span:28,attackType:'fly',level:2,side:'right',row:0,col:0},
    {id:'6_pigeon',span:34,attackType:'fly',level:3,side:'right',row:0,col:1},
    {id:'4_beetle',span:28,attackType:'approach',level:2,side:'right',row:1,col:0},
    {id:'2_frog',span:28,attackType:'jump',level:2,side:'right',row:1,col:1},
    {id:'6_rabbit',span:34,attackType:'jump',level:3,side:'right',row:2,col:0},
    {id:'5_bulldog',span:40,attackType:'charge',level:3,side:'right',row:2,col:1}
  ].map(Object.freeze));
  function preload(scene){
    if(!enabled)return;
    if(!scene.cache.json.exists(anchorKey))scene.load.json(anchorKey,root+'eye_anchors.json');
    for(const e of roster)if(!scene.textures.exists(baseKey(e.id)))
      scene.load.svg(baseKey(e.id),window.GardenSvgPalette.path('enemies/'+e.id+'_1000.svg'),{width:size,height:size});
  }
  function bounds(ctx){
    const data=ctx.getImageData(0,0,size,size).data;
    let l=size,t=size,r=-1,b=-1;
    for(let i=0;i<data.length;i+=4)if(data[i+3]>0){
      const x=i/4%size,y=Math.floor(i/4/size);
      l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);
    }
    if(r<l)throw Error('Empty enemy body');
    return {left:l,top:t,right:r+1,bottom:b+1,width:r-l+1,height:b-t+1};
  }
  function install(scene){
    const m=scene.cache.json.get(anchorKey),fairy=scene.cache.json.get('fairy:manifest');
    if(!m||m.canvas[0]!==1000||m.canvas[1]!==1000||!fairy)throw Error('Invalid enemy eye anchors');
    const sharedAtlas=scene.textures.get('fairy:eyes').getSourceImage(),factor=size/1000;
    const atlas=sharedAtlas;
    // Read back from a dedicated software canvas so normal/closed use identical
    // source rasterization; Phaser texture upload remains unchanged.
    const work=document.createElement('canvas');work.width=work.height=size;
    const ctx=work.getContext('2d',{willReadFrequently:true});
    return roster.map(e=>{
      const art=m.characters[e.id];
      if(!art)throw Error('Missing enemy anchor '+e.id);
      const body=scene.textures.get(baseKey(e.id)).getSourceImage();
      ctx.clearRect(0,0,size,size);ctx.drawImage(body,0,0,size,size);
      const b=bounds(ctx),base=ctx.getImageData(0,0,size,size);
      for(const expression of ['normal','closed','angry','dizzy']){
        const k=key(e.id,expression);
        const tex=scene.textures.exists(k)?scene.textures.get(k):scene.textures.createCanvas(k,size,size);
        // Keep approved vector body and shared eye rasterization unchanged.
        ctx.putImageData(base,0,0);
        const f=fairy.sheets.eyes.frames[expression],w=f.width/2;
        for(const [i,side] of ['left','right'].entries()){
          const a=art.eyes[side],c=fairy.sourceEyeCenters[side];
          // The shared atlas already includes the source eye normalization.
          const sx=f.x+i*w,sy=f.y;
          const dx=(a.x-(c.x-i*w)*a.scale)*factor;
          const dy=(a.y-c.y*a.scale)*factor;
          ctx.drawImage(atlas,sx,sy,w,f.height,dx,dy,w*a.scale*factor,f.height*a.scale*factor);
        }
        tex.getContext().putImageData(ctx.getImageData(0,0,size,size),0,0);
        tex.refresh();tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      return {...e,name:art.name,bounds:b};
    });
  }
  // Eight compass entry points. Keep the original scalar motion profiles:
  // the scalar distance is projected onto a 2-D ground path, never rotate the body.
  const directions=Object.freeze(['right','top-right','top','top-left','left','bottom-left','bottom','bottom-right']);
  function worldPose(spec,path,pose,e){
    const offset=pose.x-path.target,returning=pose.phase==='return';
    const faceRight=path.ux<0?!returning:path.ux>0?returning:false;
    return {...pose,x:path.originX+path.ux*offset,ground:path.originY+path.uy*offset,
      angle:pose.angle*(path.ux<0?-1:1),flip:faceRight};
  }
  function route(spec,boundary,e,occupied,options={}){
    // Stones are decorative. Target an occupied flower, not the wall.
    const side=directions.includes(options.side)?options.side:'right',g=spec.garden;
    const mid=(boundary.garden.top+boundary.garden.bottom)/2;
    const cells=occupied.map(index=>({index,x:g.x+(index%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(index/g.columns)*g.pitch+g.line+g.cell-1}));
    if(!cells.length)throw Error('Enemy preview needs a planted flower');
    const M=window.GardenEnemyMotion,p=M.profiles[e.id],b=boundary.border,m=boundary.frame/2;
    const margin=e.span*.74+12,top=spec.top+e.span*(1+p.squash)+p.lift+p.bob+12,bottom=spec.height-spec.bottom-12;
    const path=flower=>{
      const left=side.includes('left'),right=side.includes('right'),north=side.includes('top'),south=side.includes('bottom');
      const spawnX=left?margin:right?spec.width-margin:flower.x;
      // If a full garden leaves no room above/below the stones, enter through
      // the clipped field edge rather than spawning inside the garden.
      const spawnY=north?(left||right?top:Math.min(top,b.top-m-12)):
        south?(left||right?bottom:Math.max(bottom,b.bottom+m+e.span*(1+p.squash)+p.lift+p.bob+12)):flower.y;
      const dx=spawnX-flower.x,dy=spawnY-flower.y,length=Math.hypot(dx,dy);
      return {start:flower.x+length,stage:flower.x+Math.min(p.reach,length*.55),target:flower.x,ground:flower.y,
        originX:flower.x,originY:flower.y,spawnX,spawnY,ux:dx/length,uy:dy/length,flower:flower.index,side};
    };
    // The right-side deterministic fallback retains the existing nearest flower.
    cells.sort((a,b)=>side.includes('left')?a.x-b.x||Math.abs(a.y-mid)-Math.abs(b.y-mid)||a.index-b.index:
      b.x-a.x||Math.abs(a.y-mid)-Math.abs(b.y-mid)||a.index-b.index);
    function fits(r){
      const box=q=>{
        const a=q.angle*Math.PI/180,hw=e.span*q.sx/2,hh=e.span*q.sy/2;
        const ex=Math.abs(Math.cos(a))*hw+Math.abs(Math.sin(a))*hh,ey=Math.abs(Math.sin(a))*hw+Math.abs(Math.cos(a))*hh;
        const y=q.ground-hh-q.lift;
        return {left:q.x-ex,right:q.x+ex,top:y-ey,bottom:q.ground+Math.abs(Math.sin(a))*hw};
      };
      for(const rank of [0,5])for(const mode of M.modes){
        const hit=mode==='move'?M.travelTime(e,r,rank,mode):p.windup+p.strike+(mode==='auto'?M.travelTime(e,r,rank):0);
        const q=box(worldPose(spec,r,M.sample(e,mode,hit,r,rank),e));
        if(q.left<b.left+m-1e-6||q.right>b.right-m+1e-6||q.top<b.top+m-1e-6||q.bottom>b.bottom-m+1e-6)return false;
      }
      // Vertical/diagonal arrivals must also keep the entire attack visible.
      if(Math.abs(r.uy)>1e-9)for(let i=0;i<=64;i++){
        const q=box(worldPose(spec,r,M.sample(e,'attack',(p.windup+p.strike+.55)*i/64,r,0),e));
        if(q.top<spec.top+1||q.bottom>spec.height-spec.bottom-1)return false;
      }
      return true;
    }
    const paths=cells.map(path);
    if(options.random){const candidate=shuffled(paths,options.random).find(fits);if(candidate)return candidate;}
    return paths.find(fits)||paths[0];
  }
  // Population target is a presentation stress test, not a combat wave rule.
  const spawning=Object.freeze({maxActive:200,rank:0,step:.1,maxBatch:8,
    milestones:Object.freeze([[0,1],[15,6],[30,25],[60,75],[90,140],[120,200]].map(Object.freeze)),
    levelWeights:Object.freeze([6,3,1])});
  function targetCount(seconds){
    const t=Math.max(0,seconds),points=spawning.milestones;
    for(let i=1;i<points.length;i++){
      const [end,count]=points[i], [start,previous]=points[i-1];
      if(t<end)return Math.floor(previous+(count-previous)*(t-start)/(end-start)+1e-9);
    }
    return spawning.maxActive;
  }
  function shuffled(values,random){
    const bag=[...values];
    for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
    return bag;
  }
  function createPopulation(spec,patrol,entries,random=Math.random){
    const M=window.GardenEnemyMotion,F=window.GardenFairyPatrol;
    const actors=[];let bag=[],directionBag=[],serial=0,elapsed=0,spawned=0,completed=0;
    function nextEntry(){
      if(!bag.length){
        // Show all 12 species once; subsequent 40-entry bags preserve every
        // species while favoring small common enemies (60/30/10 by level).
        const pool=spawned===0?entries:entries.flatMap(e=>Array(spawning.levelWeights[e.level-1]).fill(e));
        bag=shuffled(pool,random);
      }
      return bag.pop();
    }
    function spawn(){
      if(!directionBag.length)directionBag=shuffled(directions,random);
      const entry=nextEntry(),side=directionBag.pop();
      const path=route(spec,patrol.boundary,entry,patrol.occupied,{side,random});
      const actor={id:serial++,entry,path,age:0,blink:F.blinkSchedule(serial+11),expressionState:'auto',expression:'normal',pose:null};
      actor.duration=M.duration(entry,'auto',path,spawning.rank);actors.push(actor);spawned++;
      updateActor(actor);return actor;
    }
    function updateActor(a){
      a.pose=worldPose(spec,a.path,M.sample(a.entry,'auto',a.age,a.path,spawning.rank),a.entry);
      a.expression=expressionFor(a.expressionState,a.pose.phase,a.blink(a.age));
    }
    function advance(seconds){
      if(patrol.finished)return elapsed;
      // Substeps retain smooth entry/exit and avoid a backlog burst after a
      // delayed frame. The target is a concurrent count, not cumulative spawns.
      let left=Math.max(0,Number.isFinite(seconds)?seconds:0);
      do {
        const dt=Math.min(spawning.step,left);left-=dt;elapsed+=dt;
        for(let i=actors.length-1;i>=0;i--){
          const a=actors[i];a.age+=dt;
          if(a.age>=a.duration){actors.splice(i,1);completed++;}else updateActor(a);
        }
        const wanted=targetCount(elapsed);
        for(let n=0;n<spawning.maxBatch&&actors.length<wanted;n++)spawn();
      } while(left>1e-9);
      return elapsed;
    }
    function setExpression(id,state){
      if(!enemyStates.includes(state))return false;
      const a=actors.find(x=>x.id===id);if(!a)return false;
      a.expressionState=state;updateActor(a);return true;
    }
    return {actors,advance,setExpression,get elapsed(){return elapsed;},get spawned(){return spawned;},get completed(){return completed;}};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const entries=install(scene).map(e=>{
      const scale=e.span/Math.max(e.bounds.width,e.bounds.height);
      return {...e,scale,width:e.bounds.width*scale,height:e.bounds.height*scale};
    });
    const model=createPopulation(spec,patrol,entries),sprites=new Map();
    const occlusion=window.GardenEnemyOcclusion.attach(scene,spec,patrol);
    // The playable field clips partial entry/exit sprites; HUD is never covered.
    const clip=scene.make.graphics({x:0,y:0,add:false});
    clip.fillStyle(0xffffff,1).fillRect(0,spec.top,spec.width,spec.height-spec.top-spec.bottom);
    const fieldMask=clip.createGeometryMask();
    function render(){
      const alive=new Set(model.actors.map(a=>a.id));
      for(const [id,sprite] of sprites)if(!alive.has(id)){sprite.image.destroy();sprite.shadow.destroy();sprites.delete(id);}
      for(const actor of model.actors){
        const a=actor.entry,r=a.bounds,p=actor.pose;
        let sprite=sprites.get(actor.id);
        if(!sprite){
          const image=scene.add.image(0,0,key(a.id,actor.expression)).setDepth(3).setMask(fieldMask).setName('enemy:actor:'+actor.id);
          const shadow=scene.add.ellipse(0,0,1,1,window.GardenPalette.roles.n.ink,.35).setDepth(.75).setMask(fieldMask).setName('enemy:shadow:'+actor.id);
          sprite={image,shadow};sprites.set(actor.id,sprite);
        }
        const {image,shadow}=sprite,{x,ground,lift,angle,sx,sy,flip}=p;
        image.setPosition(x,ground-a.height*sy/2-lift)
          .setOrigin((r.left+r.right)/2/size,(r.top+r.bottom)/2/size)
          .setScale(a.scale*sx*(flip?-1:1),a.scale*sy).setAngle(angle).setDepth(3+ground/spec.height);
        const texture=key(a.id,actor.expression);if(image.texture.key!==texture)image.setTexture(texture);
        shadow.setPosition(x,ground+1).setDisplaySize(a.width*.72*(1-lift*.009),Math.max(2,a.height*.10)).setAlpha(.36/(1+lift*.055));
      }
    }
    function advance(seconds){model.advance(seconds);render();occlusion.update(Array.from(sprites.values(),s=>s.image),Math.max(0,Number.isFinite(seconds)?seconds:0));return model.elapsed;}
    function setExpression(id,state){const ok=model.setExpression(id,state);if(ok)render();return ok;}
    const update=(_time,delta)=>advance(Math.min(.1,Math.max(0,delta/1000)));
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);for(const {image,shadow} of sprites.values()){image.clearMask();shadow.clearMask();}sprites.clear();fieldMask.destroy();clip.destroy();delete scene.enemyPreview;});
    scene.enemyPreview={entries,model,sprites,occlusion,advance,setExpression,get actors(){return model.actors;},get targetCount(){return targetCount(model.elapsed);},get elapsed(){return model.elapsed;}};
    advance(0);return scene.enemyPreview;
  }
  window.GardenEnemyPreview=Object.freeze({enabled,roster,preload,attach,key,route,enemyStates,expressionFor,spawning,targetCount,directions,worldPose,createPopulation});
}());
