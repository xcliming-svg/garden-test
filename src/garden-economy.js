(function(){
  'use strict';
  // Main-derived survival economy. Does not use the devel harvest comparator.
  const enabled=!!window.GardenRunRules?.survival;
  const names=Object.freeze(['sunflower','rose','hydrangea','lavender']);
  const labels=Object.freeze(['해바라기','장미','수국','라벤더']);
  const locations=Object.freeze([[0,0],[3,0],[0,3],[3,3]]);
  const weapons=Object.freeze(['rock','boomerang','balloon','wheel','flowerpot','paper-plane',
    'bouncy-ball','yellow-floor','sprinkler','broom']);
  const products=Object.freeze([
    ['rock','돌멩이'],['boomerang','부메랑'],['balloon','물풍선'],['wheel','바퀴'],
    ['flowerpot','화분'],['paper-plane','종이비행기'],['bouncy-ball','탱탱볼'],
    ['yellow-floor','끈끈이'],['sprinkler','스프링클러'],['broom','빗자루'],
    ['shoe','신발'],['shield','방패']
  ].map(([id,name])=>Object.freeze({id,name,weapon:weapons.includes(id)})));
  const tuning=Object.freeze({
    waterCapacity:100,waterPerDrop:20,waterPerSecond:24,
    growthInitial:65,growthHour:14,growthCeiling:115,
    bloomHold:1.5,flightDuration:.85,
    gardenHp:1000,damagePerHit:.6,damageCapPerSecond:.09,
    recoveryPerSecond:.008,heartRecovery:35
  });
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const indexOfCell=cell=>Math.floor((cell%6)/3)+2*Math.floor(Math.floor(cell/6)/3);
  const localCell=(id,i)=>(locations[id][1]+Math.floor(i/3))*6+locations[id][0]+i%3;
  const requiredAt=seconds=>Math.min(tuning.growthCeiling,tuning.growthInitial+
    Math.max(0,seconds)*tuning.growthHour/3600);
  function create(random=Math.random){
    const state={
      water:0,elapsed:0,hp:tuning.gardenHp,totalHarvested:0,
      plots:names.map((name,id)=>({id,name,progress:0,required:tuning.growthInitial,count:0,
        phase:'growing',phaseSeconds:0,flowers:[],yield:0})),
      owned:new Set(['rock']),upgrades:Object.create(null)
    };
    for(const p of products)state.upgrades[p.id]={power:0,volley:0,speed:0};
    function ratio(id){
      const p=state.plots[id];
      return p?clamp(p.progress/p.required,0,1):0;
    }
    function stage(cell){
      const p=state.plots[indexOfCell(cell)];
      if(p.phase!=='growing')return 3;
      return ratio(p.id)>=.68?3:ratio(p.id)>=.34?2:1;
    }
    function wilt(cell){
      const p=state.plots[indexOfCell(cell)];
      if(p.phase==='growing')return false;
      const local=(Math.floor(cell/6)%3)*3+cell%6%3;
      return !p.flowers.includes(local);
    }
    function gainWater(amount=tuning.waterPerDrop){
      if(!(amount>0))return 0;
      const previous=state.water;
      state.water=clamp(state.water+amount,0,tuning.waterCapacity);
      return state.water-previous;
    }
    function beginBloom(plot){
      const ids=Array.from({length:9},(_,i)=>i);
      for(let i=8;i>0;i--){
        const j=Math.min(i,Math.floor(random()*(i+1)));
        const tmp=ids[i];ids[i]=ids[j];ids[j]=tmp;
      }
      plot.yield=clamp(1+Math.floor(random()*9),1,9);
      plot.flowers=ids.slice(0,plot.yield);
      plot.phase='bloom';
      plot.phaseSeconds=0;
    }
    function water(dt,id){
      const p=state.plots[id];
      if(!p||p.phase!=='growing'||!(dt>0)||state.water<=0)return 0;
      const amount=Math.min(state.water,tuning.waterPerSecond*dt,p.required-p.progress);
      if(!(amount>0))return 0;
      state.water-=amount;
      p.progress+=amount;
      if(p.progress>=p.required-1e-8){p.progress=p.required;beginBloom(p);}
      return amount;
    }
    function tick(dt){
      if(!(dt>0))return [];
      state.elapsed+=dt;
      state.hp=clamp(state.hp+tuning.recoveryPerSecond*dt,0,tuning.gardenHp);
      const flown=[];
      for(const p of state.plots){
        if(p.phase==='growing')continue;
        p.phaseSeconds+=dt;
        if(p.phase==='bloom'&&p.phaseSeconds>=tuning.bloomHold){
          p.phase='flight';p.phaseSeconds=0;flown.push(p.id);
        }else if(p.phase==='flight'&&p.phaseSeconds>=tuning.flightDuration){
          p.count+=p.yield;
          state.totalHarvested+=p.yield;
          p.progress=0;p.required=requiredAt(state.elapsed);
          p.phase='growing';p.phaseSeconds=0;p.yield=0;p.flowers=[];
        }
      }
      return flown;
    }
    function damage(hits,dt,defense=0){
      if(!(hits>0)||!(dt>0)||state.hp<=0)return 0;
      const v=Math.min(tuning.damageCapPerSecond*dt,hits*tuning.damagePerHit*
        Math.max(.1,1-defense*.055));
      state.hp=Math.max(0,state.hp-v);
      return v;
    }
    function heal(amount=tuning.heartRecovery){
      const before=state.hp;
      state.hp=clamp(state.hp+Math.max(0,amount),0,tuning.gardenHp);
      return state.hp-before;
    }
    function cost(id,type){
      const pos=products.findIndex(x=>x.id===id);
      if(pos<0)return null;
      const up=state.upgrades[id];
      const level=type==='buy'?0:up?.[type]||0;
      if(type!=='buy'&&(!state.owned.has(id)||level>=3))return null;
      if(type==='buy'&&state.owned.has(id))return null;
      // Each resource is relevant across the catalog. Costs remain gentle.
      const base=type==='buy'?2:2+level*2;
      const one=pos%4,two=(pos+(type==='power'?1:type==='speed'?2:3))%4;
      const result=[0,0,0,0];
      result[one]+=base;result[two]+=type==='buy'?1:1+level;
      return result;
    }
    const affordable=price=>!!price&&price.every((n,i)=>state.plots[i].count>=n);
    function spend(price){
      if(!affordable(price))return false;
      price.forEach((n,i)=>state.plots[i].count-=n);
      return true;
    }
    function purchase(id){
      if(!products.some(p=>p.id===id)||state.owned.has(id))return false;
      if(!spend(cost(id,'buy')))return false;
      state.owned.add(id);return true;
    }
    function upgrade(id,type){
      if(!['power','volley','speed'].includes(type))return false;
      if(!products.some(p=>p.id===id))return false;
      if(!spend(cost(id,type)))return false;
      state.upgrades[id][type]++;
      return true;
    }
    const bonus=id=>{
      const u=state.upgrades[id]||{power:0,volley:0,speed:0};
      return {level:Math.min(3,1+u.power),volley:1+u.volley,speed:u.speed*.15};
    };
    const defense=()=>state.owned.has('shield')?6+state.upgrades.shield.power*6:0;
    const speed=()=>40+(state.owned.has('shoe')?8+state.upgrades.shoe.power*6:0);
    return {state,stage,wilt,ratio,gainWater,water,tick,damage,heal,cost,affordable,purchase,upgrade,bonus,defense,speed};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const model=create(window.GardenSimulationRng?.flower||Math.random),state=model.state;
    const D=window.GardenRunRules.depth,U=window.GardenUI,P=window.GardenPalette.n,g=spec.garden;
    const centers=locations.map(([x,y])=>({
      x:g.x+(x+1.5)*g.pitch+.5,y:g.y+(y+1.5)*g.pitch+.5
    }));
    const soil=scene.add.graphics().setDepth(D.soil+.05).setName('garden-economy-beds');
    for(const [x,y] of locations){
      soil.fillStyle(P.bark,.20).fillRect(g.x+x*g.pitch,g.y+y*g.pitch,3*g.pitch,3*g.pitch);
      soil.lineStyle(1,P.growth,.35).strokeRect(g.x+x*g.pitch+.5,g.y+y*g.pitch+.5,3*g.pitch-1,3*g.pitch-1);
    }
    const left=10,top=46,w=172;
    U.panel(scene,left+w/2,top+90,w,180,{fill:U.C.panel,stroke:U.C.border}).setDepth(D.blueprint).setName('garden-economy-panel');
    const hpLabel=U.text(scene,left+10,top+12,'정원 HP',10,U.C.text).setDepth(D.blueprintText).setName('garden-hp-label');
    const hpValue=U.text(scene,left+w-9,top+12,'1000',10,U.C.text,{originX:1}).setDepth(D.blueprintText).setName('garden-hp-value');
    const panelBars=scene.add.graphics().setDepth(D.blueprintText).setName('garden-economy-bars');
    const icons=[],counts=[];
    for(let id=0;id<4;id++){
      const x=left+12+(id%2)*82,y=top+48+Math.floor(id/2)*63;
      const icon=scene.add.image(x+13,y+12,window.GardenFlowerGrowth.key(names[id],3))
        .setDisplaySize(27,27).setDepth(D.blueprintIcon).setName('garden-economy-icon:'+names[id]);
      const count=U.text(scene,x+54,y+11,'0',12,U.C.text,{originX:.5,originY:.5})
        .setDepth(D.blueprintText).setName('harvest-count:'+names[id]);
      icons.push(icon);counts.push(count);
    }
    const marker=scene.add.graphics().setDepth(D.effects+.2).setName('garden-water-gauge');
    const maxText=U.text(scene,0,0,'MAX',11,U.C.text,{originX:.5,originY:.5})
      .setDepth(D.effects+.4).setVisible(false).setName('garden-water-max');
    const splashes=[];
    const key=scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    scene.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
    let down=false,touchId=null,watered=-1,atMax=false;
    const held=()=>down||touchId!==null;
    function resume(){patrol.setPaused(false);watered=-1;}
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
    function onDown(){
      if(down)return;
      down=true;
      if(state.water>0&&nearest()>=0)patrol.setPaused(true);
    }
    function onUp(){
      down=false;
      if(!held())resume();
    }
    function touchDown(pointer){
      if(touchId!==null||!pointer?.wasTouch)return;
      touchId=pointer.id;
      if(state.water>0&&nearest()>=0)patrol.setPaused(true);
    }
    function touchUp(pointer){
      if(touchId!==pointer.id)return;
      touchId=null;
      if(!held())resume();
    }
    function cancel(){down=false;touchId=null;resume();}
    scene.input.keyboard.on('keydown-SPACE',onDown);
    scene.input.keyboard.on('keyup-SPACE',onUp);
    scene.input.on('pointerdown',touchDown);
    scene.input.on('pointerup',touchUp);
    scene.input.on('pointerupoutside',touchUp);
    scene.input.on('gameout',cancel);
    window.addEventListener('blur',cancel);
    const targets=icons.map(icon=>({x:icon.x,y:icon.y}));
    const lastCounts=Array(4).fill(-1);let lastHp=-1;
    function fly(id){
      const p=state.plots[id];
      for(let i=0;i<p.flowers.length;i++){
        const cell=localCell(id,p.flowers[i]);
        const e=scene.flowerGrowth?.entries.get(cell);
        if(!e)continue;
        e.image.setVisible(false);
        const image=scene.add.image(e.center.x,e.center.y,window.GardenFlowerGrowth.key(p.name,3))
          .setDisplaySize(20,20).setDepth(D.tooltip).setName('garden-harvest-flight:'+id+':'+i);
        scene.tweens.add({targets:image,x:targets[id].x,y:targets[id].y,
          scaleX:image.scaleX*.25,scaleY:image.scaleY*.25,duration:tuning.flightDuration*1000,
          delay:i*30,ease:'Cubic.easeIn',onComplete:()=>image.destroy()});
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
      const started=held()&&state.water>0;
      const id=started?nearest():-1;
      if(id>=0){
        patrol.setPaused(true);
        model.water(dt,id);
        watered=id;
      }else if(patrol.paused&&held()&&state.water<=0)resume();
      else if(!held()&&patrol.paused)resume();
      for(const p of state.plots)if(p.phase==='bloom'&&p.phaseSeconds===0&&watered===p.id)watered=-1;
      const flown=model.tick(dt);
      flown.forEach(fly);
      for(const p of state.plots)if(p.phase==='growing')for(let i=0;i<9;i++){
        scene.flowerGrowth?.entries.get(localCell(p.id,i))?.image.setVisible(true);
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
  window.GardenEconomy={enabled,names,labels,locations,weapons,products,tuning,
    indexOfCell,localCell,requiredAt,create,attach,active:null};
}());