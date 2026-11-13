(function () {
  'use strict';
  // Temporary survival sandbox. Logical coordinates, seconds, no persistent game state.
  const tuning=Object.freeze({walkSpeed:24,enemySpeed:38,stageSeconds:15,initialRate:0.8,
    rateStep:0.65,maxRate:6,maxEnemies:160,pulseInterval:1.7,firstPulse:0.65,
    pulseSpeed:180,pulseRadius:160,hitRadius:10,arrivalHold:2.5});
  const spawnRate=t=>Math.min(tuning.maxRate,tuning.initialRate+Math.floor(t/tuning.stageSeconds)*tuning.rateStep);
  function create(spec,bounds,patrolPosition) {
    const g=spec.garden, cx=g.x+g.size/2, cy=g.y+g.size/2;
    let seed=0x4b1d3a17, serial=0, credit=0.85, nextPulse=tuning.firstPulse;
    let patrolDistance=(bounds.right-bounds.left)/2;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const state={elapsed:0,kills:0,spawned:0,arrived:0,pulsesEmitted:0,
      guardian:patrolPosition(bounds,patrolDistance),enemies:[],pulses:[],deaths:[],stage:1,rate:spawnRate(0)};
    function spawn(){
      const side=serial%4, margin=16, bottom=spec.height-spec.bottom;
      let x,y;
      if(side===0||side===2){
        x=serial===0?state.guardian.x:margin+random()*(spec.width-2*margin);
        y=side===0?spec.top-margin:bottom+margin;
      }else{
        x=side===1?spec.width+margin:-margin;
        y=spec.top+margin+random()*(spec.fieldHeight-2*margin);
      }
      const tx=cx+(random()-0.5)*g.size*0.50,ty=cy+(random()-0.5)*g.size*0.50;
      state.enemies.push({id:serial++,x,y,tx,ty,flip:tx>x,speed:tuning.enemySpeed*(0.88+random()*0.24),hold:0,side});
      state.spawned++;
    }
    function step(dt){
      state.elapsed+=dt;
      state.stage=1+Math.floor(state.elapsed/tuning.stageSeconds);
      state.rate=spawnRate(state.elapsed);
      patrolDistance+=dt*tuning.walkSpeed;
      state.guardian=patrolPosition(bounds,patrolDistance);
      credit=Math.min(2,credit+dt*state.rate);
      while(credit>=1&&state.enemies.length<tuning.maxEnemies){credit--;spawn();}
      while(state.elapsed>=nextPulse){
        const {x,y}=state.guardian;
        state.pulses.push({x,y,r:0,prev:0});state.pulsesEmitted++;nextPulse+=tuning.pulseInterval;
      }
      for(const p of state.pulses){p.prev=p.r;p.r=Math.min(tuning.pulseRadius,p.r+dt*tuning.pulseSpeed);}
      for(const e of state.enemies){
        const oldX=e.x,oldY=e.y,dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy);
        if(d>0.01){const s=Math.min(d,e.speed*dt);e.x+=dx*s/d;e.y+=dy*s/d;e.hold=0;}
        else e.hold+=dt;
        // Swept annulus test: compare relative distances across this substep.
        for(const p of state.pulses){
          const a=Math.hypot(oldX-p.x,oldY-p.y)-p.prev,b=Math.hypot(e.x-p.x,e.y-p.y)-p.r;
          if(Math.min(a,b)<=tuning.hitRadius&&Math.max(a,b)>=-tuning.hitRadius){
            e.dead=true;state.kills++;state.deaths.push({x:e.x,y:e.y,age:0});break;
          }
        }
        if(!e.dead&&e.hold>=tuning.arrivalHold){e.dead=true;state.arrived++;}
      }
      state.enemies=state.enemies.filter(e=>!e.dead);
      state.pulses=state.pulses.filter(p=>p.r<tuning.pulseRadius);
      for(const d of state.deaths)d.age+=dt;
      state.deaths=state.deaths.filter(d=>d.age<0.25);
    }
    function advance(seconds){
      let remaining=Math.max(0,seconds);
      while(remaining>1e-8){const dt=Math.min(remaining,1/30);step(dt);remaining-=dt;}
      return state;
    }
    return {state,advance};
  }
  function attach(scene,spec,bounds,patrolPosition,guardian,enemyKey,enemySize,updateHud){
    const model=create(spec,bounds,patrolPosition),P=window.GardenPalette.n;
    const actors=new Map();
    // Clip both enemy sprites and pulse effects to the field, never to HUD.
    const maskShape=scene.make.graphics({x:0,y:0,add:false});
    maskShape.fillStyle(0xffffff,1).fillRect(0,spec.top,spec.width,spec.fieldHeight);
    const mask=maskShape.createGeometryMask();
    const fx=scene.add.graphics().setDepth(3).setName('combat-preview-pulses').setMask(mask);
    function render(){
      const s=model.state;
      guardian.setPosition(s.guardian.x,s.guardian.y);
      const alive=new Set();
      for(const e of s.enemies){
        alive.add(e.id);
        if(!actors.has(e.id)){
          actors.set(e.id,scene.add.image(e.x,e.y,enemyKey).setDisplaySize(enemySize,enemySize)
            .setFlipX(e.flip).setDepth(2).setMask(mask).setName('placeholder:enemy:caterpillar:'+e.id));
        }
        actors.get(e.id).setPosition(e.x,e.y);
      }
      for(const [id,obj] of actors)if(!alive.has(id)){obj.destroy();actors.delete(id);}
      fx.clear();
      for(const p of s.pulses){
        const opacity=1-0.45*p.r/tuning.pulseRadius;
        fx.lineStyle(5,P.ink,opacity).strokeCircle(p.x,p.y,Math.max(1,p.r));
        fx.lineStyle(2,P.gold,opacity).strokeCircle(p.x,p.y,Math.max(1,p.r));
      }
      for(const d of s.deaths){
        const a=1-d.age/0.25,r=4+d.age*36;
        fx.lineStyle(4,P.ink,a).strokeCircle(d.x,d.y,r);
        fx.lineStyle(2,P.gold,a).strokeCircle(d.x,d.y,r);
      }
      updateHud(s.elapsed,s.kills);
    }
    function advance(seconds){model.advance(seconds);render();return model.state;}
    const update=(_time,delta)=>advance(Math.min(0.1,Math.max(0,delta/1000)));
    const controller={advance,state:model.state,tuning};
    scene.combatPreview=controller;
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{
      scene.events.off('update',update);
      for(const obj of actors.values())if(obj.scene)obj.clearMask();
      if(fx.scene)fx.clearMask();
      mask.destroy();maskShape.destroy();actors.clear();
      delete scene.combatPreview;
    });
    render();
    return controller;
  }
  window.GardenCombatPreview=Object.freeze({tuning,spawnRate,create,attach});
}());
