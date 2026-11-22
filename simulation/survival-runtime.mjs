// Current survival-only battle runner. The legacy stage/card simulator remains untouched.
// Real enemy, weapon, relic, economy, wave and patrol functions are evaluated unchanged.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './io.mjs';
import {rng} from './models.mjs';

export const SURVIVAL_SCHEMA=1;
// Same event reducer is injected into the real-browser reference. Unknown IDs
// create new entries automatically; no weapon/enemy ID is hard-coded here.
export function tallySurvivalEvent(book,type,data={}){
  book.events[type]=(book.events[type]||0)+1;
  if(type.startsWith('weapon_')&&data.weapon){
    const w=book.weapons[data.weapon]||(book.weapons[data.weapon]={
      fired:0,hits:0,effectiveDamage:0,kills:0,slows:0,pushes:0});
    if(type==='weapon_fire')w.fired++;
    if(type==='weapon_hit'){
      w.hits++;w.effectiveDamage+=data.effective||0;
      if(data.killed)w.kills++;
    }
    if(type==='weapon_slow')w.slows++;
    if(type==='weapon_push')w.pushes++;
  }
  if(type==='survival_enemy_spawn'||type==='survival_enemy_kill'){
    const e=book.enemies[data.enemy]||(book.enemies[data.enemy]={
      spawned:0,killed:0,totalSpawnHp:0,totalKillLifetime:0});
    if(type==='survival_enemy_spawn'){e.spawned++;e.totalSpawnHp+=data.hp;}
    else {e.killed++;e.totalKillLifetime+=data.life;}
  }
}
// Source order is derived from the actual playable HTML, not legacy simulation/models.mjs.
// Future production modules join automatically when their <script> is added to index.html.
export const PROFILES=Object.freeze({
  idle:{id:'idle',interval:.25,water:false,expand:false,shop:false},
  focused:{id:'focused',interval:.25,water:true,expand:true,shop:true},
  casual:{id:'casual',interval:2,water:true,expand:true,shop:true},
  distracted:{id:'distracted',interval:8,water:true,expand:true,shop:true}
});
const sha256=()=>createHash('sha256');
export function readSurvivalSources(){
  const html=readFileSync(join(root,'index.html'),'utf8');
  const order=[...html.matchAll(/<script src="\.\/src\/([^"]+)\.js"><\/script>/g)]
    .map(m=>m[1]).filter(id=>id!=='main'&&id!=='scenes');
  if(!order.length||order[0]!=='run-rules'||!order.includes('garden-economy')||
    order.indexOf('run-rules')>order.indexOf('garden-economy')||new Set(order).size!==order.length)
    throw Error('Invalid live survival script load order');
  const sources=Object.fromEntries(order.map(id=>[id,readFileSync(join(root,'src',id+'.js'),'utf8')]));
  const sha=sha256();
  for(const [id,source] of Object.entries(sources))sha.update(id).update('\0').update(source).update('\0');
  for(const file of ['index.html','src/scenes.js','src/main.js','simulation/models.mjs',
    'simulation/io.mjs','simulation/survival-runtime.mjs','simulation/survival-browser.mjs',
    'simulation/survival-cli.mjs','simulation/survival-batch.mjs']){
    sha.update(file).update('\0').update(readFileSync(join(root,file))).update('\0');
  }
  const asset=sha256();
  function walk(dir){
    for(const name of readdirSync(dir).sort()){
      const p=join(dir,name);
      if(statSync(p).isDirectory())walk(p);
      else if(/\.(svg|json)$/i.test(name))asset.update(p.slice(root.length)).update('\0').update(readFileSync(p));
    }
  }
  walk(join(root,'assets'));
  return {sources,sourceHash:sha.digest('hex'),assetHash:asset.digest('hex')};
}
export function createSurvivalWindow(sources,seed,event=()=>{}){
  const w={location:{search:''},GardenSimulationEvent:event};
  const doc={documentElement:{dataset:{playable:'true'}},title:'Garden Survivors headless'};
  w.GardenSimulationRng=Object.fromEntries(['enemy','drop','flower','weapon','item','agent'].map(id=>[id,rng(seed,id)]));
  for(const id of Object.keys(sources)){
    if(typeof sources[id]!=='string')throw Error('Missing current survival source '+id);
    new Function('window','document','URLSearchParams',sources[id])(w,doc,URLSearchParams);
  }
  if(!w.GardenRunRules.survival||!w.GardenEconomy.enabled||!w.GardenHeroWeaponPreview.combat)
    throw Error('Survival entry is not active; do not inject GardenSimulationConfig');
  validateSurvivalCatalog(w);
  return w;
}
export function validateSurvivalCatalog(w){
  const E=w.GardenEconomy,W=w.GardenHeroWeaponPreview,B=w.GardenWeaponBalance,M=w.GardenEnemyMotion,N=w.GardenEnemyPreview;
  const products=new Set(E.products.map(p=>p.id)),weapons=new Set(E.weapons),enemies=new Set(N.roster.map(e=>e.id));
  const unlocked=new Set(w.GardenRunRules.enemyUnlocks.map(([,id])=>id));
  if(products.size!==E.products.length||weapons.size!==E.weapons.length||enemies.size!==N.roster.length)
    throw Error('Duplicate product/weapon/enemy ID');
  if(!weapons.has('rock'))throw Error('Starter rock missing');
  for(const p of E.products){
    if(!E.upgradeLimits[p.id])throw Error('Missing upgrade limits '+p.id);
    if(p.weapon!==weapons.has(p.id))throw Error('Weapon classification mismatch '+p.id);
    if(p.id!=='rock'&&E.upgradeLimits[p.id].volley!==0)throw Error('Non-rock multishot forbidden: '+p.id);
    if(p.weapon&&(!W.ids.includes(p.id)||!W.tuning[p.id]||!B.stats(p.id,1)))
      throw Error('Weapon model/attack asset contract missing '+p.id);
  }
  for(const id of weapons)if(!products.has(id))throw Error('Orphan weapon '+id);
  for(const id of W.ids)if(!weapons.has(id))throw Error('Weapon missing from economy catalog '+id);
  if(unlocked.size!==w.GardenRunRules.enemyUnlocks.length)throw Error('Duplicate survival enemy unlock');
  for(const e of N.roster){
    if(!M.profiles[e.id]||!(B.hp(e)>0))throw Error('Enemy profile missing '+e.id);
    if(!unlocked.has(e.id))throw Error('Enemy missing survival unlock '+e.id);
  }
  for(const [,id] of w.GardenRunRules.enemyUnlocks)if(!enemies.has(id))throw Error('Unknown unlocked enemy '+id);
  const events=w.GardenSurvivalEvents;
  if(!events?.enabled)throw Error('Survival hostile event module missing');
  for(const [id,boss] of Object.entries(events.bosses)){
    if(!enemies.has(boss.enemy))throw Error('Boss species missing '+id);
    if(!(boss.speed>0&&boss.speed<w.GardenEnemyMotion.profiles[boss.enemy].baseSpeed))
      throw Error('Boss speed must be slower than species baseline '+id);
    if(!(boss.size>1&&boss.hpFactor>1))throw Error('Boss visibility / HP invalid '+id);
    for(const minion of boss.summons)if(!enemies.has(minion))throw Error('Boss minion missing '+id+'/'+minion);
  }
  for(const [id,event] of Object.entries(events.raids))
    for(const enemy of event.enemies)if(!enemies.has(enemy))throw Error('Raid species missing '+id+'/'+enemy);
  if(E.names.length!==4||E.tuning.waterCapacity!==100||E.tuning.waterPerDrop!==20||
    E.tuning.maxSide!==5)throw Error('Fixed four-bed MAX-water contract changed');
  for(let side=1;side<=5;side++)if(E.requiredAt(0,side)!==side||E.cellsForSide(side).length!==4*side*side)
    throw Error('Invalid bed growth contract '+side);
  return {weapons:[...weapons],enemies:[...enemies],products:[...products],
    unknownFutureSystems:['water-fairy']};
}
// Shared deterministic decision function. Injected unchanged in the browser reference.
export function selectSurvivalAction(economy,catalog,profile,nearest,watering){
  const state=economy.state;
  if(profile.water&&!watering&&state.water>=catalog.tuning.waterCapacity&&nearest>=0)
    return {kind:'water',plot:nearest};
  if(profile.expand&&economy.expansionCost()&&economy.affordable(economy.expansionCost())&&
    state.plots.every(p=>p.phase==='growing'))return {kind:'expand'};
  if(!profile.shop)return null;
  for(const p of catalog.products){
    if(state.owned.has(p.id)||!economy.available(p.id))continue;
    const price=economy.cost(p.id,'buy');
    if(price&&economy.affordable(price))return {kind:'buy',id:p.id};
  }
  for(const p of catalog.products){
    if(!state.owned.has(p.id))continue;
    for(const type of catalog.upgradeTypes(p.id)){
      const price=economy.cost(p.id,type);
      if(price&&economy.affordable(price))return {kind:'upgrade',id:p.id,type};
    }
  }
  return null;
}
export function validateOptions({seed=42,seconds=60,dt=.05,policy='idle'}={}){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('seed must be uint32');
  if(!Number.isFinite(seconds)||seconds<=0||seconds>10800)throw Error('seconds outside (0,10800]');
  if(!Number.isFinite(dt)||dt<.001||dt>.1)throw Error('dt outside [.001,.1]');
  if(!PROFILES[policy])throw Error('Unknown policy '+policy);
  return {seed,seconds,dt,policy};
}
export function makeHeadlessRun(options={},geometry=null,input=null){
  const opts=validateOptions(options),packageData=input||readSurvivalSources();
  const telemetry={events:Object.create(null),weapons:Object.create(null),enemies:Object.create(null)};
  const event=(type,data)=>tallySurvivalEvent(telemetry,type,data);
  const w=createSurvivalWindow(packageData.sources,opts.seed,event);
  const R=w.GardenRunRules,E=w.GardenEconomy,A=w.GardenEnemyPreview,B=w.GardenWeaponBalance,H=w.GardenHeroWeaponPreview;
  const F=w.GardenFairyPatrol,Rel=w.GardenRelicCollection,L=w.GardenGameLayout;
  const spec=L.spec,occ=new Set(R.initial.map(([id])=>id)),run=R.create(event),economy=E.create(w.GardenSimulationRng.flower,event);
  const data=geometry?.enemies;
  if(geometry&&(geometry.sourceHash!==packageData.sourceHash||geometry.assetHash!==packageData.assetHash))
    throw Error('Geometry fingerprint mismatch; capture live geometry again');
  if(geometry&&!data)throw Error('Missing measured enemy geometry');
  const entries=A.roster.map(e=>{
    const shape=data?.[e.id];
    if(geometry&&(!shape||!(shape.width>0)||!(shape.height>0)))throw Error('Missing enemy geometry '+e.id);
    return {...e,width:shape?.width||e.span,height:shape?.height||e.span};
  });
  const size=(id,span)=>{
    const measured=geometry?.weapons?.[id];
    if(geometry&&!measured)throw Error('Missing measured weapon '+id);
    return measured?{...measured,width:measured.width*span,height:measured.height*span,
      ...(measured.nozzles?{nozzles:measured.nozzles.map(p=>({x:p.x*span,y:p.y*span}))}:{})}:H.defaultSize(id,span);
  };
  let info,bounds,length,distance,pausedSeconds=0,clock=0,nextDecision=0;
  const hero={index:0,type:'garden',center:{x:0,y:0},direction:'right',visibleHeight:40};
  const patrol={actors:[hero],finished:false,get occupied(){return [...occ];},
    get boundary(){return info;},get bounds(){return bounds;},get length(){return length;},
    get speed(){return economy.speed();}};
  function resetBounds(){
    const hadLength=Number.isFinite(length)&&length>0;
    const progress=hadLength?((distance%length)+length)%length/length:0;
    const garden=w.GardenDashedGridPreview.geometry(spec,occ,0,0).garden;
    info=w.GardenPebbleBoundary.layout(spec,garden,w.GardenFlowerHeadPreview.guardianSize,F.gait,1);
    bounds=info.patrol;length=info.length;
    distance=hadLength?progress*length:(bounds.right-bounds.left)/2;
  }
  function move(dt){
    if(!pausedSeconds)distance=(distance+dt*economy.speed())%length;
    const p=L.patrolPosition(bounds,distance),q=L.patrolPosition(bounds,distance+.01);
    hero.center=p;hero.visibleHeight=info.height;
    const dx=q.x-p.x,dy=q.y-p.y;
    hero.direction=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';
  }
  resetBounds();move(0);
  const relic=Rel.create(spec,w.GardenSimulationRng.drop,run.rewardDrop,event,
    ()=>economy.state.water<E.tuning.waterCapacity-1e-7);
  relic.syncFlowers([...occ]);
  const enemy=A.createPopulation(spec,patrol,entries,w.GardenSimulationRng.enemy,R.population,
    (x,y)=>relic.death(x,y,patrol.bounds),true,event);
  enemy.advance(0);
  const weapon=H.create(spec,w.GardenSimulationRng.weapon,size,true,event,id=>economy.bonus(id));
  function syncWeapons(){
    E.weapons.forEach((id,i)=>{if(economy.state.owned.has(id))weapon.equip(i,id,economy.bonus(id).level);});
  }
  syncWeapons();
  const profile=PROFILES[opts.policy],actions=[],timeline=[];
  function nearest(){
    let best=-1,dist=Infinity;
    economy.state.plots.forEach((p,i)=>{
      if(p.phase!=='growing')return;
      const c={x:spec.garden.x+(5+(i%2===0?-economy.state.side/2:economy.state.side/2))*spec.garden.pitch+.5,
        y:spec.garden.y+(5+(i<2?-economy.state.side/2:economy.state.side/2))*spec.garden.pitch+.5};
      const d=(hero.center.x-c.x)**2+(hero.center.y-c.y)**2;
      if(d<dist){dist=d;best=i;}
    });
    return best;
  }
  function apply(action){
    let ok=false;
    if(action?.kind==='water'&&pausedSeconds<=0){
      ok=!!economy.water(action.plot);
      if(ok)pausedSeconds=E.tuning.wateringHoldSeconds;
    }else if(action?.kind==='expand'){
      ok=economy.expand();
      if(ok){for(const [id] of E.cellsForSide(economy.state.side))occ.add(id);resetBounds();move(0);}
    }else if(action?.kind==='buy'){
      ok=economy.purchase(action.id);
      if(ok)syncWeapons();
    }else if(action?.kind==='upgrade'){
      ok=economy.upgrade(action.id,action.type);
      if(ok)syncWeapons();
    }
    return ok;
  }
  function tick(dt){
    if(clock+1e-9>=nextDecision){
      const action=selectSurvivalAction(economy,E,profile,nearest(),pausedSeconds>0);
      if(action){const ok=apply(action);actions.push({time:Number(clock.toFixed(6)),...action,ok});}
      nextDecision+=profile.interval;
    }
    // Phaser listener order: patrol, economy/run, enemy+relic substeps, weapon.
    move(dt);
    run.tick(dt);economy.tick(dt);
    if(pausedSeconds>0)pausedSeconds=Math.max(0,pausedSeconds-dt);
    let left=dt;
    while(left>1e-8){
      const sub=Math.min(left,w.GardenFairyAttack.tuning.step);left-=sub;
      enemy.advance(sub);
      relic.syncFlowers([...occ]);
      let hits=0;
      for(const e of enemy.actors)if(e.pendingHits){hits+=e.pendingHits;e.pendingHits=0;}
      if(hits)economy.damage(hits,sub,economy.defense());
      const water=relic.state.water,hearts=relic.state.hearts;
      relic.step(sub,hero.center,{bounds:patrol.bounds,direction:hero.direction,length:patrol.length,speed:patrol.speed});
      if(relic.state.water>water)economy.gainWater((relic.state.water-water)*E.tuning.waterPerDrop);
      if(relic.state.hearts>hearts)economy.heal((relic.state.hearts-hearts)*E.tuning.heartRecovery);
    }
    weapon.step(dt,hero,enemy.actors.map(a=>B.target(a)),enemy.damage,enemy.slow,patrol,enemy.push,[]);
    clock+=dt;
  }
  function snapshot(){
    return {time:Number(clock.toFixed(6)),heroX:Number(hero.center.x.toFixed(6)),heroY:Number(hero.center.y.toFixed(6)),patrolDistance:Number(distance.toFixed(6)),patrolLength:Number(length.toFixed(6)),spawned:enemy.spawned,killed:enemy.kills,active:enemy.actors.length,
      shots:weapon.state.fired,hits:weapon.state.hits,waterDrops:relic.state.spawnedWater,
      waterCollected:relic.state.water,hearts:relic.state.hearts,expired:relic.state.expired,
      water:economy.state.water,gardenHp:Number(economy.state.hp.toFixed(6)),
      side:economy.state.side,harvested:economy.state.totalHarvested,
      plotStock:economy.state.plots.map(p=>p.count),
      equipped:E.weapons.filter(id=>economy.state.owned.has(id)),
      activeShots:weapon.state.shots.length,events:{...telemetry.events},
      weaponsById:structuredClone(telemetry.weapons),enemiesById:structuredClone(telemetry.enemies)};
  }
  function runTo(seconds=opts.seconds,samples=[0,300,600,1800,3600]){
    const snapshotTimes=[...new Set([0,...samples.filter(t=>t>0&&t<=seconds),seconds])].sort((a,b)=>a-b);
    let targetIndex=0;
    if(snapshotTimes[0]===0){timeline.push(snapshot());targetIndex++;}
    const steps=Math.round(seconds/opts.dt);
    if(Math.abs(steps*opts.dt-seconds)>1e-8)throw Error('seconds must be divisible by dt for deterministic parity');
    for(let i=0;i<steps&&economy.state.hp>0;i++){
      tick(opts.dt);
      while(targetIndex<snapshotTimes.length&&clock>=snapshotTimes[targetIndex]-1e-7){
        timeline.push(snapshot());targetIndex++;
      }
    }
    const outcome=economy.state.hp<=0?'defeat':'time_limit';
    return {schemaVersion:SURVIVAL_SCHEMA,mode:'survival-headless',parity:'unverified',
      sourceHash:packageData.sourceHash,assetHash:packageData.assetHash,
      sourceCommit:options.commit||null,seed:opts.seed,dt:opts.dt,seconds:opts.seconds,
      policy:profile,geometry:geometry?'browser-measured':'unmeasured-approximation',
      assumptions:['UI decisions are policy actions; no human timing or pointer errors',
        'No water-fairy behavior: absent from the current flower-economy game',
        'Same Phaser update listener order and combat substep; no rendering',
        'Unmeasured geometry is not browser-parity evidence'],
      catalog:validateSurvivalCatalog(w),outcome,final:snapshot(),timeline,actions,
      limitations:['Not a certified real-game survival estimate until browser parity at reference checkpoints',
        'Rendering cost, UI interaction quality and human play are not measured']};
  }
  return {world:w,run,economy,patrol,enemy,relic,weapon,actions,tick,snapshot,runTo};
}
