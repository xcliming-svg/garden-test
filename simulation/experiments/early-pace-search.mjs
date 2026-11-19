// Predeclared staged search; no changes to live defaults. Each map optimized separately.
import {parseArgs} from 'node:util';
import {loadModels,resolveConfig} from '../models.mjs';
import {createEngine} from '../engine.mjs';
import {play,profileFor} from '../agents.mjs';
import {distribution,summarize} from '../metrics.mjs';
import {sourceSet,fingerprints,saveJson,readJson,root,prepare} from '../io.mjs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const protocol=Object.freeze({
  maps:['classic','cross','heart'],targets:{classic:2,cross:2.5,heart:3},
  capGear:{classic:5,cross:6,heart:7},
  density:{intervals:[1.5,2,2.5],caps:[5,8,11],batches:[1,2],seed:1101,runs:3,horizon:60,keep:2},
  rewards:{flowers:[.09,.12,.15],items:[.04,.06,.08],cooldowns:[15,25],seed:2101,runs:3,keep:4},
  refine:{seed:3101,runs:6,keep:2},
  validate:{seed:4101,runs:16,agents:['beginner','normal','expert']},
  sensitivity:{seed:5101,runs:8,dt:.025},
  maxSeconds:600,dt:.05,
  gates:{winRateMin:.9,winRateLoss:.1,timeMin:.8,timeMax:1.2,timeP90Max:1.25,gapMax:1.15,firstItemMaxRatio:.65,densityMinRatio:1.5,slotsGain:1}
});
const round=x=>Math.round(x*10000)/10000;
const key=p=>p?JSON.stringify(p):'baseline';
export function configFor(w,map,p){
  const {initial,blueprint}=w.GardenRunRules.catalog.find(x=>x.id===map);
  if(!p)return {initial,blueprint};
  const waves=w.GardenRunRules.waves.map((x,i)=>{
    if(i>=6)return [x.start,x.interval,x.cap,x.batch,x.pool];
    const caps=[0,2,4,5,6,7],scales=[1,.9,.8,.8,.75,.7];
    return [x.start,round(Math.min(x.interval,p.interval*scales[i])),Math.max(x.cap,p.cap+caps[i]),Math.max(x.batch,p.batch),x.pool];
  });
  const run=p.flower===undefined?{}:{dropWeights:[round(.9-p.flower-p.item),.1,p.flower,p.item],itemInterval:p.cooldown};
  return {initial,blueprint,waves,run};
}
function evaluate(sources,w,map,p,{seed,runs,agent='normal',dt=protocol.dt,maxSeconds=protocol.maxSeconds,geometry=null}){
  const cfg=resolveConfig(w,configFor(w,map,p)),rows=[];
  for(let i=0;i<runs;i++){
    const r=play(createEngine(loadModels(sources,cfg),{seed:seed+i,dt,maxSeconds,geometry}),profileFor(agent));
    const early=r.timeline.filter(x=>x.time<=30),last=early.at(-1);
    const after=r.timeline.filter(x=>x.time<=60).at(-1);
    rows.push({seed:seed+i,result:r.result,seconds:r.seconds,kills:r.kills,firstItem:r.firstItem??r.seconds+1,missingItem:r.firstItem===null,
      firstKill:r.firstKill??r.seconds+1,maxProgressGap:r.maxProgressGap,flowersLost:r.flowersLost,
      peakEnemies:r.peakEnemies,filled:r.gear.filter(Boolean).length,distinct:new Set(r.gear.filter(Boolean)).size,
      alive30:early.reduce((a,x)=>a+x.enemies,0)/early.length,spawn30:last.spawned,kills30:last.kills,kills60:after.kills,
      damage:r.flowerDamage,progress:r.progress});
  }
  const d=k=>distribution(rows.map(r=>r[k])),s=summarize(rows);
  return {p,agent,runs,seed,dt,maxSeconds,wins:s.wins,defeats:s.defeats,timeouts:s.timeouts,winRate:s.winRate,winRate95:s.winRate95,
    missingItem:rows.filter(r=>r.missingItem).length,
    ...Object.fromEntries(['seconds','kills','firstItem','firstKill','maxProgressGap','flowersLost','peakEnemies','filled','distinct','alive30','spawn30','kills30','kills60','damage','progress'].map(k=>[k,d(k)])),rows};
}
const ratio=(a,b)=>a/Math.max(.001,b);
function densityScore(map,r,b){
  const target=protocol.targets[map],alive=ratio(r.alive30.p50,b.alive30.p50),kills=ratio(r.kills30.p50,b.kills30.p50);
  return Math.abs(alive-target)+.4*Math.abs(kills-target)+2*r.defeats+Math.max(0,r.firstKill.p50-b.firstKill.p50)*.1;
}
export function assess(map,r,b){
  const g=protocol.gates,t=ratio(r.seconds.p50,b.seconds.p50),t90=ratio(r.seconds.p90,b.seconds.p90),gap=ratio(r.maxProgressGap.p90,b.maxProgressGap.p90),
    item=ratio(r.firstItem.p50,b.firstItem.p50),alive=ratio(r.alive30.p50,b.alive30.p50),kills=ratio(r.kills30.p50,b.kills30.p50);
  const violations={
    survival:Math.max(0,g.winRateMin-r.winRate,b.winRate-g.winRateLoss-r.winRate),
    duration:Math.max(0,g.timeMin-t,t-g.timeMax,t90-g.timeP90Max),
    gap:Math.max(0,gap-g.gapMax),
    equipment:Math.max(0,item-g.firstItemMaxRatio,(b.filled.p50+g.slotsGain-r.filled.p50)/3,(r.filled.p50-protocol.capGear[map])/3),
    density:Math.max(0,g.densityMinRatio-alive,g.densityMinRatio-kills),
    missingItem:Math.max(0,r.missingItem/r.runs-.1)
  };
  const penalty=Object.values(violations).reduce((a,b)=>a+b,0);
  const score=100*penalty+Math.abs(t-1)+.3*Math.abs(alive-protocol.targets[map])+.15*Math.abs(kills-protocol.targets[map])+.2*item+.2*gap;
  return {pass:penalty<1e-9,score,violations,ratios:{duration:t,p90:t90,gap,item,alive,kills}};
}
const ordered=rows=>rows.sort((a,b)=>a.assessment.score-b.assessment.score||key(a.p).localeCompare(key(b.p)));
const small=r=>{const {rows,...x}=r;return x;};
export function searchPhase(sources,map,phase,previous=null,geometry=null){
  const w=loadModels(sources);if(!protocol.maps.includes(map))throw Error('Unknown map');
  const ev=(p,o)=>evaluate(sources,w,map,p,{...o,geometry});
  if(phase==='density'){
    const d=protocol.density,o={seed:d.seed,runs:d.runs,maxSeconds:d.horizon},base=ev(null,o),results=[];
    for(const interval of d.intervals)for(const cap of d.caps)for(const batch of d.batches){
      const p={interval,cap,batch},r=ev(p,o);results.push({...small(r),score:densityScore(map,r,base)});
    }
    results.sort((a,b)=>a.score-b.score||key(a.p).localeCompare(key(b.p)));
    return {map,phase,base:small(base),results,selected:results.slice(0,d.keep).map(r=>r.p),simulations:(results.length+1)*d.runs};
  }
  if(phase==='rewards'||phase==='refine'){
    const q=protocol[phase],o={seed:q.seed,runs:q.runs},base=ev(null,o),ps=[];
    if(phase==='rewards'){
      for(const p of previous.selected)for(const flower of q.flowers)for(const item of q.items)for(const cooldown of q.cooldowns)ps.push({...p,flower,item,cooldown});
    }else{
      for(const p of previous.selected){
        ps.push(p);
        for(const [field,delta] of [['flower',.01],['item',.01],['cooldown',5],['interval',.25],['cap',1]]){
          for(const sign of [-1,1])ps.push({...p,[field]:round(p[field]+sign*delta)});
        }
      }
    }
    const unique=[...new Map(ps.map(p=>[key(p),p])).values()];
    const results=ordered(unique.map(p=>{const r=ev(p,o);return {...small(r),assessment:assess(map,r,base)};}));
    return {map,phase,base:small(base),results,selected:results.slice(0,q.keep).map(r=>r.p),simulations:(results.length+1)*q.runs};
  }
  if(phase==='validate'||phase==='sensitivity'){
    const q=protocol[phase],agents=phase==='validate'?q.agents:['normal'],results=[],bases=[];
    for(const agent of agents){
      const o={seed:q.seed,runs:q.runs,agent,dt:q.dt??protocol.dt},base=ev(null,o);bases.push(base);
      for(const p of previous.selected){
        const r=ev(p,o);results.push({...r,assessment:assess(map,r,base)});
      }
    }
    const eligible=previous.selected.filter(p=>results.filter(r=>key(r.p)===key(p)).every(r=>r.assessment.pass));
    return {map,phase,bases,results,selected:eligible,simulations:(previous.selected.length+1)*q.runs*agents.length};
  }
  throw Error('Unknown phase');
}
export function digest(report){
  const compact=r=>({p:r.p,agent:r.agent,n:r.runs,wins:r.wins,defeats:r.defeats,time:r.seconds.p50,p90:r.seconds.p90,alive:r.alive30.p50,kills30:r.kills30.p50,kills60:r.kills60.p50,firstItem:r.firstItem.p50,gap90:r.maxProgressGap.p90,gear:r.filled.p50,peak:r.peakEnemies.p50,flowersLost:r.flowersLost.p90,score:r.assessment?.score??r.score,pass:r.assessment?.pass,violations:r.assessment?.violations});
  return {map:report.map,phase:report.phase,simulations:report.simulations,base:report.base?compact(report.base):report.bases.map(compact),top:report.results.slice(0,report.phase==='validate'||report.phase==='sensitivity'?100:5).map(compact),selected:report.selected,passing:report.results.filter(r=>r.assessment?.pass).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {values:o}=parseArgs({options:{map:{type:'string'},phase:{type:'string'},previous:{type:'string'},geometry:{type:'string'},output:{type:'string'}}});
  const geometry=o.geometry?readJson(o.geometry):null,p=prepare({},geometry);
  const report={schemaVersion:1,...fingerprints(p.sources),protocol,geometry:geometry?'measured':'fallback',...searchPhase(p.sources,o.map,o.phase,o.previous?readJson(o.previous):null,geometry)};
  console.log(JSON.stringify(digest(report),null,2));console.log(saveJson(o.output||join(root,'simulation','results','pace-'+o.map+'-'+o.phase+'-'+Date.now()+'.json'),report));
}
