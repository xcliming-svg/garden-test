(function(){
  'use strict';
  // Provisional balance, in logical pixels and active simulation seconds.
  const tuning=Object.freeze({lifetime:20,heartChance:.10,heal:20,maxEnergy:100,enemyDamage:15,
    initialSpeed:80,acceleration:480,maxSpeed:360,settleSeconds:.25,collectRadius:4,magnetAngle:100,nearRange:12});
  // Smooth outward axis: normalized rectangle coordinates rotate continuously
  // through corners, without assigning any corner to a preferred edge.
  const halfAngleCos=Math.cos(tuning.magnetAngle*Math.PI/360);
  function eligible(drop,hero,patrol){
    if(!hero||!patrol||!window.GardenFairyAttack.inRange(hero,drop))return false;
    const dx=drop.x-hero.x,dy=drop.y-hero.y,dist=Math.hypot(dx,dy);
    if(dist<=tuning.nearRange)return true;
    const b=patrol.bounds,mx=(b.left+b.right)/2,my=(b.top+b.bottom)/2;
    const ax=(hero.x-mx)/Math.max(1,(b.right-b.left)/2);
    const ay=(hero.y-my)/Math.max(1,(b.bottom-b.top)/2);
    // Enemies may die inside the patrol rectangle. Use the inward mirror
    // only for those drops, so they cannot become unreachable behind the fan.
    const inward=drop.x>b.left&&drop.x<b.right&&drop.y>b.top&&drop.y<b.bottom;
    return (dx*ax+dy*ay)*(inward?-1:1)>=dist*Math.hypot(ax,ay)*halfAngleCos-1e-8;
  }
  // Collision radii and heart offset can put a killed enemy's drop slightly
  // beyond the nominal attack radius. Keep only those exceptional drops in reach.
  function reachable(point,b){
    if(!b)return point;
    const x=Math.max(b.left,Math.min(b.right,point.x)),y=Math.max(b.top,Math.min(b.bottom,point.y));
    const dx=point.x-x,dy=point.y-y,dist=Math.hypot(dx,dy),range=window.GardenFairyAttack.range;
    if(dist<=range)return point;
    const k=(range-8)/dist;
    return {x:x+dx*k,y:y+dy*k};
  }
  function create(spec,random=Math.random){
    const state={drops:[],flowers:new Map(),gems:0,hearts:0,expired:0,spawnedGems:0,spawnedHearts:0};
    let serial=0;
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    function syncFlowers(cells){
      const ids=new Set(cells),g=spec.garden;
      for(const id of state.flowers.keys())if(!ids.has(id))state.flowers.delete(id);
      for(const id of ids)if(!state.flowers.has(id))state.flowers.set(id,{id,energy:tuning.maxEnergy,
        x:g.x+(id%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(id/g.columns)*g.pitch+g.line+g.cell/2});
    }
    function damageFlower(id,amount=tuning.enemyDamage){
      const f=state.flowers.get(id);
      if(!f||!Number.isFinite(amount)||amount<=0)return false;
      f.energy=Math.max(0,f.energy-amount);return true;
    }
    function weakest(){
      let best=null;
      for(const f of state.flowers.values())if(!best||f.energy<best.energy||f.energy===best.energy&&f.id<best.id)best=f;
      return best;
    }
    function spawn(kind,x,y,bounds){
      const half=6,b=spec.blueprint;
      x=clamp(x,half,spec.width-half);y=clamp(y,spec.top+half,spec.height-spec.bottom-half);
      if(b&&x-half<b.x+b.width&&y-half<b.y+b.height&&x+half>b.x&&y+half>b.y)x=b.x+b.width+half;
      const pos=reachable({x,y},bounds);
      const d={id:serial++,kind,...pos,age:0,speed:0,attracted:false};
      state.drops.push(d);
      if(kind==='gem')state.spawnedGems++;else state.spawnedHearts++;
      return d;
    }
    function death(x,y,bounds){
      spawn('gem',x,y,bounds);
      if(random()<tuning.heartChance)spawn('heart',x+12,y,bounds);
    }
    function step(dt,hero,patrol){
      if(!(dt>0))return;
      const remaining=[];
      for(const d of state.drops){
        d.age+=dt;
        // Preserve the original minimum lifetime, but grant a full current
        // lap after landing. Once captured, transit cannot expire.
        const lap=patrol&&patrol.speed>0?patrol.length/patrol.speed:0;
        d.lifetime=Math.max(d.lifetime||tuning.lifetime,tuning.lifetime,lap+tuning.settleSeconds+1);
        let target=null;
        if(d.age>=tuning.settleSeconds-1e-8&&(d.attracted||eligible(d,hero,patrol))){
          target=d.kind==='gem'?hero:weakest();
        }
        if(!target&&d.age>=d.lifetime-1e-8){state.expired++;continue;}
        if(target){
          d.attracted=true;d.speed=Math.min(tuning.maxSpeed,(d.speed||tuning.initialSpeed)+tuning.acceleration*dt);
          const dx=target.x-d.x,dy=target.y-d.y,dist=Math.hypot(dx,dy),travel=d.speed*dt;
          if(dist<=travel+tuning.collectRadius){
            if(d.kind==='gem')state.gems++;
            else{target.energy=Math.min(tuning.maxEnergy,target.energy+tuning.heal);state.hearts++;}
            continue;
          }
          d.x+=dx*travel/dist;d.y+=dy*travel/dist;
        }else{d.speed=0;d.attracted=false;}
        remaining.push(d);
      }
      state.drops=remaining;
    }
    return {state,syncFlowers,damageFlower,weakest,death,step};
  }
  function attach(scene,spec,patrol){
    const model=create(spec),images=new Map(),I=window.GardenItemCards;
    model.syncFlowers(patrol.occupied);
    function step(dt){
      model.syncFlowers(patrol.occupied);
      const hero=patrol.actors[0];
      model.step(dt,hero?.center,{bounds:patrol.bounds,direction:hero?.direction,length:patrol.length,speed:patrol.speed});
    }
    function render(){
      const alive=new Set();
      for(const d of model.state.drops){
        alive.add(d.id);
        if(!images.has(d.id))images.set(d.id,I.relicImage(scene,d.kind,d.x,d.y).setName('ground-relic:'+d.kind+':'+d.id));
        images.get(d.id).setPosition(d.x,d.y);
      }
      for(const [id,image] of images)if(!alive.has(id)){I.destroyRelic(image);images.delete(id);}
    }
    const controller={model,state:model.state,step,render,death:(x,y)=>model.death(x,y,patrol.bounds)};
    scene.relicCollection=controller;
    scene.events.once('shutdown',()=>{images.clear();delete scene.relicCollection;});
    return controller;
  }
  window.GardenRelicCollection=Object.freeze({tuning,eligible,reachable,create,attach});
}());
