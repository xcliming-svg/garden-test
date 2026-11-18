import {readFileSync} from 'node:fs';
function runAudit(sources){
  const w={location:{search:''}},doc={documentElement:{dataset:{playable:'true'}}};
  for(const f of ['run-rules','palette','fairy-patrol','enemy-motion','pebble-boundary','fairy-attack','enemy-preview','weapon-balance','flower-growth','item-cards','hero-weapon-preview','relic-collection']){
    new Function('window','document','URLSearchParams',sources[f])(w,doc,URLSearchParams);
  }
  const R=w.GardenRunRules,E=w.GardenEnemyPreview,M=w.GardenEnemyMotion,B=w.GardenPebbleBoundary,A=w.GardenHeroWeaponPreview,L=w.GardenRelicCollection,V=w.GardenWeaponBalance;
  let checks=0;const check=(v,msg)=>{checks++;if(!v)throw Error(msg);};
  const r=R.create();
  check(r.state.slotCount===4&&r.state.gems===0&&R.tuning.starterRock==='rock','initial run');
  check(!r.buy(),'insufficient gems');
  r.credit(500);
  for(const price of R.tuning.costs){
    const before=r.state.gems,shown=r.state.displayGems;
    check(R.cost(r.state.slotCount)===price&&r.buy(),'buy next slot');
    check(r.state.gems===before-price&&r.state.displayGems===shown,'immediate charge, animated display');
    let prev=r.state.displayGems;
    for(let i=0;i<20;i++){r.tick(.05);check(r.state.displayGems<=prev&&r.state.displayGems>=r.state.gems,'descending balance');prev=r.state.displayGems;}
    check(r.state.displayGems===r.state.gems,'settled balance');
  }
  check(r.state.slotCount===10&&R.cost(10)===null&&!r.buy(),'max slots');
  check(R.stageAt(0)===1&&R.stageAt(7.99)===1&&R.stageAt(8)===2&&R.stageAt(16-1e-9)===3&&R.stageAt(16)===3&&R.stageAt(200)===3,'monotonic growth');
  check(R.completion(new Map())===0,'empty blueprint');
  const garden=new Map(R.initial.map(([i,name])=>[i,{name,stage:3}]));
  check(R.completion(garden)===25,'initial 4 of 16');
  for(const [i,name] of R.blueprint)garden.set(i,{name,stage:3});
  check(R.completion(garden)===100,'complete blueprint');
  garden.get(33).stage=2;check(R.completion(garden)===93,'immature not complete');garden.get(33).stage=3;
  garden.set(33,{name:'sunflower',stage:3});check(R.completion(garden)===93,'wrong flower not complete');
  const spec={width:960,height:540,top:32,bottom:44,blueprint:{x:8,y:39,width:93,height:116},garden:{x:364,y:148,columns:10,rows:10,cell:22,line:1,pitch:23,outer:24,size:231}};
  const g=spec.garden;
  const rect={left:g.x+3*g.pitch,right:g.x+6*g.pitch+g.outer,top:g.y+3*g.pitch,bottom:g.y+6*g.pitch+g.outer};
  const boundary=B.layout(spec,rect,40,{frequency:1.6,lift:.5,tilt:1.25,lean:.5},1);
  const patrol={boundary,occupied:[44,45,54,55],finished:false};
  // Opening is time-gated, not an initial shuffle of the complete roster.
  check(R.eligibleEnemies(179.99).join(',')==='3_caterpillar','caterpillar only for three minutes');
  check(R.eligibleEnemies(180).join(',')==='3_caterpillar,4_beetle','first unlock');
  check(R.population(0)===3&&R.population(29.99)===3&&R.population(30)===4&&R.population(60)===4&&R.population(120)===7&&R.population(180)===6&&R.population(3600)===65,'wave concurrent cap');
  check(R.spawnInterval(0)===3&&R.spawnInterval(30)===2.5&&R.spawnInterval(179)===2&&R.spawnInterval(180)===3&&R.spawnInterval(1560)===1.2,'wave cadence');
  const live=E.createPopulation(spec,patrol,E.roster,()=>.37,R.population,null,true);
  live.advance(0);check(live.actors.length===1,'first spawn immediate');
  live.advance(2.99);check(live.actors.length===1,'no spawn burst');
  live.advance(.01);check(live.actors.length===2,'second enemy at 3s');
  live.advance(3);check(live.actors.length===3,'third enemy at 6s');
  live.advance(23.99);check(live.actors.length===3,'opening cap without kills');
  live.advance(.01);check(live.actors.length===4,'fourth enemy at 30s');
  const opening=E.createPopulation(spec,patrol,E.roster,()=>.37,R.population,null,true);
  const seen=new Set();let lastSpawn=-Infinity,lastCount=0;
  for(let t=0;t<=1600;t++){
    opening.advance(t===0?0:1);
    check(opening.actors.length<=R.population(t+1e-6),'concurrent cap');
    if(opening.spawned!==lastCount){
      const at=opening.actors[0].spawnTime;
      check(opening.spawned-lastCount<=R.waveAt(at).batch,'batch limit');
      check(at-lastSpawn+1e-6>=R.spawnInterval(lastSpawn),'spawn spacing');
      lastCount=opening.spawned;lastSpawn=at;
    }
    for(const a of [...opening.actors]){
      check(R.waveAt(a.spawnTime).pool.some(([id])=>id===a.entry.id)&&R.eligibleEnemies(t+1e-6).includes(a.entry.id),'active wave species only');
      check(a.hp===V.hp(a.entry),'existing enemy HP unchanged');
      check(M.speed(a.entry,0)===M.profiles[a.entry.id].baseSpeed,'minimum enemy speed');
      seen.add(a.entry.id);opening.damage(a.id,999);
    }
  }
  check(seen.size===12,'all species eventually introduced');
  check(w.GardenFairyPatrol.speed===40&&w.GardenFairyPatrol.speedAt(40,0,80)===40&&w.GardenFairyPatrol.speedAt(40,5,80)===80,'minimum fairy speed');
  // Preserve the original equipment and economy. Only pace random item drops.
  const drops=R.create();
  check(drops.rewardDrop(()=>.99)==='item','first random item permitted');
  check(drops.rewardDrop(()=>.99)==='gem','same instant item converted to gem');
  check(drops.rewardDrop(()=>.85)==='flower'&&drops.rewardDrop(()=>.70)==='heart','protect flower and heart supply');
  drops.credit(500);check(drops.buy()&&drops.state.gems===485,'unchanged slot purchase');
  check(!('xp' in drops.state)&&!('level' in drops.state)&&!('pendingGrowth' in drops.state),'no additional growth system');
  drops.tick(29.99);check(drops.rewardDrop(()=>.99)==='gem','no early payout');drops.tick(.01);
  check(drops.rewardDrop(()=>.1)==='gem'&&drops.rewardDrop(()=>.99)==='item','only random item at cooldown boundary');
  const unlucky=R.create();unlucky.tick(120);check(unlucky.rewardDrop(()=>.1)==='gem','no forced rewards');
  check(R.itemPool(0).join(',')==='rock,boomerang,shoe,shield'&&R.itemPool(540).length===13,'item unlocks');
  for(const at of [0,90,180,300,420,540])for(let n=0;n<100;n++)check(R.itemPool(at).includes(R.pickItem(at,()=>n/100)),'random item only from active pool');
  // A lowering cap cannot destroy already living enemies.
  const retained=E.createPopulation(spec,patrol,E.roster,()=>.37,R.population,null,true);
  retained.advance(179);const oldIds=retained.actors.map(a=>a.id);
  retained.advance(2);check(oldIds.every(id=>retained.actors.some(a=>a.id===id)),'wave transition keeps survivors');
  check(R.waves.every(w=>w.pool.every(([id])=>R.eligibleEnemies(w.start).includes(id))&&w.cap<=R.tuning.spawnCap),'wave unlock and cap consistency');
  const placed=[];
  for(const size of [24,32])for(let x=0;x<=960;x+=24)for(let y=0;y<=540;y+=24){
    const p=R.cardPosition(spec,x,y,size,placed.slice(-8)),h=size/2;
    check(!!p,'legal drop exists');
    check(p.x-h>=0&&p.x+h<=spec.width&&p.y-h-4>=spec.top&&p.y+h<=spec.height-spec.bottom,'card in field');
    for(const z of [{x:g.x,y:g.y,width:g.size,height:g.size},spec.blueprint])check(p.x+h<=z.x-5||p.x-h>=z.x+z.width+5||p.y+h<=z.y-5||p.y-h-4>=z.y+z.height+5,'no overlap of card footprint');
    placed.push({...p,size});
  }
  const D=R.depth;check(D.flower<D.enemy&&D.enemy+1<=D.fairy&&D.fairy+1<D.projectile&&D.effects<D.relic&&D.relic<D.card&&D.card<D.blueprint&&D.blueprintInput<D.hud&&D.hud<D.slotFrame&&D.slotFrame<D.equipped&&D.purchase<D.drag&&D.drag<D.tooltip,'layer order');
  const counts={gem:0,heart:0,flower:0,item:0};
  for(let i=0;i<1000;i++){
    const rand=()=> (i+.5)/1000,model=L.create(spec,rand);
    const card=model.death(700,250,boundary.patrol);
    const kind=card?.kind??model.state.drops[0]?.kind;
    check(model.state.drops.length+(card?1:0)===1,'exactly one death drop');
    counts[kind]++;
  }
  check(counts.gem===640&&counts.heart===150&&counts.flower===180&&counts.item===30,'exclusive base distribution');
  {
    const m=L.create(spec,()=>.70),p={x:boundary.patrol.right,y:(boundary.patrol.top+boundary.patrol.bottom)/2};
    const frame={bounds:boundary.patrol,length:boundary.length,speed:40};
    const advance=t=>{for(let left=t;left>1e-8;left-=.05)m.step(Math.min(.05,left),p,frame);};
    m.syncFlowers([44,45,54,55]);m.death(p.x,p.y,frame.bounds);
    const first=m.state.drops[0];advance(2);
    check(m.weakest()===null&&m.state.hearts===0&&m.state.drops[0]===first&&!first.attracted&&first.x===p.x&&first.y===p.y,'full garden heart waits');
    m.damageFlower(44,35);m.damageFlower(45,10);advance(3);
    check(m.state.hearts===1&&m.state.flowers.get(44).energy===85&&m.state.flowers.get(45).energy===90,'heart heals weakest once damage exists');
    m.syncFlowers([]);m.syncFlowers([44,45]);m.damageFlower(44,100);
    m.death(p.x,p.y,frame.bounds);advance(2);
    check(m.state.hearts===1&&m.state.drops.length===1&&!m.state.drops[0].attracted,'dead flowers cannot consume');
    m.damageFlower(45,10);advance(.3);check(m.state.drops[0].attracted,'damaged living flower attracts');
    m.syncFlowers([44,55]);advance(.5);
    check(m.state.hearts===1&&m.state.drops.length===1&&!m.state.drops[0].attracted&&m.state.drops[0].speed===0,'target removed during flight cancels pickup');
    m.damageFlower(55,5);advance(3);check(m.state.hearts===2&&m.state.flowers.get(55).energy===100,'heart can reacquire living damaged flower, capped');
    m.death(p.x,p.y,frame.bounds);advance(30);check(m.state.drops.length===0&&m.state.expired===1&&m.state.hearts===2,'unused heart expires normally');
    m.syncFlowers([44,45]);m.state.flowers.get(44).energy=100;m.damageFlower(45,5);
    m.death(p.x,p.y,frame.bounds);m.death(p.x,p.y,frame.bounds);advance(3);
    check(m.state.hearts===3&&m.state.drops.length===1&&!m.state.drops[0].attracted,'second heart waits when first restores all living flowers');
  }
  for(const entry of E.roster){
    patrol.occupied=[44,45,54,55];
    let deaths=0;const p=E.createPopulation(spec,patrol,[entry],()=>.33,()=>1,()=>deaths++,true);
    p.advance(0);const first=p.actors[0],id=first.id;
    const travel=M.travelTime(entry,first.path,0),period=M.duration(entry,'attack',first.path);
    p.advance(travel+period*4+.1);
    check(p.actors.length===1&&p.actors[0].id===id&&p.completed===0,'persistent '+entry.id);
    check(first.pendingHits>=4,'repeat strikes '+entry.id);
    check(first.hp===V.hp(entry),'v1 HP retained');
    const predicted=V.target(first).predict(period*3);
    check(predicted.phase!=='return'&&Math.hypot(predicted.x-first.path.originX,predicted.ground-first.path.originY)<16&&Number.isFinite(predicted.attackIn),'persistent prediction');
    check(first.pose.phase!=='return'&&Math.hypot(first.pose.x-first.path.originX,first.pose.ground-first.path.originY)<=16,'stays at flower');
    const old=first.path.flower;patrol.occupied=patrol.occupied.filter(i=>i!==old);const pos={x:first.pose.x,y:first.pose.ground};
    p.advance(.05);
    check(first.path.flower!==old&&patrol.occupied.includes(first.path.flower),'retarget live flower');
    check(Math.hypot(first.pose.x-pos.x,first.pose.ground-pos.y)<10,'retarget without teleport');
    check(p.damage(id,99).killed&&deaths===1&&p.kills===1&&p.actors.length===0,'only death removes');
  }
  const hero={index:0,type:'garden',direction:'right',center:{x:480,y:200}},water={index:1,type:'water',direction:'right',center:{x:470,y:210}};
  const weapon=A.create(spec,Math.random,A.defaultSize,true),target=[{id:1,x:480,y:100,ground:110,lift:0,radius:10,hp:100,phase:'move'}];
  patrol.bounds=boundary.patrol;
  check(weapon.equip(0,R.tuning.starterRock),'starter rock equipped');
  let hits=0;for(let i=0;i<100;i++)weapon.step(.05,hero,target,()=>{hits++;return {killed:false};},null,patrol,null,[water]);
  check(hits>0&&weapon.state.fired>0,'starter auto attack');
  check(weapon.state.shots.every(s=>s.owner===0||s.owner===1&&s.kind==='rock'),'water rock only');
  check(weapon.equip(9,'wheel'),'tenth slot weapon');
  check(!weapon.equip(10,'rock'),'reject eleventh slot');
  weapon.step(.05,hero,target,()=>({killed:false}),null,patrol);
  check(weapon.state.shots.every(s=>s.owner===0),'removed companion stops attacks');
  return {checks,counts};
}
const files=['run-rules','palette','fairy-patrol','enemy-motion','pebble-boundary','fairy-attack','enemy-preview','weapon-balance','flower-growth','item-cards','hero-weapon-preview','relic-collection'];
const sources=Object.fromEntries(files.map(f=>[f,readFileSync('src/'+f+'.js','utf8')]));
console.log('PASS playable run',runAudit(sources));
