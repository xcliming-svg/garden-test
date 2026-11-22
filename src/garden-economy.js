(function(){
  'use strict';
  // Main-derived survival economy. Does not use the devel harvest comparator.
  const enabled=!!window.GardenRunRules?.survival;
  const names=Object.freeze(['sunflower','rose','hydrangea','lavender']);
  const labels=Object.freeze(['해바라기','장미','수국','라벤더']);
  // The entire garden expands from its central 2x2 into a 10x10 grid.
  // Each quadrant shares the same 1, 2, 3, 4 or 5 cell side length.
  const locations=Object.freeze([[0,0],[1,0],[0,1],[1,1]]);
  const weapons=Object.freeze(['rock','boomerang','balloon','wheel','flowerpot','paper-plane',
    'bouncy-ball','yellow-floor','sprinkler','broom']);
  // Prices account for base DPS, reach, crowd control, area coverage and passive value.
  // A purchase is permanent for this run; the unlock is tied to garden expansion.
  const inventory=Object.freeze([
    ['rock','돌멩이',0,1],['boomerang','부메랑',10,1],['balloon','물풍선',14,1],
    ['wheel','바퀴',32,2],['flowerpot','화분',42,2],['paper-plane','종이비행기',45,2],
    ['bouncy-ball','탱탱볼',72,3],['yellow-floor','끈끈이',80,3],
    ['sprinkler','스프링클러',120,4],['broom','빗자루',95,4],
    ['shoe','신발',24,1],['shield','방패',28,1]
  ]);
  const products=Object.freeze(inventory.map(([id,name,price,unlock])=>
    Object.freeze({id,name,price,unlock,weapon:weapons.includes(id)})));
  // One capability table governs the shop, economy and simulated weapon output.
  // Only rocks can fan out multiple projectiles. Other weapons keep their
  // identity through AoE, chaining, returning, slowing and other effects.
  const upgradeLimits=Object.freeze(Object.fromEntries(products.map(p=>[p.id,
    Object.freeze({power:p.weapon?2:3,volley:p.id==='rock'?3:0,speed:p.weapon?3:0})])));
  const upgradeTypes=id=>Object.entries(upgradeLimits[id]||{})
    .filter(([,limit])=>limit>0).map(([type])=>type);
  const tuning=Object.freeze({
    waterCapacity:100,waterPerDrop:20,wateringHoldSeconds:.65,
    bloomHold:1.5,flightDuration:.85,
    expansionCosts:Object.freeze([3,18,50,140]),maxSide:5,
    gardenHp:1200,damagePerHit:.6,damageCapStart:.20,damageCapHour:.14,
    damageCapMax:.62,recoveryPerSecond:.02,heartRecovery:18
  });
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const indexOfCell=cell=>(cell%10>=5?1:0)+(Math.floor(cell/10)>=5?2:0);
  const localCell=(id,i,side=1)=>{
    const x=(id%2===0?5-side:5)+i%side;
    const y=(id<2?5-side:5)+Math.floor(i/side);
    return y*10+x;
  };
  const cellsForSide=side=>names.flatMap((name,id)=>
    Array.from({length:side*side},(_,i)=>[localCell(id,i,side),name]));
  // Every full tank counts as one watering. Required counts are 1,2,3,4,5.
  const requiredAt=(_seconds,side=1)=>clamp(Math.trunc(side),1,tuning.maxSide);
  function create(_random=Math.random,onEvent=null){
    const state={
      side:1,water:0,elapsed:0,hp:tuning.gardenHp,totalHarvested:0,
      plots:names.map((name,id)=>({id,name,progress:0,required:requiredAt(0,1),count:0,
        phase:'growing',phaseSeconds:0,flowers:[],yield:0})),
      owned:new Set(['rock']),upgrades:Object.create(null)
    };
    for(const p of products)state.upgrades[p.id]={power:0,volley:0,speed:0};
    const emit=(type,data={})=>onEvent?.(type,{...data,time:state.elapsed});
    function ratio(id){
      const p=state.plots[id];
      return p?clamp(p.progress/p.required,0,1):0;
    }
    function stage(cell){
      const p=state.plots[indexOfCell(cell)];
      if(p.phase!=='growing')return 3;
      return ratio(p.id)>=.68?3:ratio(p.id)>=.34?2:1;
    }
    // Every flower blooms; enemies only damage the common garden HP.
    const wilt=()=>false;
    function gainWater(amount=tuning.waterPerDrop){
      if(!(amount>0))return 0;
      const before=state.water;
      state.water=clamp(state.water+amount,0,tuning.waterCapacity);
      const gained=state.water-before;
      if(gained)emit('garden_water_collect',{amount:gained,water:state.water});
      return gained;
    }
    function beginBloom(plot){
      plot.yield=state.side*state.side;
      plot.flowers=Array.from({length:plot.yield},(_,i)=>i);
      plot.phase='bloom';plot.phaseSeconds=0;
      emit('garden_bloom',{plot:plot.id,species:plot.name,side:state.side,yield:plot.yield});
    }
    function water(id){
      const p=state.plots[id];
      if(!p||p.phase!=='growing'||state.water<tuning.waterCapacity)return 0;
      state.water=0;
      p.progress++;
      emit('garden_water_use',{plot:id,species:p.name,progress:p.progress,required:p.required,spent:tuning.waterCapacity});
      if(p.progress>=p.required){p.progress=p.required;beginBloom(p);}
      return 1;
    }
    function tick(dt){
      if(!(dt>0))return [];
      state.elapsed+=dt;
      if(state.hp>0)state.hp=clamp(state.hp+tuning.recoveryPerSecond*dt,0,tuning.gardenHp);
      const flown=[];
      for(const p of state.plots){
        if(p.phase==='growing')continue;
        p.phaseSeconds+=dt;
        if(p.phase==='bloom'&&p.phaseSeconds>=tuning.bloomHold){
          p.phase='flight';p.phaseSeconds=0;flown.push(p.id);
        }else if(p.phase==='flight'&&p.phaseSeconds>=tuning.flightDuration){
          p.count+=p.yield;state.totalHarvested+=p.yield;
          emit('garden_harvest',{plot:p.id,species:p.name,side:state.side,flowers:p.yield,stock:p.count});
          p.progress=0;p.required=requiredAt(state.elapsed,state.side);
          p.phase='growing';p.phaseSeconds=0;p.yield=0;p.flowers=[];
        }
      }
      return flown;
    }
    function damage(hits,dt,defense=0){
      if(!(hits>0)||!(dt>0)||state.hp<=0)return 0;
      const maxPerSecond=Math.min(tuning.damageCapMax,
        tuning.damageCapStart+tuning.damageCapHour*state.elapsed/3600);
      const reduction=Math.max(.15,1-defense*.035);
      const amount=Math.min(maxPerSecond*dt,hits*tuning.damagePerHit)*reduction;
      state.hp=Math.max(0,state.hp-amount);
      if(amount)emit('garden_damage',{hits,amount,hp:state.hp,defense});
      return amount;
    }
    function heal(amount=tuning.heartRecovery){
      const before=state.hp;
      state.hp=clamp(state.hp+Math.max(0,amount),0,tuning.gardenHp);
      const healed=state.hp-before;
      if(healed)emit('garden_heal',{amount:healed,hp:state.hp});
      return healed;
    }
    const expansionCost=()=>state.side>=tuning.maxSide?null:
      Array(4).fill(tuning.expansionCosts[state.side-1]);
    const affordable=price=>!!price&&price.every((n,i)=>state.plots[i].count>=n);
    function spend(price){
      if(!affordable(price))return false;
      price.forEach((n,i)=>state.plots[i].count-=n);
      return true;
    }
    function expand(){
      if(state.plots.some(p=>p.phase!=='growing'))return false;
      const price=expansionCost();
      if(!spend(price))return false;
      state.side++;
      for(const p of state.plots){
        // Preserve completed MAX-tank applications; never create fractional credits.
        p.required=requiredAt(state.elapsed,state.side);
        p.progress=Math.min(p.progress,p.required-1);
      }
      emit('garden_expand',{side:state.side,price});
      return true;
    }
    const available=id=>{const p=products.find(p=>p.id===id);return !!p&&state.side>=p.unlock;};
    function cost(id,type){
      const p=products.find(p=>p.id===id),pos=products.indexOf(p);
      if(!p)return null;
      const level=type==='buy'?0:state.upgrades[id]?.[type]||0;
      if(type==='buy'&&state.owned.has(id))return null;
      if(type!=='buy'&&(!state.owned.has(id)||!upgradeLimits[id]?.[type]||
          level>=upgradeLimits[id][type]))return null;
      const mult=type==='buy'?1:
        type==='power'?(p.weapon?[1.5,4][level]:[2,5,12][level]):
        type==='volley'?[2.5,8,20][level]:[1,3.5,9][level];
      const total=Math.max(1,Math.ceil((type==='buy'?p.price:(p.price||18))*mult));
      const result=[0,0,0,0],rank=[pos%4,(pos+1)%4,(pos+2)%4,(pos+3)%4];
      const proportions=[.5,.25,.15,.1];
      let remainder=total;
      for(let i=0;i<4;i++){
        const part=i===3?remainder:Math.floor(total*proportions[i]);
        result[rank[i]]+=part;remainder-=part;
      }
      return result;
    }
    function purchase(id){
      if(!available(id)||state.owned.has(id))return false;
      const price=cost(id,'buy');
      if(!spend(price))return false;
      state.owned.add(id);
      emit('garden_purchase',{item:id,price});
      return true;
    }
    function upgrade(id,type){
      if(!available(id)||!upgradeLimits[id]?.[type])return false;
      const price=cost(id,type);
      if(!spend(price))return false;
      state.upgrades[id][type]++;
      emit('garden_upgrade',{item:id,type,level:state.upgrades[id][type],price});
      return true;
    }
    const bonus=id=>{
      const u=state.upgrades[id]||{power:0,volley:0,speed:0},limits=upgradeLimits[id];
      return {level:Math.min(3,1+u.power),
        volley:1+Math.min(u.volley,limits?.volley||0),
        speed:Math.min(u.speed,limits?.speed||0)*.15};
    };
    const defense=()=>state.owned.has('shield')?6+state.upgrades.shield.power*6:0;
    const speed=()=>40+(state.owned.has('shoe')?8+state.upgrades.shoe.power*6:0);
    return {state,stage,wilt,ratio,gainWater,water,tick,damage,heal,cost,affordable,purchase,
      upgrade,bonus,defense,speed,expansionCost,expand,available};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const model=create(window.GardenSimulationRng?.flower||Math.random,
      window.GardenSimulationEvent),state=model.state;
    const D=window.GardenRunRules.depth,U=window.GardenUI,P=window.GardenPalette.n,g=spec.garden;
    const centerFor=(id,side)=>({
      x:g.x+(5+(id%2===0?-side/2:side/2))*g.pitch+.5,
      y:g.y+(5+(id<2?-side/2:side/2))*g.pitch+.5
    });
    const centers=names.map((_,id)=>centerFor(id,state.side));
    const soil=scene.add.graphics().setDepth(D.soil+.05).setName('garden-economy-beds');
    function renderBeds(){
      soil.clear();
      for(let id=0;id<4;id++){
        const x=id%2===0?5-state.side:5,y=id<2?5-state.side:5;
        const px=g.x+x*g.pitch,py=g.y+y*g.pitch,size=state.side*g.pitch;
        soil.fillStyle(P.bark,.20).fillRect(px,py,size,size);
        soil.lineStyle(1,P.growth,.35).strokeRect(px+.5,py+.5,size-1,size-1);
        Object.assign(centers[id],centerFor(id,state.side));
      }
    }
    renderBeds();
    const left=10,top=46,w=172;
    U.panel(scene,left+w/2,top+90,w,180,{fill:U.C.panel,stroke:U.C.border}).setDepth(D.blueprint).setName('garden-economy-panel');
    const hpLabel=U.text(scene,left+10,top+12,'정원 HP',10,U.C.text).setDepth(D.blueprintText).setName('garden-hp-label');
    const hpValue=U.text(scene,left+w-9,top+12,'1000',10,U.C.text,{originX:1}).setDepth(D.blueprintText).setName('garden-hp-value');
    const panelBars=scene.add.graphics().setDepth(D.blueprintText).setName('garden-economy-bars');
    const icons=[],counts=[],charges=[];
    for(let id=0;id<4;id++){
      const x=left+12+(id%2)*82,y=top+48+Math.floor(id/2)*63;
      const icon=scene.add.image(x+13,y+12,window.GardenFlowerGrowth.key(names[id],3))
        .setDisplaySize(27,27).setDepth(D.blueprintIcon).setName('garden-economy-icon:'+names[id]);
      const count=U.text(scene,x+54,y+11,'0',12,U.C.text,{originX:.5,originY:.5})
        .setDepth(D.blueprintText).setName('harvest-count:'+names[id]);
      const charge=U.text(scene,x+35,y+27,'0/1',9,U.C.text,{originX:.5,originY:.5})
        .setDepth(D.blueprintText).setName('garden-water-count:'+names[id]);
      icons.push(icon);counts.push(count);charges.push(charge);
    }
    const marker=scene.add.graphics().setDepth(D.effects+.2).setName('garden-water-gauge');
    const maxText=U.text(scene,0,0,'MAX',11,U.C.text,{originX:.5,originY:.5})
      .setDepth(D.effects+.4).setVisible(false).setName('garden-water-max');
    const splashes=[];
    const key=scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    scene.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
    let down=false,touchId=null,wateringSeconds=0,atMax=false;
    function resume(){patrol.setPaused(false);}
    const nearest=()=>{
      const hero=patrol.actors[0]?.center;
      if(!hero)return -1;
      let best=-1,distance=Infinity;
      centers.forEach((c,i)=>{
        if(state.plots[i].phase!=='growing')return;
        const d=(hero.x-c.x)**2+(hero.y-c.y)**2;
        if(d<distance){distance=d;best=i;}
      });
      return best;
    };
    function startWatering(){
      if(wateringSeconds>0||state.water<tuning.waterCapacity)return false;
      const id=nearest();
      if(id<0||!model.water(id))return false;
      wateringSeconds=tuning.wateringHoldSeconds;
      patrol.setPaused(true);
      return true;
    }
    function onDown(){
      if(down)return;
      down=true;
      startWatering();
    }
    function onUp(){down=false;}
    function touchDown(pointer){
      if(touchId!==null||!pointer?.wasTouch)return;
      touchId=pointer.id;
      startWatering();
    }
    function touchUp(pointer){
      if(touchId!==pointer.id)return;
      touchId=null;
    }
    function cancel(){down=false;touchId=null;wateringSeconds=0;resume();}
    scene.input.keyboard.on('keydown-SPACE',onDown);
    scene.input.keyboard.on('keyup-SPACE',onUp);
    scene.input.on('pointerdown',touchDown);
    scene.input.on('pointerup',touchUp);
    scene.input.on('pointerupoutside',touchUp);
    scene.input.on('gameout',cancel);
    window.addEventListener('blur',cancel);
    const targets=icons.map(icon=>({x:icon.x,y:icon.y}));
    const lastCounts=Array(4).fill(-1),lastCharges=Array(4).fill('');let lastHp=-1;
    function fly(id){
      const p=state.plots[id];
      for(let i=0;i<p.flowers.length;i++){
        const cell=localCell(id,p.flowers[i],state.side);
        const e=scene.flowerGrowth?.entries.get(cell);
        if(!e)continue;
        e.image.setVisible(false);
        const image=scene.add.image(e.center.x,e.center.y,window.GardenFlowerGrowth.key(p.name,3))
          .setDisplaySize(20,20).setDepth(D.tooltip).setName('garden-harvest-flight:'+id+':'+i);
        const stagger=Math.min(i*20,320),duration=tuning.flightDuration*1000-stagger;
        scene.tweens.add({targets:image,x:targets[id].x,y:targets[id].y,
          scaleX:image.scaleX*.25,scaleY:image.scaleY*.25,duration,
          delay:stagger,ease:'Cubic.easeIn',onComplete:()=>image.destroy()});
      }
    }
    function render(){
      panelBars.clear();
      panelBars.fillStyle(P.slate,1).fillRect(left+10,top+30,w-20,8);
      panelBars.fillStyle(P.red,1).fillRect(left+11,top+31,Math.round((w-22)*state.hp/tuning.gardenHp),6);
      const currentHp=Math.ceil(state.hp);
      if(currentHp!==lastHp){lastHp=currentHp;hpValue.setText(String(currentHp));}
      state.plots.forEach((p,i)=>{
        const x=left+12+(i%2)*82,y=top+48+Math.floor(i/2)*63;
        panelBars.fillStyle(P.slate,1).fillRect(x,y+36,70,7);
        if(p.progress>0)panelBars.fillStyle(P.sky,1).fillRect(x+1,y+37,Math.round(68*model.ratio(i)),5);
        if(p.count!==lastCounts[i]){lastCounts[i]=p.count;counts[i].setText(String(p.count));}
        const value=p.progress+'/'+p.required;
        if(value!==lastCharges[i]){lastCharges[i]=value;charges[i].setText(value);}
      });
      const hero=patrol.actors[0];
      if(!hero)return;
      const v=hero.direction==='left'?[-1,0]:hero.direction==='right'?[1,0]:
        hero.direction==='up'?[0,-1]:[0,1];
      const x=hero.center.x+v[0]*26,y=hero.center.y+v[1]*26-8;
      marker.clear();
      marker.fillStyle(P.slate,.9).fillCircle(x,y+3,10);
      marker.fillTriangle(x,y-13,x-9,y+1,x+9,y+1);
      const fill=state.water/tuning.waterCapacity;
      const level=Math.round(fill*18);
      if(level>0){
        marker.fillStyle(P.sky,1).fillRect(x-6,y+11-level,12,level);
      }
      marker.lineStyle(1,P.paper,.9).strokeCircle(x,y+3,10);
      const now=state.water>=tuning.waterCapacity-1e-6;
      maxText.setPosition(x,y+20).setVisible(now);
      if(now&&!atMax){
        maxText.setAlpha(1);
        scene.tweens.add({targets:maxText,alpha:.28,duration:120,yoyo:true,repeat:1,
          onComplete:()=>maxText.setAlpha(1)});
      }
      atMax=now;
    }
    let completed=false;
    function update(_time,delta){
      if(completed)return;
      const dt=Math.min(.1,Math.max(0,delta/1000));
      scene.run?.tick(dt);
      if(wateringSeconds>0){
        wateringSeconds=Math.max(0,wateringSeconds-dt);
        if(wateringSeconds===0)resume();
      }
      const flown=model.tick(dt);
      flown.forEach(fly);
      for(const p of state.plots)if(p.phase==='growing')for(let i=0;i<state.side*state.side;i++){
        scene.flowerGrowth?.entries.get(localCell(p.id,i,state.side))?.image.setVisible(true);
      }
      render();
      if(state.hp<=0&&!completed){
        completed=true;
        scene.run.state.result='Defeat';
        patrol.setState('lose');
        scene.scene.pause('Game');
        scene.scene.launch('Defeat',{elapsed:scene.run.state.elapsed,kills:scene.enemyPreview?.model.kills||0,
          gems:0,progress:0});
      }
    }
    const controller={
      model,state,centers,nearest,
      gainWater:amount=>model.gainWater(amount),
      canCollectWater:()=>state.water<tuning.waterCapacity-1e-7,
      heal:amount=>model.heal(amount),
      damage:(hits,dt)=>model.damage(hits,dt,model.defense()),
      stageAt:cell=>model.stage(cell),wiltAt:cell=>model.wilt(cell),
      bonus:id=>model.bonus(id),
      expansionCost:()=>model.expansionCost(),
      available:id=>model.available(id),
      expand:()=>{
        if(!model.expand())return false;
        scene.gardenFarm?.addCells(cellsForSide(state.side));
        renderBeds();patrol.advance(0);render();return true;
      },
      buy:id=>{if(!model.purchase(id))return false;sync();render();return true;},
      upgrade:(id,type)=>{if(!model.upgrade(id,type))return false;sync();render();return true;},
      cost:(id,type)=>model.cost(id,type),
      affordable:price=>model.affordable(price),
      sync
    };
    function sync(){
      for(const [i,id] of weapons.entries()){
        if(state.owned.has(id))scene.heroWeaponPreview?.equip(i,id,model.bonus(id).level);
      }
      patrol.setSpeed(model.speed());
    }
    scene.gardenEconomy=controller;
    window.GardenEconomy.active=controller;
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{
      scene.events.off('update',update);
      scene.input.keyboard.off('keydown-SPACE',onDown);
      scene.input.keyboard.off('keyup-SPACE',onUp);
      scene.input.keyboard.removeCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
      scene.input.off('pointerdown',touchDown);
      scene.input.off('pointerup',touchUp);
      scene.input.off('pointerupoutside',touchUp);
      scene.input.off('gameout',cancel);
      window.removeEventListener('blur',cancel);
      if(window.GardenEconomy.active===controller)window.GardenEconomy.active=null;
      scene.gardenEconomy=null;
    });
    render();
    return controller;
  }
  window.GardenEconomy={enabled,names,labels,locations,weapons,products,upgradeLimits,upgradeTypes,tuning,
    indexOfCell,localCell,cellsForSide,requiredAt,create,attach,active:null};
}());