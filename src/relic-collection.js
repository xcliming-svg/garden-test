(function(){
  'use strict';
  // Provisional balance, in logical pixels and active simulation seconds.
  const tuning=Object.freeze({lifetime:20,heartChance:.10,heal:20,maxEnergy:100,enemyDamage:15,
    gemRange:48,initialSpeed:80,acceleration:480,maxSpeed:360,settleSeconds:.25,collectRadius:4});
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
      for(const f of state.flowers.values())if(f.energy<tuning.maxEnergy&&(!best||f.energy<best.energy||f.energy===best.energy&&f.id<best.id))best=f;
      return best;
    }
    function spawn(kind,x,y){
      const half=6,b=spec.blueprint;
      x=clamp(x,half,spec.width-half);y=clamp(y,spec.top+half,spec.height-spec.bottom-half);
      if(b&&x-half<b.x+b.width&&y-half<b.y+b.height&&x+half>b.x&&y+half>b.y)x=b.x+b.width+half;
      const d={id:serial++,kind,x,y,age:0,speed:0,attracted:false};
      state.drops.push(d);
      if(kind==='gem')state.spawnedGems++;else state.spawnedHearts++;
      return d;
    }
    function death(x,y){
      spawn('gem',x,y);
      if(random()<tuning.heartChance)spawn('heart',x+12,y);
    }
    function step(dt,hero){
      if(!(dt>0))return;
      const remaining=[];
      for(const d of state.drops){
        d.age+=dt;
        if(d.age>=tuning.lifetime-1e-8){state.expired++;continue;}
        let target=null;
        if(d.age>=tuning.settleSeconds){
          if(d.kind==='gem'&&hero&&(d.attracted||Math.hypot(hero.x-d.x,hero.y-d.y)<=tuning.gemRange))target=hero;
          if(d.kind==='heart')target=weakest();
        }
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
      model.step(dt,patrol.actors[0]?.center);
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
    const controller={model,state:model.state,step,render};
    scene.relicCollection=controller;
    scene.events.once('shutdown',()=>{images.clear();delete scene.relicCollection;});
    return controller;
  }
  window.GardenRelicCollection=Object.freeze({tuning,create,attach});
}());
