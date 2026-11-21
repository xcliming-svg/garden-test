(function(){
  'use strict';
  // Provisional balance, in logical pixels and active simulation seconds.
  const tuning=Object.freeze({lifetime:20,heartChance:.10,heal:20,maxEnergy:100,enemyDamage:15,
    initialSpeed:80,acceleration:480,maxSpeed:360,settleSeconds:.25,collectRadius:4,magnetAngle:100,nearRange:12,pickupRange:window.GardenFairyAttack.range,...window.GardenSimulationConfig?.relic});
  // Smooth outward axis: normalized rectangle coordinates rotate continuously
  // through corners, without assigning any corner to a preferred edge.
  const halfAngleCos=Math.cos(tuning.magnetAngle*Math.PI/360);
  const farming=!!window.GardenEconomy?.enabled;
  function eligible(drop,hero,patrol){
    if(!hero||!patrol||Math.hypot(hero.x-drop.x,hero.y-drop.y)>tuning.pickupRange)return false;
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
    const dx=point.x-x,dy=point.y-y,dist=Math.hypot(dx,dy),range=tuning.pickupRange;
    if(dist<=range)return point;
    const k=Math.max(0,range-8)/dist;
    return {x:x+dx*k,y:y+dy*k};
  }
  function create(spec,random=Math.random,chooseDrop=null,onEvent=null,canWater=()=>true){
    const state={drops:[],flowers:new Map(),gems:0,water:0,hearts:0,expired:0,spawnedGems:0,spawnedWater:0,spawnedHearts:0};
    let serial=0;
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    function syncFlowers(cells){
      const ids=new Set(cells),g=spec.garden;
      for(const id of state.flowers.keys())if(!ids.has(id))state.flowers.delete(id);
      for(const id of ids)if(!state.flowers.has(id))state.flowers.set(id,{id,energy:tuning.maxEnergy,
        x:g.x+(id%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(id/g.columns)*(g.pitchY||g.pitch)+g.line+g.cell/2});
    }
    function damageFlower(id,amount=tuning.enemyDamage){
      const f=state.flowers.get(id);
      if(!f||!Number.isFinite(amount)||amount<=0)return false;
      const before=f.energy;f.energy=Math.max(0,f.energy-amount);onEvent?.('flower_damage',{cell:id,amount,effective:before-f.energy,energy:f.energy});return true;
    }
    function weakest(){
      let best=null;
      for(const f of state.flowers.values()){
        // Live runs only spend hearts on living flowers that can benefit.
        if(window.GardenRunRules?.active&&(f.energy>=tuning.maxEnergy||
          !window.GardenRunRules.survival&&f.energy<=0))continue;
        if(!best||f.energy<best.energy||f.energy===best.energy&&f.id<best.id)best=f;
      }
      return best;
    }
    function spawn(kind,x,y,bounds){
      const half=6,b=window.GardenRunRules?.survival?null:spec.blueprint;
      x=clamp(x,half,spec.width-half);y=clamp(y,spec.top+half,spec.height-spec.bottom-half);
      if(b&&x-half<b.x+b.width&&y-half<b.y+b.height&&x+half>b.x&&y+half>b.y)x=b.x+b.width+half;
      const pos=reachable({x,y},bounds);
      const d={id:serial++,kind,...pos,age:0,speed:0,attracted:false};
      state.drops.push(d);onEvent?.('relic_spawn',{id:d.id,kind,x:d.x,y:d.y});
      if(kind==='gem')state.spawnedGems++;else if(kind==='water')state.spawnedWater++;else state.spawnedHearts++;
      return d;
    }
    function death(x,y,bounds){
      if(farming){const kind=(chooseDrop?chooseDrop(random):window.GardenRunRules.rollDrop(random))==='heart'?'heart':'water';spawn(kind,x,y,bounds);return null;}
      if(window.GardenRunRules?.active){const kind=chooseDrop?chooseDrop(random):window.GardenRunRules.rollDrop(random);if(kind==='gem'||kind==='heart')spawn(kind,x,y,bounds);else return {kind,x,y};return null;}
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
          target=d.kind==='water'&&!canWater()?null:d.kind==='gem'||d.kind==='water'||farming&&d.kind==='heart'?hero:weakest();
        }
        if(!target&&d.age>=d.lifetime-1e-8){state.expired++;onEvent?.('relic_expire',{id:d.id,kind:d.kind,age:d.age});continue;}
        if(target){
          d.attracted=true;d.speed=Math.min(tuning.maxSpeed,(d.speed||tuning.initialSpeed)+tuning.acceleration*dt);
          const dx=target.x-d.x,dy=target.y-d.y,dist=Math.hypot(dx,dy),travel=d.speed*dt;
          if(dist<=travel+tuning.collectRadius){
            if(d.kind==='gem'){state.gems++;onEvent?.('gem_collect',{id:d.id,age:d.age});}
            else if(d.kind==='water'){state.water++;onEvent?.('water_collect',{id:d.id,age:d.age});}
            else if(farming){state.hearts++;onEvent?.('garden_heal',{id:d.id,age:d.age});}
            else{const before=target.energy;target.energy=Math.min(tuning.maxEnergy,target.energy+tuning.heal);state.hearts++;onEvent?.('flower_heal',{id:d.id,cell:target.id,amount:tuning.heal,effective:target.energy-before,energy:target.energy,age:d.age});}
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
    const model=create(spec,window.GardenSimulationRng?.drop||Math.random,scene.run?.rewardDrop,window.GardenSimulationEvent,()=>scene.gardenEconomy?.canCollectWater()??true),images=new Map(),I=window.GardenItemCards;
    model.syncFlowers(patrol.occupied);
    function step(dt){
      model.syncFlowers(patrol.occupied);
      const hero=patrol.actors[0];
      const before=model.state.gems,water=model.state.water,hearts=model.state.hearts;
      model.step(dt,hero?.center,{bounds:patrol.bounds,direction:hero?.direction,length:patrol.length,speed:patrol.speed});
      if(scene.run&&model.state.gems>before)scene.run.credit(model.state.gems-before);
      if(scene.gardenEconomy){
        if(model.state.water>water)scene.gardenEconomy.gainWater((model.state.water-water)*window.GardenEconomy.tuning.waterPerDrop);
        if(model.state.hearts>hearts)scene.gardenEconomy.heal((model.state.hearts-hearts)*window.GardenEconomy.tuning.heartRecovery);
      }
    }
    function render(){
      const alive=new Set();
      for(const d of model.state.drops){
        alive.add(d.id);
        if(!images.has(d.id)){
          const image=d.kind==='water'?scene.add.graphics().setDepth(window.GardenRunRules.depth.relic):I.relicImage(scene,d.kind,d.x,d.y);
          if(d.kind==='water'){
            const P=window.GardenPalette.n;
            image.fillStyle(P.sky,1).fillCircle(0,3,6).fillTriangle(0,-10,-6,1,6,1);
            image.lineStyle(1,P.paper,.8).strokeCircle(0,3,6);
          }
          images.set(d.id,image.setName('ground-relic:'+d.kind+':'+d.id));
        }
        images.get(d.id).setPosition(d.x,d.y);
      }
      for(const [id,image] of images)if(!alive.has(id)){if(image.type==='Graphics')image.destroy();else I.destroyRelic(image);images.delete(id);}
    }
    const controller={model,state:model.state,step,render,death:(x,y)=>{const drop=model.death(x,y,patrol.bounds);if(drop)scene.runDrops?.spawn(drop.kind,x,y);}};
    scene.relicCollection=controller;
    scene.events.once('shutdown',()=>{images.clear();delete scene.relicCollection;});
    return controller;
  }
  window.GardenRelicCollection=Object.freeze({tuning,eligible,reachable,create,attach});
}());
