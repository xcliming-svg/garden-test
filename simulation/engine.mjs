import {rng} from './models.mjs';

// This runner composes the actual production models. The Phaser scene runner is
// the reference for timing/input/raster geometry; this is the fast model path.
export function createEngine(w,{seed=1,dt=1/60,maxSeconds=1800,trace=false,geometry=null,research=null}={}) {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('seed must be uint32');
  if(!Number.isFinite(dt)||dt<=0||dt>.1)throw Error('dt must be in (0,.1]');
  if(!Number.isFinite(maxSeconds)||maxSeconds<=0||maxSeconds>7200)throw Error('maxSeconds must be in (0,7200]');
  const R=w.GardenRunRules,F=w.GardenFairyPatrol,E=w.GardenEnemyPreview,A=w.GardenHeroWeaponPreview,
    L=w.GardenRelicCollection,I=w.GardenItemCards,B=w.GardenWeaponBalance,G=w.GardenGameLayout;
  const progression=research?.progression??'none';
  if(!['none','duplicate','timed-drop'].includes(progression))throw Error('Invalid research progression');
  const levelCap=research?.levelCap??3;
  if(!Number.isInteger(levelCap)||levelCap<1||levelCap>3)throw Error('Invalid research levelCap');
  const levelTimes=research?.levelTimes??[180,360];
  if(levelTimes.length!==2||!levelTimes.every(Number.isFinite)||levelTimes[0]<0||levelTimes[1]<=levelTimes[0])throw Error('Invalid levelTimes');
  const spec=G.spec,entries=new Map(R.initial.map(([cell,name])=>[cell,{name,born:0,stage:3,mature:true}]));
  const occupied=new Set(entries.keys()),required=new Map(R.blueprint),cards=new Map(),gear=Array(R.tuning.maxSlots).fill(null);
  const streams=Object.fromEntries(['enemy','weapon','drop','flower','item','agent'].map(k=>[k,rng(seed,k)]));
  const log=[],timeline=[],actions=[],counts={},byWeapon={},byEnemy={},byItem={},cardStats={},byFormation={};
  let t=0,serial=0,drag=null,hold=null,finished=null,peak=0,peakComplete=0,lastProgress=0,lastChoice=0,lastOpportunity=0,maxOpportunityGap=0,maxProgressGap=0,maxChoiceGap=0,firstKill=null,firstUsableFlower=null,firstItem=null,lastCellAt=null,lastSample=-1,damage=0,heal=0,overheal=0,prevented=0,flowersLost=0,wrongPlaced=0,purchases=0,regressions=0,offeredSeconds=0;
  const inc=(obj,k,n=1)=>obj[k]=(obj[k]||0)+n;
  const bucket=(obj,k)=>obj[k]||(obj[k]={});
  function emit(type,data={}){
    inc(counts,type);
    if(type==='weapon_fire'||type==='weapon_hit'||type==='weapon_slow'||type==='weapon_push'){
      const s=bucket(byWeapon,data.weapon);inc(s,type);
      if(type==='weapon_hit'){inc(s,'damage',data.effective);inc(s,'overkill',data.amount-data.effective);if(data.killed)inc(s,'kills');}
    }
    if(type==='flower_damage')damage+=data.effective;
    if(type==='flower_heal'){heal+=data.effective;overheal+=data.amount-data.effective;}
    if(type==='formation_spawn'){byFormation[data.group]={...data,kills:0};}
    if(type==='enemy_kill'&&data.formation!==null&&data.formation!==undefined&&byFormation[data.formation])byFormation[data.formation].kills++;
    if(type==='enemy_spawn'||type==='enemy_kill'||type==='enemy_attack')inc(bucket(byEnemy,data.species),type,data.count||1);
    if(type==='card_spawn'||type==='card_expire'||type==='card_use'){
      const s=bucket(cardStats,data.kind);inc(s,type);
      if(data.reason)inc(s,data.reason);
      if(data.kind==='item')inc(bucket(byItem,data.name),type);
    }
    if(trace)log.push({t:Number(t.toFixed(6)),type,...data});
  }
  const run=R.create(emit),relic=L.create(spec,streams.drop,run.rewardDrop,emit);
  relic.syncFlowers(occupied);
  function computeBoundary(){
    return w.GardenPebbleBoundary.layout(spec,w.GardenDashedGridPreview.geometry(spec,occupied,0,0).garden,w.GardenFlowerHeadPreview.guardianSize,F.gait,activeCount);
  }
  let activeCount=1,currentSpeed=F.speed,boundary=computeBoundary(),distance=(boundary.patrol.right-boundary.patrol.left)/2,signature=[...occupied].sort((a,b)=>a-b).join(','),actors=[];
  function renderPatrol(){
    const next=[...occupied].sort((a,b)=>a-b).join(',');
    if(occupied.size&&next!==signature){
      signature=next;const fraction=((distance%boundary.length)+boundary.length)%boundary.length/boundary.length;
      boundary=computeBoundary();distance=fraction*boundary.length;
    }
    const ratio=geometry?.waterHeightRatio??502/716;
    actors=Array.from({length:activeCount},(_,index)=>{
      const d=distance+index*boundary.length/activeCount,p=G.patrolPosition(boundary.patrol,d),q=G.patrolPosition(boundary.patrol,d+.01);
      const dx=q.x-p.x,dy=q.y-p.y;
      return {index,type:index?'water':'garden',center:p,visibleHeight:boundary.height*(index?ratio:1),direction:Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up'};
    });
  }
  const patrol={get occupied(){return [...occupied]},get boundary(){return boundary},get bounds(){return boundary.patrol},get length(){return boundary.length},get speed(){return currentSpeed},get actors(){return actors},get finished(){return !!finished}};
  renderPatrol();
  const measure=geometry?((id,span)=>{
    const p=geometry.weapons[id];if(!p)throw Error('Missing measured weapon '+id);
    return {width:p.width*span,height:p.height*span,...(p.pivot?{pivot:p.pivot,nozzles:p.nozzles.map(n=>({x:n.x*span,y:n.y*span}))}:{})};
  }):A.defaultSize;
  const weapon=A.create(spec,streams.weapon,measure,true,emit);
  function equip(slot,item){
    gear[slot]=item;weapon.equip(slot,item.id,item.level);
    const stats=G.sumPreviewStats(gear);
    currentSpeed=Math.max(F.speed,Math.min(F.maxSpeed,stats.moveSpeed));
    const n=Math.min(F.count,1+gear.filter(i=>i?.id==='water-fairy').length);
    if(n!==activeCount){activeCount=n;signature='';renderPatrol();}
  }
  equip(0,I.runItemData(R.tuning.starterRock));
  // Model-only counterfactual; no weapon-level rule is enabled in the actual game.
  function leveled(name,level=1){
    const item=I.runItemData(name);
    return level>1&&B.data[name]?{...item,level,stats:{...item.stats,dps:B.nominalDps(name,level)}}:item;
  }
  function cardItem(c,slot){
    const old=gear[slot],level=progression==='duplicate'&&B.data[c.name]&&old?.id===c.name?Math.min(levelCap,(old.level||1)+1):c.level||1;
    return leveled(c.name,level);
  }
  if(research?.fixedLoadout){
    // Controlled combat fixture, never a player-accessible starting inventory.
    if(!Array.isArray(research.fixedLoadout)||research.fixedLoadout.length!==run.state.slotCount)throw Error('fixedLoadout must fill unlocked slots');
    research.fixedLoadout.forEach((id,slot)=>equip(slot,leveled(id)));
    if(!gear.some(i=>i?.stats.dps>0))throw Error('fixedLoadout needs damage');
  }
  function candidates(name,correctOnly=false){
    return [...R.plantCandidates(occupied)].filter(i=>!correctOnly||required.get(i)===name);
  }
  function cardReason(c){
    if(c.kind==='flower'){
      if(candidates(c.name,true).length)return 'usable';
      if(R.blueprint.some(([id,name])=>name===c.name&&entries.get(id)?.name!==name))return 'connection_blocked';
      return 'not_needed';
    }
    const item=I.runItemData(c.name);
    if(gear.slice(0,run.state.slotCount).some((_,i)=>R.canEquip(gear,i,item)))return 'equippable';
    return 'no_valid_slot';
  }
  function spawnCard(kind,x,y){
    const name=kind==='flower'?R.chooseFlower(entries,streams.flower):R.pickItem(run.state.elapsed,streams.item);
    const size=G.assets[kind].dropSize;
    const p=R.cardPosition(spec,x,y,size,[...cards.values()]);
    if(!p)throw Error('No legal card position');
    const level=kind==='item'&&progression==='timed-drop'&&B.data[name]?Math.min(levelCap,1+levelTimes.filter(at=>t>=at).length):1;
    const c={id:serial++,kind,name,level,x:p.x,y:p.y,size,age:0,born:t,everUsable:false};
    cards.set(c.id,c);const reason=cardReason(c);c.everUsable=reason==='usable'||reason==='equippable';
    if(kind==='flower'&&reason==='usable'&&firstUsableFlower===null)firstUsableFlower=t;
    if(kind==='item'&&firstItem===null)firstItem=t;
    emit('card_spawn',{id:c.id,kind,name,level:c.level,x:c.x,y:c.y,reason});return c;
  }
  const roster=E.roster.map(e=>geometry?{...e,...geometry.enemies[e.id]}:e);
  const pop=E.createPopulation(spec,patrol,roster,streams.enemy,R.population,(x,y,e)=>{
    if(firstKill===null)firstKill=t;
    emit('enemy_kill',{id:e.id,species:e.entry.id,formation:e.formation,lifetime:pop.elapsed-e.spawnTime,x,y});
    const c=relic.death(x,y,boundary.patrol);if(c)spawnCard(c.kind,x,y);
  },true,emit);
  const spawned=new Set();
  function logSpawns(){
    for(const e of pop.actors)if(!spawned.has(e.id)){spawned.add(e.id);emit('enemy_spawn',{id:e.id,species:e.entry.id,hp:e.hp,formation:e.formation,side:e.path.side,x:e.pose.x,y:e.pose.ground,wave:R.waveAt(pop.elapsed).start});}
  }
  pop.advance(0);logSpawns();
  function progress(){
    return [...required.keys()].filter(id=>R.blueprintStatus(entries,id)==='complete').length;
  }
  let lastComplete=progress();peakComplete=lastComplete;
  function remove(cell,cause){
    if(!occupied.delete(cell))return false;
    const f=entries.get(cell);entries.delete(cell);
    if(hold?.cell===cell)hold=null;
    if(cause==='enemy')flowersLost++;
    emit('flower_remove',{cell,name:f.name,stage:f.stage,cause});
    return true;
  }
  function actionResult(a,ok,reason){
    actions.push({t:Number(t.toFixed(6)),...a,ok,reason:reason??null});
    emit(ok?'action':'action_reject',{action:a,reason:reason??null});
    return ok;
  }
  function dispatch(a){
    if(!a||typeof a.type!=='string')throw Error('Invalid action');
    if(finished)return actionResult(a,false,'finished');
    if(a.type==='WAIT')return true;
    if(a.type==='DRAG_START'){
      if(drag||hold||!cards.has(a.cardId))return actionResult(a,false,'busy_or_missing_card');
      drag={cardId:a.cardId};return actionResult(a,true);
    }
    if(a.type==='DRAG_CANCEL'){
      if(!drag)return actionResult(a,false,'not_dragging');
      drag=null;return actionResult(a,true);
    }
    if(a.type==='DRAG_END'){
      if(!drag)return actionResult(a,false,'not_dragging');
      const c=cards.get(drag.cardId);drag=null;
      if(!c)return actionResult(a,false,'missing_card');
      if(c.kind==='flower'){
        if(!R.canPlant(occupied,entries,a.cell,c.name))return actionResult(a,false,'invalid_cell');
        occupied.add(a.cell);entries.set(a.cell,{name:c.name,born:run.state.elapsed,stage:1,mature:false});
        relic.syncFlowers(occupied);
        const correct=required.get(a.cell)===c.name;if(!correct)wrongPlaced++;
        emit('flower_plant',{cell:a.cell,name:c.name,correct});
        if(correct){lastProgress=t;lastChoice=t;}
      }else{
        if(!Number.isInteger(a.slot)||a.slot<0||a.slot>=run.state.slotCount)return actionResult(a,false,'locked_slot');
        const item=cardItem(c,a.slot);if(!R.canEquip(gear,a.slot,item))return actionResult(a,false,'last_damage_weapon');
        const prev=gear[a.slot]?.id??null,previousLevel=gear[a.slot]?.level??null;
        equip(a.slot,item);emit('item_equip',{slot:a.slot,previous:prev,previousLevel,name:item.id,level:item.level,stats:G.sumPreviewStats(gear)});lastChoice=t;
      }
      cards.delete(c.id);emit('card_use',{id:c.id,kind:c.kind,name:c.name,age:c.age});return actionResult(a,true);
    }
    if(a.type==='BUY_SLOT'){
      if(hold||drag)return actionResult(a,false,'busy');
      const price=R.cost(run.state.slotCount);if(!run.buy())return actionResult(a,false,'unaffordable_or_max');
      purchases++;lastChoice=t;emit('slot_purchase',{price,gems:run.state.gems,slots:run.state.slotCount});return actionResult(a,true);
    }
    if(a.type==='UPROOT_START'){
      if(hold||drag||!occupied.has(a.cell))return actionResult(a,false,'busy_or_missing_flower');
      hold={cell:a.cell,elapsed:0};return actionResult(a,true);
    }
    if(a.type==='UPROOT_CANCEL'){
      if(!hold)return actionResult(a,false,'not_holding');
      hold=null;return actionResult(a,true);
    }
    return actionResult(a,false,'unknown_action');
  }
  function observe(){
    const stats=G.sumPreviewStats(gear);
    return {time:t,finished,blueprint:R.blueprint.map(([cell,name])=>({cell,name,status:R.blueprintStatus(entries,cell)})),
      flowers:[...entries].map(([cell,f])=>({cell,name:f.name,stage:f.stage,healthBand:Math.ceil(3*(relic.state.flowers.get(cell)?.energy??0)/L.tuning.maxEnergy)})),
      cards:[...cards.values()].map(c=>({id:c.id,kind:c.kind,name:c.name,x:c.x,y:c.y,age:c.age,validCells:c.kind==='flower'?candidates(c.name):[],matchingCells:c.kind==='flower'?candidates(c.name,true):[],item:c.kind==='item'?leveled(c.name,c.level):null,...(research&&c.kind==='item'?{slotItems:gear.slice(0,run.state.slotCount).map((_,i)=>cardItem(c,i))}:{})})),
      gear:gear.slice(0,run.state.slotCount).map(i=>i?{id:i.id,level:i.level,stats:{...i.stats}}:null),stats,
      slotCount:run.state.slotCount,price:R.cost(run.state.slotCount),gems:run.state.gems,drag:drag?{...drag}:null,hold:hold?{...hold}:null,
      enemies:pop.actors.length,requiredCount:required.size,completed:progress(),patrolLength:boundary.length};
  }
  function snapshot(){
    const energies=[...relic.state.flowers.values()].filter(f=>occupied.has(f.id)).map(f=>f.energy).sort((a,b)=>a-b);
    const n=energies.length,kills=pop.kills;
    return {time:Number(t.toFixed(6)),completed:progress(),required:required.size,flowers:n,stageCounts:[1,2,3].map(s=>[...entries.values()].filter(f=>f.stage===s).length),
      wrong:[...entries.keys()].filter(id=>R.blueprintStatus(entries,id)==='wrong').length,
      minEnergy:n?energies[0]:0,meanEnergy:n?energies.reduce((a,b)=>a+b,0)/n:0,p25Energy:n?energies[Math.floor((n-1)*.25)]:0,
      enemies:pop.actors.length,attacking:pop.actors.filter(e=>['windup','strike','recover','ready'].includes(e.pose.phase)).length,
      enemyHp:pop.actors.reduce((a,e)=>a+e.hp,0),kills,spawned:pop.spawned,damage:weapon.state.damage,shots:weapon.state.fired,hits:weapon.state.hits,
      flowerDamage:damage,flowerHeal:heal,gear:gear.map(i=>i?.id??null),gearLevels:gear.map(i=>i?.level??null),gems:run.state.gems,slots:run.state.slotCount,patrolLength:boundary.length,fairies:activeCount,speed:currentSpeed,
      cards:cards.size,usableCards:[...cards.values()].filter(c=>['usable','equippable'].includes(cardReason(c))).length,
      lastProgressGap:t-lastProgress,lastChoiceGap:t-lastChoice};
  }
  function step(seconds=dt){
    if(finished)return;
    if(!Number.isFinite(seconds)||seconds<=0||seconds>.1)throw Error('invalid step');
    seconds=Math.min(seconds,maxSeconds-t);if(seconds<=1e-10){finished='timeout';return;}
    t+=seconds;
    // Preserve the production scene listener order: patrol -> enemy and relic
    // substeps -> equipped weapons -> hold -> run clock and card expiry.
    distance=(distance+seconds*currentSpeed)%boundary.length;renderPatrol();
    let left=seconds;
    while(left>1e-8){
      const step=Math.min(left,w.GardenFairyAttack.tuning.step);left-=step;
      pop.advance(step);logSpawns();relic.syncFlowers(occupied);
      const defense=G.sumPreviewStats(gear).defense;
      for(const e of pop.actors)if(e.pendingHits){
        const n=e.pendingHits,d=R.damageToFlower(e.entry,defense),raw=R.damageToFlower(e.entry,0);
        prevented+=(raw-d)*n;emit('enemy_attack',{id:e.id,species:e.entry.id,cell:e.path.flower,count:n,amount:d*n,prevented:(raw-d)*n});
        relic.damageFlower(e.path.flower,d*n);e.pendingHits=0;
      }
      for(const [id,f] of relic.state.flowers)if(f.energy<=0)remove(id,'enemy');
      if(!occupied.size)break;
      relic.syncFlowers(occupied);
      const prev=relic.state.gems;relic.step(step,actors[0].center,patrol);
      if(relic.state.gems>prev)run.credit(relic.state.gems-prev);
    }
    weapon.step(seconds,actors[0],pop.actors.map(B.target),pop.damage,pop.slow,patrol,pop.push,actors.slice(1));
    if(hold){hold.elapsed+=seconds;if(hold.elapsed+1e-7>=R.tuning.uprootSeconds){const id=hold.cell;hold=null;remove(id,'uproot');relic.syncFlowers(occupied);}}
    run.tick(seconds);
    for(const [cell,f] of entries){
      const old=f.stage;f.stage=f.mature?3:R.stageAt(run.state.elapsed-f.born);
      if(f.stage!==old)emit('flower_grow',{cell,name:f.name,stage:f.stage});
    }
    let offered=false;
    for(const c of cards.values()){
      const reason=cardReason(c);if(reason==='usable'||reason==='equippable'){offered=true;c.everUsable=true;}
      if(c.kind==='flower'&&reason==='usable'&&firstUsableFlower===null)firstUsableFlower=t;
      if(drag?.cardId===c.id)continue;
      c.age+=seconds;
      if(c.age+1e-9>=R.tuning.cardLifetime){
        cards.delete(c.id);emit('card_expire',{id:c.id,kind:c.kind,name:c.name,reason,everUsable:c.everUsable});
      }
    }
    if(offered||R.cost(run.state.slotCount)!==null&&run.state.gems>=R.cost(run.state.slotCount)){offeredSeconds+=seconds;lastOpportunity=t;}
    maxOpportunityGap=Math.max(maxOpportunityGap,t-lastOpportunity);
    const complete=progress();
    if(complete>lastComplete){lastProgress=t;if(complete===required.size-1)lastCellAt=t;}
    if(complete<lastComplete)regressions+=lastComplete-complete;
    lastComplete=complete;peakComplete=Math.max(peakComplete,complete);peak=Math.max(peak,pop.actors.length);
    maxProgressGap=Math.max(maxProgressGap,t-lastProgress);maxChoiceGap=Math.max(maxChoiceGap,t-lastChoice);
    if(Math.floor(t+1e-7)>lastSample){lastSample=Math.floor(t+1e-7);timeline.push(snapshot());}
    if(!occupied.size)finished='defeat';else if(complete===required.size)finished='victory';else if(t+1e-8>=maxSeconds)finished='timeout';
    if(finished){relic.syncFlowers(occupied);run.state.result=finished;emit('run_end',{result:finished,completed:complete});}
  }
  function result(){
    const snap=snapshot(),seconds=t;
    return {seed,dt,maxSeconds,research,geometry:geometry?'measured':'fallback',result:finished??'running',seconds:Number(seconds.toFixed(6)),completed:snap.completed,required:required.size,progress:100*snap.completed/required.size,
      peakComplete,kills:pop.kills,spawned:pop.spawned,peakEnemies:peak,damage:weapon.state.damage,actualDps:seconds?weapon.state.damage/seconds:0,
      shots:weapon.state.fired,hits:weapon.state.hits,flowerDamage:damage,flowerHeal:heal,overheal,defensePrevented:prevented,flowersLost,wrongPlaced,regressions,
      gems:run.state.gems,gemPickups:relic.state.gems,hearts:relic.state.hearts,purchases,gear:snap.gear,gearLevels:snap.gearLevels,
      firstKill,firstUsableFlower,firstItem,maxProgressGap,maxChoiceGap,maxOpportunityGap,lastCellWait:lastCellAt===null?null:seconds-lastCellAt,offeredSeconds,
      counts,byWeapon,byEnemy,byItem,cardStats,byFormation,final:snap,actions,timeline,events:trace?log:undefined};
  }
  return {observe,dispatch,step,result,streams,get time(){return t},get finished(){return finished}};
}
