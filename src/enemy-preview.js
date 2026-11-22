(function(){
  'use strict';
  // Random incoming enemy population. Original SVGs keep their embedded eyes hidden.
  const params=new URLSearchParams(window.location.search);
  // Card inspection is the default; retain explicit swarm/attack comparisons.
  const playable=!!window.GardenRunRules?.active;
  const enabled=playable||window.GardenFairyPatrol.enabled&&params.get('enemies')!=='0'&&
    (params.get('enemies')==='1'||params.get('attack')!==null||params.get('densitySim')==='1');
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
  // Level also supplies temporary projectile hit points in the attack preview.
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
    const cells=occupied.map(index=>({index,x:g.x+(index%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(index/g.columns)*(g.pitchY||g.pitch)+g.line+g.cell-1}));
    if(!cells.length)throw Error('Enemy preview needs a planted flower');
    const M=window.GardenEnemyMotion,p=M.profiles[e.id],b=boundary.border,m=boundary.frame/2;
    const margin=e.span*.74+12,top=spec.top+e.span*(1+p.squash)+p.lift+p.bob+12,bottom=spec.height-spec.bottom-12;
    const path=flower=>{
      const left=side.includes('left'),right=side.includes('right'),north=side.includes('top'),south=side.includes('bottom');
      const spawnX=options.spawnPoint?.x??(left?margin:right?spec.width-margin:flower.x);
      // If a full garden leaves no room above/below the stones, enter through
      // the clipped field edge rather than spawning inside the garden.
      const spawnY=options.spawnPoint?.y??(north?(left||right?top:Math.min(top,b.top-m-12)):
        south?(left||right?bottom:Math.max(bottom,b.bottom+m+e.span*(1+p.squash)+p.lift+p.bob+12)):flower.y);
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
        const q=box(worldPose(spec,r,M.sample(e,'attack',(p.windup+p.strike+p.recovery)*i/64,r,0),e));
        if(q.top<spec.top+1||q.bottom>spec.height-spec.bottom-1)return false;
      }
      return true;
    }
    if(options.spawnPoint)cells.sort((a,b)=>Math.hypot(a.x-options.spawnPoint.x,a.y-options.spawnPoint.y)-Math.hypot(b.x-options.spawnPoint.x,b.y-options.spawnPoint.y)||a.index-b.index);
    const paths=cells.map(path);
    if(options.random){const candidate=shuffled(paths,options.random).find(fits);if(candidate)return candidate;}
    return paths.find(fits)||paths[0];
  }
  // Position formations around the field, not inside the planted garden.
  // Elliptic ring follows the wide playfield; pack/line use spaced edge points.
  function formationPoints(spec,entry,kind,count,random){
    const p=window.GardenEnemyMotion.profiles[entry.id],margin=entry.span*.74+12;
    const left=margin,right=spec.width-margin,top=spec.top+entry.span*(1+p.squash)+p.lift+p.bob+12,bottom=spec.height-spec.bottom-12;
    const cx=(left+right)/2,cy=(top+bottom)/2,rx=(right-left)/2,ry=(bottom-top)/2;
    const rotation=random()*Math.PI*2,side=Math.floor(random()*4);
    const compass=(x,y)=>directions[(Math.round(Math.atan2(cy-y,x-cx)/(Math.PI/4))+8)%8];
    function edge(s,u){return s===0?{x:right,y:top+u*(bottom-top)}:s===1?{x:left+u*(right-left),y:top}:s===2?{x:left,y:top+u*(bottom-top)}:{x:left+u*(right-left),y:bottom};}
    return Array.from({length:count},(_,i)=>{
      let pt;
      if(kind==='ring'){
        const angle=rotation+2*Math.PI*i/count;
        // A true elliptical perimeter, adapted to the rectangular battlefield.
        pt={x:cx+rx*Math.cos(angle),y:cy+ry*Math.sin(angle)};
      }else if(kind==='pack'){
        // Compact 2-D flock; keep it on the wide left/right approaches.
        const s=side%2===0?0:2,rows=Math.ceil(Math.sqrt(count)),cols=Math.ceil(count/rows);
        const gap=entry.span*.72,along=Math.min(gap,(bottom-top)/Math.max(1,rows+1));
        const depth=Math.min(gap,Math.max(0,(spec.garden.x-margin-entry.span)/Math.max(1,cols)));
        const row=i%rows,col=Math.floor(i/rows),centerY=cy+(rotation/Math.PI-1)*(bottom-top)*.16;
        pt={x:s===0?right-col*depth:left+col*depth,y:Math.max(top,Math.min(bottom,centerY+(row-(rows-1)/2)*along))};
      }else{
        const split=kind==='pincer',n=split?Math.ceil(count/2):count,j=split?Math.floor(i/2):i;
        const s=split?(side+2*(i%2))%4:side;
        const u=n===1?.5:.12+.76*j/(n-1);
        pt=edge(s,u);
      }
      return {...pt,side:compass(pt.x,pt.y)};
    });
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
  // Optional one-shot density comparison: new arrivals taper off, survivors
  // leave or are killed normally. Default population curve is unchanged.
  const simulation=new URLSearchParams(window.location.search).get('densitySim')==='1';
  function simulationTarget(t){
    const points=[[0,1],[8,4],[32,200],[55,200],[75,0],[95,0]];
    for(let i=1;i<points.length;i++){const [end,n]=points[i],[start,m]=points[i-1];if(t<end)return Math.floor(m+(n-m)*Math.max(0,t-start)/(end-start));}
    return 0;
  }
  // Shared by live movement and the v1 predictive targeting model.
  function runMotion(entry,path,age){
    const M=window.GardenEnemyMotion,approach=M.travelTime(entry,path,spawning.rank);
    return worldPose(null,path,age<approach?M.sample(entry,'auto',age,path,spawning.rank):M.sample(entry,'attack',age-approach,path,spawning.rank),entry);
  }
  function runAttackIn(entry,path,age){
    const M=window.GardenEnemyMotion,p=M.profiles[entry.id],first=M.travelTime(entry,path,spawning.rank)+p.windup+p.strike;
    const cycle=M.duration(entry,'attack',path,spawning.rank),delta=first-age;
    return delta>=0?delta:((delta%cycle)+cycle)%cycle;
  }
  function createPopulation(spec,patrol,entries,random=Math.random,target=targetCount,onDeath=null,balanced=false,onEvent=null){
    const M=window.GardenEnemyMotion,F=window.GardenFairyPatrol;
    const actors=[];let bag=[],directionBag=[],serial=0,elapsed=0,spawned=0,completed=0,kills=0;
    const survival=!!window.GardenRunRules?.survival;
    const schedule=playable&&!survival&&target===window.GardenRunRules.population, introduced=new Set();let nextSpawn=0,formationIndex=0;
    const formations=schedule?window.GardenRunRules.formations:[];
    function nextEntry(){
      if(survival){
        const ids=window.GardenRunRules.eligibleEnemies(elapsed),pool=entries.filter(e=>ids.includes(e.id));
        return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]||entries[0];
      }
      if(schedule){
        const wave=window.GardenRunRules.waveAt(elapsed),ids=wave.pool.map(([id])=>id),pool=entries.filter(e=>ids.includes(e.id));
        const fresh=ids.map(id=>pool.find(e=>e.id===id)).find(e=>e&&!introduced.has(e.id));
        if(fresh){introduced.add(fresh.id);return fresh;}
        if(pool.length){const weighted=pool.flatMap(e=>Array(wave.pool.find(([id])=>id===e.id)[1]).fill(e));return weighted[Math.min(weighted.length-1,Math.floor(random()*weighted.length))];}
      }
      if(!bag.length){
        // Show all 12 species once; subsequent 40-entry bags preserve every
        // species while favoring small common enemies (60/30/10 by level).
        const pool=spawned===0?entries:entries.flatMap(e=>Array(spawning.levelWeights[e.level-1]).fill(e));
        bag=shuffled(pool,random);
      }
      return bag.pop();
    }
    function runPath(path){return {...path,stage:path.target+Math.min(10,path.start-path.target)};}
    function retarget(a){
      const g=spec.garden,point={x:a.pose.x,y:a.pose.ground};
      const cells=patrol.occupied.map(index=>({index,x:g.x+(index%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(index/g.columns)*g.pitch+g.line+g.cell-1}));
      const target=cells.sort((b,c)=>Math.hypot(b.x-point.x,b.y-point.y)-Math.hypot(c.x-point.x,c.y-point.y))[0];
      if(!target)return;
      const dx=point.x-target.x,dy=point.y-target.y,length=Math.hypot(dx,dy);
      a.path=runPath({start:target.x+length,target:target.x,ground:target.y,originX:target.x,originY:target.y,ux:length?dx/length:1,uy:length?dy/length:0,flower:target.index,side:a.path.side});
      a.motionAge=0;a.strikes=0;a.flowerHit=false;
    }
    function spawn(forced=null,point=null,group=null){
      if(!forced&&!directionBag.length)directionBag=shuffled(directions,random);
      const entry=forced||nextEntry(),side=point?.side||directionBag.pop();
      if(forced)introduced.add(entry.id);
      const initialPath=route(spec,patrol.boundary,entry,patrol.occupied,point?{side,spawnPoint:point}:{side,random});
      const path=playable?runPath(initialPath):initialPath;
      // Infinite survival: gradual enemy durability after the introductory 10 minutes.
      // Non-survival comparison models retain their original health exactly.
      const endurance=survival?1+Math.min(1.5,Math.max(0,elapsed-600)/7200):1;
      const enemyHp=balanced?Math.round(window.GardenWeaponBalance.hp(entry)*endurance*10)/10:entry.level;
      const actor={id:serial++,entry,path,formation:group,age:0,spawnTime:elapsed,blink:F.blinkSchedule(serial+11),expressionState:'auto',expression:'normal',pose:null,hp:enemyHp,hitUntil:0,populationTime:elapsed,motionAge:0,strikes:0,pendingHits:0,persistent:playable};
      actor.duration=M.duration(entry,'auto',path,spawning.rank);actors.push(actor);spawned++;
      if(survival)onEvent?.('survival_enemy_spawn',{enemy:entry.id,actor:actor.id,level:entry.level,hp:enemyHp,time:elapsed});
      updateActor(actor);return actor;
    }
    function updateActor(a){
      a.populationTime=elapsed;
      if(playable){
        const approach=M.travelTime(a.entry,a.path,spawning.rank),p=M.profiles[a.entry.id];
        const attackAge=Math.max(0,a.motionAge-approach),period=M.duration(a.entry,'attack',a.path,spawning.rank);
        const strikes=attackAge>=p.windup+p.strike?1+Math.floor((attackAge-p.windup-p.strike)/period):0;
        if(strikes>a.strikes){a.pendingHits+=strikes-a.strikes;a.strikes=strikes;}
        a.pose=runMotion(a.entry,a.path,a.motionAge);
      }else a.pose=worldPose(spec,a.path,M.sample(a.entry,'auto',a.age,a.path,spawning.rank),a.entry);
      a.expression=expressionFor(a.expressionState==='auto'&&elapsed<a.hitUntil?'hit':a.expressionState,a.pose.phase,a.blink(a.age));
    }
    function advance(seconds){
      if(patrol.finished||(playable&&!patrol.occupied.length))return elapsed;
      // Substeps retain smooth entry/exit and avoid a backlog burst after a
      // delayed frame. The target is a concurrent count, not cumulative spawns.
      let left=Math.max(0,Number.isFinite(seconds)?seconds:0);
      do {
        const dt=Math.min(spawning.step,left);left-=dt;elapsed+=dt;
        for(let i=actors.length-1;i>=0;i--){
          const a=actors[i];
          const slowed=elapsed<(a.slowUntil||0)&&(!balanced||!(a.entry.attackType==='charge'&&a.pose.phase==='strike')&&a.pose.lift<=3);
          const step=dt*(slowed?1-(a.slowAmount||0):1);a.age+=step;
          if(survival&&a.motionAge>45){actors.splice(i,1);completed++;continue;}
          if(playable){if(!patrol.occupied.includes(a.path.flower))retarget(a);a.motionAge+=step;updateActor(a);}
          else if(a.age>=a.duration){actors.splice(i,1);completed++;}else updateActor(a);
        }
        const wanted=target(elapsed);
        if(survival){
          if(actors.length<wanted&&elapsed+1e-7>=nextSpawn){
            spawn();nextSpawn=elapsed+window.GardenRunRules.spawnInterval(elapsed);
          }
        }else if(schedule){
          while(formationIndex<formations.length&&formations[formationIndex][0]<=elapsed+1e-7){
            const [at,kind,id,requested]=formations[formationIndex],group=formationIndex++;
            const entry=entries.find(e=>e.id===id),count=Math.max(0,Math.min(requested,wanted-actors.length));
            if(!entry)throw Error('Unknown formation enemy '+id);
            const points=formationPoints(spec,entry,kind,count,random);
            for(const point of points)spawn(entry,point,group);
            onEvent?.('formation_spawn',{group,at,kind,species:id,requested,count,blocked:requested-count});
          }
          if(actors.length<wanted&&elapsed+1e-7>=nextSpawn){const wave=window.GardenRunRules.waveAt(elapsed);for(let n=0;n<wave.batch&&actors.length<wanted;n++)spawn();nextSpawn=elapsed+wave.interval;}}
        else for(let n=0;n<spawning.maxBatch&&actors.length<wanted;n++)spawn();
      } while(left>1e-9);
      return elapsed;
    }
    function setExpression(id,state){
      if(!enemyStates.includes(state))return false;
      const a=actors.find(x=>x.id===id);if(!a)return false;
      a.expressionState=state;updateActor(a);return true;
    }
    function damage(id,amount){
      const i=actors.findIndex(a=>a.id===id);if(i<0||!Number.isFinite(amount)||amount<=0)return null;
      const a=actors[i];a.hp=Math.max(0,a.hp-amount);
      if(a.hp===0){actors.splice(i,1);kills++;if(survival)onEvent?.('survival_enemy_kill',{enemy:a.entry.id,actor:a.id,life:elapsed-a.spawnTime,time:elapsed});onDeath?.(a.pose.x,a.pose.ground,a);return {killed:true,hp:0};}
      a.hitUntil=elapsed+window.GardenFairyAttack.tuning.hitSeconds;updateActor(a);return {killed:false,hp:a.hp};
    }
    function slow(id,amount,duration){
      const a=actors.find(e=>e.id===id);if(!a)return false;
      const value=Math.max(0,Math.min(.9,amount));
      if(balanced){
        if(a.pose.lift>3||a.entry.attackType==='charge'&&a.pose.phase==='strike')return false;
        if(elapsed<(a.slowUntil||0)&&value<a.slowAmount)return false;
        if(elapsed>=(a.slowUntil||0)||value>a.slowAmount){a.slowAmount=value;a.slowUntil=elapsed+duration;return true;}
      }
      a.slowAmount=value;a.slowUntil=Math.max(a.slowUntil||0,elapsed+duration);return true;
    }
    function push(id,pixels){
      if(!balanced)return false;
      const a=actors.find(e=>e.id===id);
      if(!a||a.pose.lift>3||!['move','windup'].includes(a.pose.phase)||elapsed<(a.pushUntil||0))return false;
      const speed=M.profiles[a.entry.id].baseSpeed;
      const distance=pixels*(a.entry.level===3?.5:1);
      // Rewind on the original approach path, never cross back through a completed strike.
      const stage=M.travelTime(a.entry,a.path,spawning.rank);
      if(playable){
        if(a.motionAge<stage)a.motionAge=Math.max(0,a.motionAge-distance/speed);
        else{const offset=Math.hypot(a.pose.x-a.path.originX,a.pose.ground-a.path.originY)+distance;a.path=runPath({...a.path,start:a.path.target+offset});a.motionAge=0;a.strikes=0;}
      }
      else a.age=Math.max(0,Math.min(a.age,stage)-distance/speed);
      a.pushUntil=elapsed+.6;updateActor(a);return true;
    }
    return {actors,advance,setExpression,damage,slow,push,get elapsed(){return elapsed;},get spawned(){return spawned;},get completed(){return completed;},get kills(){return kills;}};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const entries=install(scene).map(e=>{
      const scale=e.span/Math.max(e.bounds.width,e.bounds.height);
      return {...e,scale,width:e.bounds.width*scale,height:e.bounds.height*scale};
    });
    const A=window.GardenFairyAttack;
    const weaponCombat=window.GardenHeroWeaponPreview?.combat&&window.GardenHeroWeaponPreview.enabled;
    const fixed=weaponCombat?window.GardenWeaponBalance.enemyCount:null;
    const finite=weaponCombat?window.GardenWeaponBalance.balanceWave:null;
    let model;
    const target=playable?window.GardenRunRules.population:finite!==null?t=>window.GardenWeaponBalance.finiteTarget(finite,t,model.actors.length,model.spawned):
      fixed!==null?()=>fixed:simulation?simulationTarget:targetCount;
    const relics=(A.enabled||weaponCombat)?window.GardenRelicCollection.attach(scene,spec,patrol):null;
    model=createPopulation(spec,patrol,entries,window.GardenSimulationRng?.enemy||Math.random,target,relics?.death,!!weaponCombat,window.GardenSimulationEvent);
    const sprites=new Map();
    const occlusion=window.GardenEnemyOcclusion.attach(scene,spec,patrol);
    // The playable field clips partial entry/exit sprites; HUD is never covered.
    const clip=scene.make.graphics({x:0,y:0,add:false});
    clip.fillStyle(0xffffff,1).fillRect(0,spec.top,spec.width,spec.height-spec.top-spec.bottom);
    const fieldMask=clip.createGeometryMask();
    const attack=A.enabled&&!weaponCombat?A.attach(scene,spec,patrol,model,fieldMask):null;
    function render(){
      const alive=new Set(model.actors.map(a=>a.id));
      for(const [id,sprite] of sprites)if(!alive.has(id)){sprite.image.destroy();sprite.shadow.destroy();sprites.delete(id);}
      for(const actor of model.actors){
        const a=actor.entry,r=a.bounds,p=actor.pose;
        let sprite=sprites.get(actor.id);
        if(!sprite){
          const image=scene.add.image(0,0,key(a.id,actor.expression)).setDepth(playable?window.GardenRunRules.depth.enemy:3).setMask(fieldMask).setName('enemy:actor:'+actor.id);
          const shadow=scene.add.ellipse(0,0,1,1,window.GardenPalette.roles.n.ink,.35).setDepth(playable?window.GardenRunRules.depth.shadow:.75).setMask(fieldMask).setName('enemy:shadow:'+actor.id);
          sprite={image,shadow};sprites.set(actor.id,sprite);
        }
        const {image,shadow}=sprite,{x,ground,lift,angle,sx,sy,flip}=p;
        image.setPosition(x,ground-a.height*sy/2-lift)
          .setOrigin((r.left+r.right)/2/size,(r.top+r.bottom)/2/size)
          .setScale(a.scale*sx*(flip?-1:1),a.scale*sy).setAngle(angle).setDepth((playable?window.GardenRunRules.depth.enemy:3)+Math.max(0,Math.min(.99,ground/spec.height)));
        const texture=key(a.id,actor.expression);if(image.texture.key!==texture)image.setTexture(texture);
        shadow.setPosition(x,ground+1).setDisplaySize(a.width*.72*(1-lift*.009),Math.max(2,a.height*.10)).setAlpha(.36/(1+lift*.055));
      }
    }
    function advance(seconds){
      const dt=Math.max(0,Number.isFinite(seconds)?seconds:0);
      if(!relics)model.advance(dt);
      else if(!patrol.finished){
        if(dt===0)model.advance(0);
        let left=dt;
        while(left>1e-8){
          const step=Math.min(left,A.tuning.step);left-=step;
          const previous=new Map((attack?.positions()||[]).map(e=>[e.id,e]));
          model.advance(step);
          relics.model.syncFlowers(patrol.occupied);
          let gardenHits=0;
          for(const e of model.actors){
            if(playable){if(e.pendingHits){
              if(scene.gardenEconomy)gardenHits+=e.pendingHits;
              else{
                const defense=scene.runEquipment?.defenseAt?.(e.path.flower)??scene.runEquipment?.defense()??0;
                const damage=window.GardenRunRules.damageToFlower(e.entry,defense);
                relics.model.damageFlower(e.path.flower,damage*e.pendingHits);
              }
              e.pendingHits=0;
            }}
            else if(!e.flowerHit&&(e.pose.phase==='recover'||e.pose.phase==='return')){e.flowerHit=true;relics.model.damageFlower(e.path.flower);}
          }
          if(gardenHits)scene.gardenEconomy?.damage(gardenHits,step);
          if(playable&&!window.GardenRunRules.survival){for(const [id,f] of relics.state.flowers)if(f.energy<=0)scene.runGarden?.remove(id);if(!patrol.occupied.length)break;}
          attack?.step(step,previous);relics.step(step);
        }
      }
      render();
      if(relics){attack?.render();relics.render();patrol.refreshHud();}
      occlusion.update(Array.from(sprites.values(),s=>s.image),dt);
      return model.elapsed;
    }
    function setExpression(id,state){const ok=model.setExpression(id,state);if(ok)render();return ok;}
    const update=(_time,delta)=>advance(Math.min(.1,Math.max(0,delta/1000)));
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);for(const {image,shadow} of sprites.values()){image.clearMask();shadow.clearMask();}sprites.clear();if(attack){attack.gfx.clearMask();attack.gfx.destroy();}fieldMask.destroy();clip.destroy();delete scene.enemyPreview;});
    scene.enemyPreview={entries,model,sprites,occlusion,attack,advance,setExpression,get actors(){return model.actors;},get targetCount(){return target(model.elapsed);},get elapsed(){return model.elapsed;}};
    advance(0);return scene.enemyPreview;
  }
  window.GardenEnemyPreview=Object.freeze({enabled,roster,preload,attach,key,route,enemyStates,expressionFor,spawning,targetCount,directions,worldPose,runMotion,runAttackIn,createPopulation,simulation,simulationTarget});
}());
