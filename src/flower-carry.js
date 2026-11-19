(function(){
  'use strict';
  // Isolated human-play prototype. Explicit simulation and lab remain unchanged.
  const enabled=!!window.GardenRunRules?.active&&!window.GardenSimulationConfig&&!window.__gardenSimHarness&&!window.GardenFlowerCarryDisabled;
  const speedBonus=80,pickupRadius=28,slotLimit=4,installationLife=12;
  const installationIds=Object.freeze(['yellow-floor','sprinkler','broom']);
  const isInstallation=id=>installationIds.includes(id);
  const carryable=c=>c.kind==='flower'||c.kind==='item'&&isInstallation(c.id);
  const automatic=c=>c.kind==='item'&&!isInstallation(c.id);
  function fifoSlot(order,limit=slotLimit){
    if(order.length>=limit){const i=order.shift();order.push(i);return i;}
    const i=Array.from({length:limit},(_,j)=>j).find(j=>!order.includes(j));order.push(i);return i;
  }
  function installationCell(spec,p){const g=spec.garden,x=Math.floor((p.x-g.x)/g.pitch),y=Math.floor((p.y-g.y)/g.pitch);return x>=0&&x<g.columns&&y>=0&&y<g.rows?y*g.columns+x:-1;}
  function installationSafe(spec,p,occupied){return p.x>=0&&p.x<=spec.width&&p.y>=spec.top&&p.y<=spec.height-spec.bottom&&!new Set(occupied).has(installationCell(spec,p));}
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function step(p,x,y,dt,speed,bounds){
    const len=Math.hypot(x,y);
    if(!len||!(dt>0))return {...p};
    return {x:clamp(p.x+x/len*speed*dt,bounds.left,bounds.right),y:clamp(p.y+y/len*speed*dt,bounds.top,bounds.bottom)};
  }
  function nearest(cards,p,predicate=carryable){
    let best=null,distance=pickupRadius+1e-8;
    for(const card of cards){
      if(!predicate(card)||card.consumed)continue;
      const d=Math.hypot(card.x-p.x,card.y-p.y);
      if(d<distance){best=card;distance=d;}
    }
    return best;
  }
  function attach(scene,spec){
    if(!enabled)return null;
    const R=window.GardenRunRules,G=window.GardenFlowerGrowth,L=window.GardenGameLayout,U=window.GardenUI;
    const keys=new Set(),moveKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
    let carried=null,highlighted=null,target=-1;
    const icon=scene.add.image(0,0,G.key(G.names[0],3,100)).setDisplaySize(20,20).setDepth(R.depth.fairy+1).setName('flower-carry-icon').setVisible(false);
    const hint=U.text(scene,spec.width-10,spec.top+8,'',12,U.C.muted,{originX:1,originY:0,inkAlign:'right'}).setDepth(R.depth.blueprintText).setName('flower-carry-hint');
    const hero=()=>scene.fairyPatrol.actors[0];
    const active=()=>scene.scene.isActive('Game')&&!scene.run?.state.result;
    function movement(){return {x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),y:Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))};}
    function cell(){const p=hero().center;return L.gardenHit(p.x,p.y,spec.garden);}
    function canPlant(id){return carried?.kind==='flower'&&!scene.runGarden.holding&&(window.GardenFairyFlowerbeds?.enabled||R.blueprint.some(([i,name])=>i===id&&name===carried.name))&&R.canPlant(scene.runGarden.occupied,scene.flowerGrowth.entries,id,carried.name);}
    function setHighlight(card){
      if(highlighted===card)return;
      if(highlighted?.marker.scene)highlighted.marker.setStrokeStyle(0,0,0);
      highlighted=card;
      if(card?.marker.scene)card.marker.setStrokeStyle(1,L.colors.flowerBorder,1);
    }
    function setTarget(id){if(target===id)return;target=id;scene.runGarden.refreshSoil(id<0?null:id);}
    function collectAutomatic(){
      let card;while((card=nearest(scene.runDrops.drops.values(),hero().center,automatic))){
        if(!scene.runEquipment.collectAutomatic(card.item))break;
        scene.runDrops.consume(card);card.marker.disableInteractive().setVisible(false);
      }
    }
    function render(){
      if(!active())return;
      collectAutomatic();const a=hero();
      if(carried){
        setHighlight(null);const id=cell(),valid=canPlant(id),install=carried.kind==='item';setTarget(valid?id:-1);
        icon.setTexture(install?carried.texture:G.key(carried.name,3,100)).setDisplaySize(20,20).setPosition(a.center.x,Math.max(spec.top+11,a.center.y-a.visibleHeight/2-12)).setVisible(true);
        hint.setText(install?(installationSafe(spec,a.center,scene.runGarden.occupied)?'SPACE 설치':'꽃이 없는 곳으로 이동'):valid?(scene.runGarden.occupied.has(id)?'SPACE 꽃 교체':'SPACE 심기'):scene.runGarden.occupied.has(id)?'빈 곳으로 이동':'SPACE 내려놓기');
      }else{
        icon.setVisible(false);setTarget(-1);
        const card=nearest(scene.runDrops.drops.values(),a.center);setHighlight(card);
        const ready=scene.fairyFlowerbeds?.model.state.some(s=>s.bed.center===cell()&&s.ready);
        hint.setText(ready?'SPACE 요정 변경':card?(card.kind==='flower'?'SPACE 꽃 줍기':'SPACE 설치형 줍기'):'WASD / 방향키 이동  ·  SPACE 줍기');
      }
    }
    function interact(){
      if(!active()||scene.runGarden.holding)return false;
      if(carried){
        const id=cell();
        if(carried.kind==='item'){
          if(!scene.heroWeaponPreview?.install(carried.id,carried.level,hero().center,installationLife))return false;
        }else if(canPlant(id)){
          if(!scene.runGarden.plantCarried(id,carried.name))return false;
        }else{
          if(scene.runGarden.occupied.has(id))return false;
          const p=hero().center,card=scene.runDrops.spawn('flower',p.x,p.y,carried.name,1,{putDown:true});card.age=carried.age;
        }
        carried=null;render();return true;
      }
      if(scene.fairyFlowerbeds?.confirm(cell())){render();return true;}
      const card=nearest(scene.runDrops.drops.values(),hero().center);
      if(!card)return false;
      carried=card.kind==='flower'?{kind:'flower',name:card.spriteName,age:card.age}:{kind:'item',id:card.id,level:card.item.level,name:card.item.name,texture:card.item.texture,age:card.age};
      setHighlight(null);scene.runDrops.consume(card);card.marker.disableInteractive().setVisible(false);
      render();return true;
    }
    function keydown(e){
      if(!active()||/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName||''))return;
      if(moveKeys.has(e.code)){e.preventDefault();keys.add(e.code);return;}
      if(e.code==='Space'){e.preventDefault();if(!e.repeat)interact();}
    }
    function keyup(e){keys.delete(e.code);}
    function clear(){keys.clear();}
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);
    scene.events.on('pause',clear);scene.events.on('update',render);
    scene.events.once('shutdown',()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);scene.events.off('pause',clear);scene.events.off('update',render);clear();delete scene.flowerCarry;});
    const controller={movement,interact,get carried(){return carried?{...carried}:null;},get target(){return target;},get nearby(){return highlighted;}};
    scene.flowerCarry=controller;render();return controller;
  }
  window.GardenFlowerCarry=Object.freeze({enabled,speedBonus,pickupRadius,slotLimit,installationLife,isInstallation,carryable,automatic,fifoSlot,installationCell,installationSafe,step,nearest,attach});
}());
