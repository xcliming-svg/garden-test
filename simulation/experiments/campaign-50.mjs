// Isolated 50-stage research. Never loaded by index.html.
import {loadModels,resolveConfig,rng} from '../models.mjs';
import {createEngine} from '../engine.mjs';
import {play,profileFor} from '../agents.mjs';
import {distribution,summarize} from '../metrics.mjs';
import {prepare,readJson,saveJson,root,hash} from '../io.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const flowers=['daisy','sunflower','tulip','hydrangea','rose','lavender'];
export const enemies=[['3_caterpillar',1],['4_beetle',6],['2_gray_bug',9],['2_grasshopper',12],['1_butterfly',15],['1_cat',20],['2_frog',24],['6_sparrow',28],['6_mouse',33],['5_bulldog',38],['6_rabbit',42],['6_pigeon',46]];
export const ranges={
 rock:[[1,1],[5,10],[17,24]],boomerang:[[2,5],[10,16],[24,31]],'paper-plane':[[4,9],[13,20],[25,34]],
 'bouncy-ball':[[9,15],[20,28],[31,39]],balloon:[[11,17],[22,30],[33,41]],flowerpot:[[13,20],[23,32],[34,43]],
 wheel:[[15,22],[26,34],[37,45]],'yellow-floor':[[18,25],[28,37],[39,47]],sprinkler:[[24,31],[34,42],[43,49]],broom:[[26,33],[35,43],[44,49]],
 shoe:[[4,10]],shield:[[5,12]],'water-fairy':[[26,34]]
};
export const policies=['upgrade-first','variety-first','counter-first'];
export const anchors=[1,3,5,10,15,20,25,30,35,40,45,50];
export const protocol={screen:{seed:29101,runs:3,dt:.05,agent:'normal'},profile:{seed:29201,runs:3,dt:.05,seconds:45,stages:[3,15,30,45]},maxSeconds:720,goals:{winRate:.8,maxGap:100,minDuration:45,maxDuration:600,minNewDiscovery:.25},note:'Exploratory screening only; no claim of final values. New seed validation after tuning.'};
const round=x=>Math.round(x*10000)/10000;
function interp(n,points){for(let i=1;i<points.length;i++){const [b,y]=points[i],[a,x]=points[i-1];if(n<=b)return x+(y-x)*(n-a)/(b-a);}return points.at(-1)[1];}
const neigh=i=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[i%10+dx,Math.floor(i/10)+dy]).filter(([x,y])=>x>=0&&x<10&&y>=0&&y<10).map(([x,y])=>10*y+x);
export function layout(stage,count,pool){
  const random=rng(8000+stage,'shape'),cells=new Set([44,45,54,55]),shape=stage%5;
  // Stage 3 is precisely a central 4x4 square; other stages have connected
  // research masks, not finalized hand-authored campaign art.
  if(stage===3){for(let y=3;y<=6;y++)for(let x=3;x<=6;x++)cells.add(y*10+x);}
  else{
    const jitter=Array.from({length:100},()=>random()*.35);
    const rank=i=>{const x=Math.abs(i%10-4.5),y=Math.abs(Math.floor(i/10)-4.5);return [Math.max(x,y),x+y,Math.max(x*.6,y*1.4),Math.max(x*1.4,y*.6),Math.hypot(x,y)][shape]+jitter[i];};
    while(cells.size<count){const opts=[...new Set([...cells].flatMap(neigh))].filter(i=>!cells.has(i)).sort((a,b)=>rank(a)-rank(b)||a-b);cells.add(opts[0]);}
  }
  const ids=[...cells].sort((a,b)=>a-b);
  const blueprint=ids.map((i,k)=>[i,pool[(Math.floor(i/10)+i%10+Math.floor(k/7))%pool.length]]);
  // Ensure every unlocked flower occurs in the research blueprint.
  for(let i=0;i<pool.length;i++)blueprint[i][1]=pool[i];
  return {blueprint,initial:blueprint.filter(([i])=>[44,45,54,55].includes(i))};
}
export function unlocks(policy){
  if(!policies.includes(policy))throw Error('Unknown schedule');
  const rows=[];
  for(const [id,rs] of Object.entries(ranges))for(let i=0;i<rs.length;i++){
    const [lo,hi]=rs[i];let f=policy==='upgrade-first'?(i===0?.7:.12):policy==='variety-first'?(i===0?.12:.8):.5;
    if(policy==='counter-first'&&i===0&&['paper-plane','flowerpot','balloon','wheel'].includes(id))f=.12;
    if(policy==='counter-first'&&id==='water-fairy')f=.35;
    rows.push({id,level:i+1,stage:Math.round(lo+(hi-lo)*f)});
  }
  return rows.sort((a,b)=>a.stage-b.stage||a.id.localeCompare(b.id)||a.level-b.level);
}
export function makeStage(stage){
  if(!Number.isInteger(stage)||stage<1||stage>50)throw Error('stage 1..50');
  const count=Math.round(interp(stage,[[1,8],[2,12],[3,16],[10,26],[20,40],[30,56],[40,72],[50,88]]));
  const pool=flowers.slice(0,1+[3,8,16,25,36].filter(n=>stage>=n).length);
  const {blueprint,initial}=layout(stage,count,pool);
  const maxSlots=Math.round(interp(stage,[[1,2],[3,4],[10,5],[20,6],[30,8],[40,9],[50,10]]));
  const initialSlots=Math.min(maxSlots,Math.round(interp(stage,[[1,2],[10,3],[25,4],[40,5],[50,6]])));
  const cap=Math.round(interp(stage,[[1,4],[3,8],[10,18],[20,35],[30,65],[40,110],[50,160]]));
  const interval=round(interp(stage,[[1,2],[3,1.25],[10,1],[25,.8],[50,.55]]));
  const batch=Math.min(cap,Math.round(interp(stage,[[1,1],[3,2],[10,2],[25,4],[50,8]])));
  const eligible=enemies.filter(([,at])=>at<=stage).map(([id])=>id);
  const wavePool=(i)=>eligible.map((id,j)=>[id,j===eligible.length-1?5:j>=eligible.length-3?3:1]).map(([id,w])=>[id,i===0&&id===eligible[0]?w+3:w]);
  const waves=[0,30,90,180,240,300,420].map((at,i)=>[at,round(interval*Math.max(.6,1-i*.065)),Math.min(200,Math.round(cap*(1+i*.12))),batch,wavePool(i)]);
  const formationTypes=['pack','line','ring','pincer'].slice(0,[4,7,12,20].filter(x=>stage>=x).length);
  const formations=formationTypes.length?[45,105,175,255,345].map((at,i)=>{
    const kind=formationTypes[i%formationTypes.length];
    const id=kind==='ring'&&eligible.includes('2_grasshopper')?'2_grasshopper':kind==='pack'&&eligible.includes('1_butterfly')?'1_butterfly':eligible[(eligible.length-1+i)%eligible.length];
    return [at,kind,id,Math.min(waves.findLast(w=>w[0]<=at)[2],Math.max(3,Math.round(cap*(.35+i*.03))))];
  }):[];
  const itemRate=round(interp(stage,[[1,.04],[3,.04],[15,.055],[30,.07],[50,.085]]));
  const flowerRate=round(interp(stage,[[1,.10],[3,.065],[10,.05],[20,.035],[35,.025],[50,.02]]));
  const cooldown=Math.round(interp(stage,[[1,35],[3,35],[15,25],[30,18],[50,12]]));
  const itemCap=Math.round(interp(stage,[[1,2],[3,3],[10,5],[20,8],[30,12],[50,18]]));
  return {stage,count,flowerPool:pool,blueprint,initial,eligible,formations,initialSlots,maxSlots,itemCap,cap,interval,batch,patch:{initial,blueprint,enemyUnlocks:eligible.map(id=>[0,id]),waves,run:{initialSlots,maxSlots,costs:Array.from({length:maxSlots-initialSlots},(_,i)=>Math.round(30+stage*.5+i*20)),spawnCap:200,dropWeights:[round(.9-flowerRate-itemRate),.1,flowerRate,itemRate],itemInterval:cooldown}}};
}
export function stageGear(stage,policy,mode='campaign-drop'){
  const cards=unlocks(policy).filter(x=>x.stage<=stage),levelCaps=Object.fromEntries(cards.map(c=>[c.id,Math.max(...cards.filter(x=>x.id===c.id).map(x=>x.level))]));
  const pool=cards.filter(c=>mode!=='campaign-duplicate'||c.level===1).map(c=>({...c,weight:(c.level===levelCaps[c.id]?4:1)*(stage-c.stage<=4?2:1)}));
  return {pool,levelCaps};
}
function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error('Campaign source hook changed: '+a);return s.replace(a,b);}
export function researchSources(sources,formationSource){
  const s={...sources,'enemy-preview':formationSource};
  let r=s['run-rules'];
  r=replaceOnce(r,'const pool=needed.length&&random()<tuning.neededFlowerBias?needed:window.GardenFlowerGrowth.names;','const pool=needed.length&&random()<tuning.neededFlowerBias?needed:(config.flowerPool||window.GardenFlowerGrowth.names);');
  r=replaceOnce(r,'flowerWeights,paceProfiles,','flowerWeights,formations:Object.freeze(config.formations||[]),paceProfiles,');
  s['run-rules']=r;return s;
}
export const rampProtocol={seed:29301,runs:3,dt:.05,stages:[20,25,30,35,40,45,50],variants:['gradual','fast']};
// A stage's full unlocked roster is eligible, but actual waves introduce its
// stronger members over the run. No forced equipment or guaranteed rewards.
export function rampStage(env,variant){
  if(!rampProtocol.variants.includes(variant))throw Error('Unknown ramp');
  const fast=variant==='fast',n=env.stage,full=env.cap,ids=env.eligible;
  const times=[0,30,60,100,150,210,280,360,460];
  const scales=fast?[.14,.22,.32,.48,.64,.8,1,1.12,1.2]:[.10,.16,.24,.35,.50,.65,.85,1,1.15];
  const waves=times.map((at,i)=>{
    const cap=Math.min(200,Math.max(i===0?6:8,Math.round(full*scales[i])));
    const count=Math.min(ids.length,Math.max(2,Math.ceil(ids.length*(i+1)/5)));
    const pool=ids.slice(0,count).map((id,j)=>[id,j===count-1?4:j===0?4:2]);
    // During startup low tier enemies and slower replacement give the starter
    // weapon time to earn the first random equipment cards.
    const batch=Math.min(cap,i===0?1:i<=2?2:Math.max(2,Math.round(env.batch*Math.min(1,(i+1)/6))));
    const interval=round(Math.max(env.interval, i===0?1.75:i===1?1.4:i===2?1.15:i===3?.95:.65));
    return [at,interval,cap,batch,pool];
  });
  const formations=env.formations.map(([at,kind,id,count],i)=>{
    const time=[75,145,225,315,415][i],wave=waves.findLast(w=>w[0]<=time),pool=wave[4].map(x=>x[0]);
    return [time,kind,pool.includes(id)?id:pool.at(-1),Math.min(count,Math.max(2,Math.round(wave[2]*.35)))];
  });
  return {...env,formations,patch:{...env.patch,waves}};
}
export function makeWorld(sources,stage,policy,mode='campaign-drop',overrides={},variant=null){
  const raw=makeStage(stage),env=variant?rampStage(raw,variant):raw,gear=stageGear(stage,policy,mode),w=loadModels(sources);
  const patch={...env.patch,...overrides,run:{...env.patch.run,...overrides.run},itemUnlocks:[[0,[...new Set(gear.pool.map(c=>c.id))]]]};
  const c=resolveConfig(w,patch);
  const model=loadModels(sources,{...c,flowerPool:env.flowerPool,formations:env.formations});
  const R=model.GardenRunRules;
  model.GardenRunRules=Object.freeze({...R,create(onEvent){
    let n=0;
    const run=R.create((type,data)=>onEvent?.(type,type==='drop_roll'&&data.kind==='item'&&n>=env.itemCap?{...data,kind:'gem',reason:'stage_item_cap'}:data));
    return {...run,rewardDrop(random){const kind=run.rewardDrop(random);if(kind!=='item')return kind;if(n>=env.itemCap)return 'gem';n++;return kind;}};
  }});
  return {model,env,gear};
}
export const lateProtocol={seed:29401,runs:3,dt:.05,stages:[45,50],variant:'gradual',treatments:['baseline','starter','attack-weight','both']};
export function applyLateTreatment(model,gear,treatment){
  if(!lateProtocol.treatments.includes(treatment))throw Error('Unknown treatment');
  const starterLevel=['starter','both'].includes(treatment)?gear.levelCaps.rock:1;
  const pool=gear.pool.map(c=>({...c,weight:c.weight*(['attack-weight','both'].includes(treatment)&&((model.GardenWeaponBalance.data[c.id]?.damage[0]??0)!==0||c.id==='water-fairy')?2:1)}));
  return {...gear,pool,starterLevel};
}
// Keep the same unlock schedule, wave ramp, drops and max slots while testing
// startup resources. Starter cards use only earlier unlocked eligible weapons;
// the current-stage unlock remains an actual discovery, not a guaranteed drop.
export const startProtocol={seed:29501,runs:4,dt:.05,stages:[3,10,20,30,40,45,50],policies:['counter-first'],variants:['one','open','level','two','half','full'],maxSeconds:720};
export function startOverrides(stage,variant){
  if(!startProtocol.variants.includes(variant))throw Error('Unknown start variant');
  const env=makeStage(stage),base=env.patch.run;
  const slots=variant==='one'?base.initialSlots:Math.min(base.maxSlots,base.initialSlots+1);
  return {run:{initialSlots:slots,costs:Array.from({length:base.maxSlots-slots},(_,i)=>Math.round(30+stage*.5+i*20))}};
}
export function startGear(model,gear,stage,variant,seed){
  const n=model.GardenRunRules.tuning.initialSlots;
  const count=['one','open','level'].includes(variant)?1:variant==='two'?Math.min(2,n):variant==='half'?Math.max(1,Math.ceil(n/2)):n;
  // Avoid granting the very latest unlock by default; level from prior stage.
  const old=gear.pool.filter(c=>c.stage<stage),random=rng(seed,'campaign-start');
  const rockLevel=Math.max(1,...old.filter(c=>c.id==='rock').map(c=>c.level));
  const cards=[{id:'rock',level:variant==='one'||variant==='open'?1:rockLevel}];
  const attack=old.filter(c=>model.GardenWeaponBalance.nominalDps(c.id,c.level)>0&&c.id!=='water-fairy');
  const choices=attack.length?attack:[{id:'rock',level:1}];
  // No forced order of dropped cards. Loadout is a controlled initial
  // condition, independently seeded; allow duplicates and lower levels.
  while(cards.length<count){const c=choices[Math.floor(random()*choices.length)];cards.push({id:c.id,level:c.level});}
  return cards;
}
export function runStage(sources,geometry,stage,policy,opts={}){
  const {seed=protocol.screen.seed,runs=protocol.screen.runs,dt=.05,agent='normal',mode='campaign-drop',maxSeconds=protocol.maxSeconds,variant=null,treatment=null,start=null}=opts;
  const rows=[];
  for(let i=0;i<runs;i++){
    const {model,env,gear}=makeWorld(sources,stage,policy,mode,start?startOverrides(stage,start):{},variant);
    const treated=treatment?applyLateTreatment(model,gear,treatment):gear;
    const startingGear=start?startGear(model,gear,stage,start,seed+i):null;
    const r=play(createEngine(model,{seed:seed+i,dt,maxSeconds,geometry,trace:true,research:{progression:mode,campaign:{...treated,itemCap:env.itemCap,...(startingGear?{startingGear}:{})}}}),profileFor(agent));
    const items=r.events.filter(e=>e.type==='card_spawn'&&e.kind==='item'),newCards=items.filter(e=>gear.pool.some(c=>c.id===e.name&&c.level===e.level&&stage-c.stage<=4));
    if(items.some(e=>!gear.pool.some(c=>c.id===e.name&&c.level===e.level))||items.length>env.itemCap)throw Error('Locked or excess item');
    if(r.events.some(e=>e.type==='card_spawn'&&e.kind==='flower'&&!env.flowerPool.includes(e.name)))throw Error('Locked flower');
    if(r.events.some(e=>e.type==='enemy_spawn'&&!env.eligible.includes(e.species)))throw Error('Locked enemy');
    if(r.events.some(e=>e.type==='item_equip'&&e.level>(gear.levelCaps[e.name]??1)))throw Error('Locked upgrade');
    const groups=r.events.filter(e=>e.type==='formation_spawn');
    rows.push({seed:seed+i,...(start?{startingGear,initialSlots:model.GardenRunRules.tuning.initialSlots,initialFlowers:model.GardenRunRules.initial.length}:{}),result:r.result,seconds:r.seconds,progress:r.progress,kills:r.kills,peakEnemies:r.peakEnemies,flowersLost:r.flowersLost,flowerDamage:r.flowerDamage,maxProgressGap:r.maxProgressGap,items:items.length,itemCards:items.map(e=>[e.name,e.level]),newFound:newCards.length>0,newCards:newCards.length,gear:r.gear,levels:r.gearLevels,filled:r.gear.filter(Boolean).length,formations:groups.reduce((a,e)=>a+e.count,0),requested:groups.reduce((a,e)=>a+e.requested,0),firstItem:r.firstItem});
  }
  const d=k=>distribution(rows.map(r=>r[k])),wins=rows.filter(r=>r.result==='victory').length,discovery=rows.filter(r=>r.newFound).length/runs;
  const metrics={wins,winRate:wins/runs,seconds:d('seconds'),kills:d('kills'),peak:d('peakEnemies'),gap:d('maxProgressGap'),items:d('items'),filled:d('filled'),flowersLost:d('flowersLost'),discovery,formations:d('formations'),requested:d('requested')};
  const g=protocol.goals,violations={survival:Math.max(0,g.winRate-metrics.winRate),gap:Math.max(0,metrics.gap.p90/g.maxGap-1),duration:Math.max(0,g.minDuration-metrics.seconds.p50,metrics.seconds.p50-g.maxDuration)/g.maxDuration,discovery:Math.max(0,g.minNewDiscovery-discovery)};
  // No recent unlock -> no new discovery gate at this representative stage.
  if(!stageGear(stage,policy,mode).pool.some(c=>stage-c.stage<=4))violations.discovery=0;
  return {stage,policy,mode,agent,seed,runs,dt,...(variant?{variant}:{}),...(treatment?{treatment}:{}),...(start?{start}:{}),metrics,violations,pass:Object.values(violations).every(x=>x===0),rows};
}
export function profileGear(sources,geometry,stage,card,{seed=protocol.profile.seed,runs=3,dt=.05}={}){
  const results=[];
  for(let i=0;i<runs;i++){
    const {model,env}=makeWorld(sources,stage,'counter-first','campaign-drop',{run:{initialSlots:2,maxSlots:2,costs:[]}});
    const r=play(createEngine(model,{seed:seed+i,dt,maxSeconds:protocol.profile.seconds,geometry,research:{fixedLoadout:[{id:'rock',level:1},card]}}),profileFor('idle'));
    results.push({seed:seed+i,seconds:r.seconds,result:r.result,kills:r.kills,damage:r.damage,flowerDamage:r.flowerDamage,flowersLost:r.flowersLost,peak:r.peakEnemies,heals:r.flowerHeal,gems:r.gemPickups,defense:r.defensePrevented});
  }
  const d=k=>distribution(results.map(r=>r[k]));return {stage,card,results,...Object.fromEntries(['kills','damage','flowerDamage','flowersLost','gems','defense','seconds'].map(k=>[k,d(k)]))};
}
export function dataset(){return {protocol,stages:Array.from({length:50},(_,i)=>makeStage(i+1)),schedules:Object.fromEntries(policies.map(p=>[p,unlocks(p)]))};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const p=prepare(),folder=join(root,'simulation','experiments'),geometry=readJson(join(folder,'stage-gear-geometry.json')),sources=researchSources(p.sources,readFileSync(join(folder,'campaign-formation-source.js'),'utf8'));
  const [mode,group,out]=process.argv.slice(2);let report;
  if(mode==='dataset')report=dataset();
  else if(mode==='screen'){const stage=Number(group);report={stage,reports:policies.map(policy=>runStage(sources,geometry,stage,policy))};}
  else if(mode==='ramp'){const stage=Number(group);report={stage,reports:rampProtocol.variants.flatMap(variant=>policies.map(policy=>runStage(sources,geometry,stage,policy,{...rampProtocol,variant})))};}
  else if(mode==='late'){const [stage,policy]=group.split(':');report={stage:Number(stage),policy,reports:lateProtocol.treatments.map(treatment=>runStage(sources,geometry,Number(stage),policy,{...lateProtocol,treatment}))};}
  else if(mode==='start'){const stage=Number(group);report={stage,reports:startProtocol.variants.map(start=>runStage(sources,geometry,stage,'counter-first',{...startProtocol,start,variant:stage>=20?'gradual':null}))};}
  else if(mode==='profile'){const stage=Number(group);report={stage,reports:unlocks('counter-first').map(({id,level})=>profileGear(sources,geometry,stage,{id,level})),baseline:profileGear(sources,geometry,stage,{id:'rock',level:1})};}
  else throw Error('Unknown campaign command');
  console.log('CAMPAIGN '+JSON.stringify(['screen','ramp','late','start'].includes(mode)?report.reports.map(r=>({stage:r.stage,policy:r.policy,variant:r.variant,treatment:r.treatment,start:r.start,pass:r.pass,metrics:r.metrics,violations:r.violations})):mode==='profile'?{stage:report.stage,profiles:report.reports.length}: {stages:report.stages.length}));
  saveJson(out,report);
}
