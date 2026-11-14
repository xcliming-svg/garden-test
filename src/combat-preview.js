(function () {
  'use strict';
  const tuning=Object.freeze({walkSpeed:24,enemySpeed:38,stageSeconds:15,initialRate:0.8,
    rateStep:0.65,maxRate:6,maxEnemies:160,shotInterval:0.65,firstShot:0.4,
    bulletSpeed:300,bulletRadius:3,bulletLife:2.5,arrivalHold:2.5,pickupRange:48,maxDrops:120,
    flowerChance:0.25,cardChance:0.20});
  const spawnRate=t=>Math.min(tuning.maxRate,tuning.initialRate+Math.floor(t/tuning.stageSeconds)*tuning.rateStep);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  // Segment versus moving enemy, evaluated in relative space (no tunnelling).
  function hitTime(ax,ay,bx,by,r){
    const dx=bx-ax,dy=by-ay,A=dx*dx+dy*dy,C=ax*ax+ay*ay-r*r;
    if(C<=0)return 0;
    if(A===0)return Infinity;
    const B=2*(ax*dx+ay*dy),D=B*B-4*A*C;
    if(D<0)return Infinity;
    const t=(-B-Math.sqrt(D))/(2*A);
    return t>=0&&t<=1?t:Infinity;
  }
  function initialGarden(spec){
    const g=spec.garden;
    return new Set(new URLSearchParams(window.location.search).get('full')==='1'
      ? Array.from({length:g.columns*g.rows},(_,i)=>i) : [44,45,54,55]);
  }
  function create(spec,initialBounds,patrolPosition,nearestPatrolDistance){
    const g=spec.garden, cx=g.x+g.size/2,cy=g.y+g.size/2;
    const fieldBottom=spec.height-spec.bottom;
    let bounds=initialBounds,joining=false;
    let seed=0x4b1d3a17,serial=0,dropId=0,bulletId=0,credit=0.85,nextShot=tuning.firstShot;
    let patrolDistance=(bounds.right-bounds.left)/2;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const state={elapsed:0,kills:0,spawned:0,arrived:0,volleys:0,shotsFired:0,gems:0,ballCount:1,
      guardian:patrolPosition(bounds,patrolDistance),enemies:[],bullets:[],drops:[],deaths:[],stage:1,rate:spawnRate(0),lastVolley:[]};
    const occupied=initialGarden(spec);
    const equipped=new Set();
    function target(){
      const keys=[...occupied],i=keys[Math.floor(random()*keys.length)];
      return {x:g.x+(i%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2};
    }
    function spawn(){
      const side=serial%4,margin=16;
      let x,y;
      if(side===0||side===2){x=serial===0?state.guardian.x:margin+random()*(spec.width-2*margin);y=side===0?spec.top-margin:fieldBottom+margin;}
      else{x=side===1?spec.width+margin:-margin;y=spec.top+margin+random()*(spec.fieldHeight-2*margin);}
      const p=target();
      state.enemies.push({id:serial++,x,y,tx:p.x,ty:p.y,flip:p.x>x,speed:tuning.enemySpeed*(0.88+random()*0.24),hold:0,side});
      state.spawned++;
    }
    function addDrop(e){
      const r=random(),kind=r<tuning.flowerChance?'flower':r<tuning.flowerChance+tuning.cardChance?'card':'gem';
      const name=kind==='flower'?['daisy','tulip','sunflower','hydrangea'][Math.floor(random()*4)]:kind;
      // Never put draggable loot underneath the HUD or the blueprint.
      const half=kind==='card'?16:kind==='flower'?12:4;
      let x=clamp(e.x,half,spec.width-half),y=clamp(e.y,spec.top+half,fieldBottom-half);
      const b=spec.blueprint;
      if(b&&x-half<b.x+b.width&&y-half<b.y+b.height)x=b.x+b.width+half+4;
      if(state.drops.length>=tuning.maxDrops){
        const i=state.drops.findIndex(d=>d.kind==='gem'&&!d.dragging);
        if(i>=0)state.drops.splice(i,1);else return;
      }
      state.drops.push({id:dropId++,kind,name,x,y,dragging:false});
    }
    function fire(){
      const p=state.guardian;
      let nearest=null,dist=Infinity;
      for(const e of state.enemies){
        if(e.x<0||e.x>spec.width||e.y<spec.top||e.y>fieldBottom)continue;
        const d=Math.hypot(e.x-p.x,e.y-p.y);
        if(d<dist){nearest=e;dist=d;}
      }
      // No idle shots when the field is empty; first direction targets nearest enemy.
      if(!nearest)return;
      const angle=Math.atan2(nearest.y-p.y,nearest.x-p.x);
      const n=state.ballCount;state.lastVolley=[];
      for(let i=0;i<n;i++){
        const a=angle+i*2*Math.PI/n, vx=Math.cos(a)*tuning.bulletSpeed,vy=Math.sin(a)*tuning.bulletSpeed;
        state.bullets.push({id:bulletId++,x:p.x,y:p.y,vx,vy,age:0});
        state.lastVolley.push({vx,vy});
      }
      state.volleys++;state.shotsFired+=n;
    }
    function step(dt){
      state.elapsed+=dt;state.stage=1+Math.floor(state.elapsed/tuning.stageSeconds);state.rate=spawnRate(state.elapsed);
      let travel=dt*tuning.walkSpeed;
      if(joining){
        const p=patrolPosition(bounds,patrolDistance),dx=p.x-state.guardian.x,dy=p.y-state.guardian.y,d=Math.hypot(dx,dy);
        if(d>travel){state.guardian={x:state.guardian.x+dx*travel/d,y:state.guardian.y+dy*travel/d};travel=0;}
        else{travel-=d;joining=false;state.guardian=p;}
      }
      if(!joining){patrolDistance+=travel;state.guardian=patrolPosition(bounds,patrolDistance);}
      credit=Math.min(2,credit+dt*state.rate);
      while(credit>=1&&state.enemies.length<tuning.maxEnemies){credit--;spawn();}
      while(state.elapsed>=nextShot){fire();nextShot+=tuning.shotInterval;}
      for(const e of state.enemies){
        e.oldX=e.x;e.oldY=e.y;
        const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy);
        if(d>0.01){const s=Math.min(d,e.speed*dt);e.x+=dx*s/d;e.y+=dy*s/d;e.hold=0;}else e.hold+=dt;
      }
      for(const b of state.bullets){
        const x=b.x,y=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;
        let hit=null,earliest=Infinity;
        for(const e of state.enemies){
          if(e.dead||e.x<0||e.x>spec.width||e.y<spec.top||e.y>fieldBottom)continue;
          const t=hitTime(x-e.oldX,y-e.oldY,b.x-e.x,b.y-e.y,tuning.bulletRadius+10);
          if(t<earliest){hit=e;earliest=t;}
        }
        if(hit){hit.dead=true;b.dead=true;state.kills++;addDrop(hit);state.deaths.push({x:hit.x,y:hit.y,age:0});}
        if(b.age>=tuning.bulletLife||b.x<0||b.x>spec.width||b.y<spec.top||b.y>fieldBottom)b.dead=true;
      }
      for(const e of state.enemies)if(!e.dead&&e.hold>=tuning.arrivalHold){e.dead=true;state.arrived++;}
      state.enemies=state.enemies.filter(e=>!e.dead);state.bullets=state.bullets.filter(b=>!b.dead);
      state.drops=state.drops.filter(d=>{
        if(d.kind==='gem'&&Math.hypot(d.x-state.guardian.x,d.y-state.guardian.y)<=tuning.pickupRange){state.gems++;return false;}
        return true;
      });
      for(const d of state.deaths)d.age+=dt;state.deaths=state.deaths.filter(d=>d.age<0.16);
    }
    function advance(seconds){let left=Math.max(0,seconds);while(left>1e-8){const dt=Math.min(left,1/30);step(dt);left-=dt;}return state;}
    function plant(id,index,newBounds){
      const d=state.drops.find(d=>d.id===id&&d.kind==='flower');
      if(!d||!Number.isInteger(index)||index<0||index>=g.columns*g.rows||occupied.has(index))return false;
      const col=index%g.columns,row=Math.floor(index/g.columns);
      if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>col+dx>=0&&col+dx<g.columns&&row+dy>=0&&row+dy<g.rows&&occupied.has((row+dy)*g.columns+col+dx)))return false;
      occupied.add(index);state.drops=state.drops.filter(d=>d.id!==id);
      if(newBounds){
        bounds=newBounds;patrolDistance=nearestPatrolDistance(bounds,state.guardian.x,state.guardian.y);
        // Re-anchor on the expanded outside path, keeping the guardian clear of
        // the occupied garden and aligned with the displayed patrol route.
        state.guardian=patrolPosition(bounds,patrolDistance);joining=false;
      }
      return true;
    }
    function equip(id,index){
      if(!Number.isInteger(index)||index<0||index>=spec.slots.preview||equipped.has(index)||!state.drops.some(d=>d.id===id&&d.kind==='card'))return false;
      equipped.add(index);state.ballCount=1+equipped.size;state.drops=state.drops.filter(d=>d.id!==id);return true;
    }
    return {state,advance,plant,equip,occupied,equipped};
  }
  function attach(scene,spec,bounds,patrolPosition,guardian,enemyKey,enemySize,updateHud,loot,animateGuardian=null){
    const model=create(spec,bounds,patrolPosition,window.GardenGameLayout.nearestPatrolDistance),P=window.GardenPalette.n;
    const actors=new Map(),bullets=new Map();
    const maskShape=scene.make.graphics({x:0,y:0,add:false});
    maskShape.fillStyle(0xffffff,1).fillRect(0,spec.top,spec.width,spec.fieldHeight);
    const mask=maskShape.createGeometryMask();
    const fx=scene.add.graphics().setDepth(3).setName('combat-preview-hits').setMask(mask);
    function render(){
      const s=model.state;guardian.setPosition(s.guardian.x,s.guardian.y);
      if(animateGuardian)animateGuardian(s);
      const alive=new Set();
      for(const e of s.enemies){
        alive.add(e.id);
        if(!actors.has(e.id))actors.set(e.id,scene.add.image(e.x,e.y,enemyKey).setDisplaySize(enemySize,enemySize)
          .setFlipX(e.flip).setDepth(2).setMask(mask).setName('placeholder:enemy:caterpillar:'+e.id));
        actors.get(e.id).setPosition(e.x,e.y);
      }
      for(const [id,o] of actors)if(!alive.has(id)){o.destroy();actors.delete(id);}
      const ids=new Set();
      for(const b of s.bullets){
        ids.add(b.id);
        if(!bullets.has(b.id))bullets.set(b.id,scene.add.image(b.x,b.y,'combat:ball').setDepth(3).setMask(mask).setName('combat-ball:'+b.id));
        bullets.get(b.id).setPosition(b.x,b.y);
      }
      for(const [id,o] of bullets)if(!ids.has(id)){o.destroy();bullets.delete(id);}
      fx.clear();
      for(const d of s.deaths){const a=1-d.age/0.16;fx.fillStyle(P.gold,a).fillRect(d.x-2,d.y-2,4,4);}
      loot.sync(s.drops,model);
      updateHud(s.elapsed,s.kills,s.gems,model.occupied.size);
    }
    function advance(seconds){model.advance(seconds);render();return model.state;}
    const update=(_time,delta)=>advance(Math.min(0.1,Math.max(0,delta/1000)));
    const controller={advance,state:model.state,tuning,model};
    scene.combatPreview=controller;
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{
      scene.events.off('update',update);
      for(const o of [...actors.values(),...bullets.values()])if(o.scene)o.clearMask();
      if(fx.scene)fx.clearMask();mask.destroy();maskShape.destroy();actors.clear();bullets.clear();
      delete scene.combatPreview;
    });
    render();return controller;
  }
  window.GardenCombatPreview=Object.freeze({tuning,spawnRate,create,attach,hitTime,initialGarden});
}());
