// Stage 2–3 research, no live source changes. The starter rock is NOT a drop.
import {loadModels,resolveConfig} from '../models.mjs';
import {createEngine} from '../engine.mjs';
import {play,profileFor} from '../agents.mjs';
import {distribution,summarize} from '../metrics.mjs';
import {prepare,readJson,saveJson,root} from '../io.mjs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export const stageProtocol={map:'classic',seed:16101,runs:5,dt:.05,maxSeconds:600,
  density:[{name:'m1',interval:1.25,cap:8,batch:2},{name:'m2',interval:1,cap:12,batch:2},{name:'m3',interval:.8,cap:16,batch:3}],
  itemRates:[.03,.05],cooldowns:[45,60],flower:.10,
  goals:{densityRatio:1.5,killRatio:1.3,winRate:.9,completionMin:.8,completionMax:1.35,gapRatio:1.2,itemMin:2,itemMax:4,gearMax:5},
  validation:{seed:17101,runs:16,agents:['beginner','normal','expert']},fine:{seed:18101,runs:12,dt:.025}};
const rounded=x=>Math.round(x*10000)/10000;
export function stagePatch(w,p){
  const R=w.GardenRunRules,{initial,blueprint}=R.catalog.find(x=>x.id===stageProtocol.map);
  const base=p===null;
  const v=base?{interval:1.5,cap:5,batch:1,rate:.08,cooldown:25,flower:.10}:p;
  const waves=R.waves.map((x,i)=>i>=6?[x.start,x.interval,x.cap,x.batch,x.pool]:
    [x.start,rounded(Math.min(x.interval,v.interval*[1,.9,.8,.8,.75,.7][i])),Math.max(x.cap,v.cap+[0,2,4,5,6,7][i]),Math.max(x.batch,v.batch),x.pool]);
  return {initial,blueprint,waves,run:{dropWeights:[rounded(.9-v.flower-v.rate),.10,v.flower,v.rate],itemInterval:v.cooldown},...(base?{}:{itemUnlocks:[[0,['rock','boomerang']]]})};
}
function world(sources,w,p,sequence,itemCap=null){
  const model=loadModels(sources,resolveConfig(w,stagePatch(w,p)));
  if(p&&(sequence||itemCap!==null)){
    const R=model.GardenRunRules,first=['rock','rock','boomerang'];let n=0;
    model.GardenRunRules=Object.freeze({...R,
      ...(sequence?{pickItem:(t,random)=>{const id=R.pickItem(t,random);return first[n++]??id;}}:{}),
      ...(itemCap!==null?{create(onEvent){
        let accepted=0;
        const run=R.create((type,data)=>onEvent?.(type,type==='drop_roll'&&data.kind==='item'&&accepted>=itemCap?{...data,kind:'gem',reason:'stage_item_cap'}:data));
        const rewardDrop=random=>{const kind=run.rewardDrop(random);if(kind!=='item')return kind;if(accepted>=itemCap)return 'gem';accepted++;return kind;};
        return {...run,rewardDrop};
      }}:{})});
  }
  return model;
}
export function evaluateStage(sources,geometry,p,{seed=stageProtocol.seed,runs=stageProtocol.runs,agent='normal',dt=.05,sequence=true,itemCap=null,maxSeconds=600}={}){
  const w=loadModels(sources),rows=[];
  for(let i=0;i<runs;i++){
    const r=play(createEngine(world(sources,w,p,sequence,itemCap),{seed:seed+i,dt,maxSeconds,geometry,trace:true}),profileFor(agent));
    const early=r.timeline.filter(x=>x.time<=60),sample=early.at(-1);
    const items=r.events.filter(e=>e.type==='card_spawn'&&e.kind==='item');
    const flowers=r.events.filter(e=>e.type==='card_spawn'&&e.kind==='flower');
    const alive=r.timeline.reduce((s,x)=>s+x.enemies,0)/r.timeline.length;
    rows.push({seed:seed+i,result:r.result,seconds:r.seconds,alive60:early.reduce((s,x)=>s+x.enemies,0)/early.length,
      alive,kills60:sample.kills,kills:r.kills,peak:r.peakEnemies,flowers:flowers.length,flowersPerMinute:flowers.length*60/r.seconds,
      items:items.length,itemNames:items.map(e=>e.name),itemTimes:items.map(e=>e.t),firstItem:r.firstItem,firstFlower:r.firstUsableFlower,
      thirdItem:items[2]?.t??null,gear:r.gear.filter(Boolean),filled:r.gear.filter(Boolean).length,gap:r.maxProgressGap,
      flowersLost:r.flowersLost,damage:r.flowerDamage,progress:r.progress});
  }
  const d=k=>distribution(rows.map(r=>r[k]));
  return {p,seed,runs,agent,dt,sequence,itemCap,wins:rows.filter(r=>r.result==='victory').length,defeats:rows.filter(r=>r.result==='defeat').length,
    ...Object.fromEntries(['seconds','alive60','alive','kills60','kills','peak','flowers','flowersPerMinute','items','firstItem','firstFlower','thirdItem','filled','gap','flowersLost','damage','progress'].map(k=>[k,d(k)])),thirdSeen:rows.filter(r=>r.thirdItem!==null).length,rows};
}
export function compareStage(r,b){
  const g=stageProtocol.goals,ratio=(k,q='p50')=>r[k][q]/Math.max(.001,b[k][q]);
  const ratios={density:ratio('alive60'),kills:ratio('kills60'),time:ratio('seconds'),gap:ratio('gap','p90'),flowerRate:ratio('flowersPerMinute')};
  const violations={density:Math.max(0,g.densityRatio-ratios.density),kills:Math.max(0,g.killRatio-ratios.kills),
    duration:Math.max(0,g.completionMin-ratios.time,ratios.time-g.completionMax),gap:Math.max(0,ratios.gap-g.gapRatio),
    gear:Math.max(0,g.itemMin-r.items.p50,r.items.p50-g.itemMax,r.filled.p50-g.gearMax)/3,
    survival:Math.max(0,g.winRate-r.wins/r.runs),third:Math.max(0,.65-r.thirdSeen/r.runs)};
  const penalty=Object.values(violations).reduce((s,v)=>s+v,0);
  return {pass:penalty<1e-9,ratios,violations,score:100*penalty+Math.abs(ratios.time-1)+.25*Math.abs(ratios.density-2)+.25*Math.abs(ratios.flowerRate-1)+.1*Math.abs(r.items.p50-3)};
}
export const secondProtocol={seed:16201,runs:6,rate:.04,cooldowns:[30,40],flowers:{m1:[.07,.08],m2:[.055,.065],m3:[.045,.055]}};
export function stageGroup(sources,geometry,name,opts={},phase='first'){
  if(phase==='second')opts={seed:secondProtocol.seed,runs:secondProtocol.runs,...opts};
  const base=evaluateStage(sources,geometry,null,opts),results=[];
  for(const density of stageProtocol.density.filter(x=>x.name===name))for(const rate of phase==='second'?[secondProtocol.rate]:stageProtocol.itemRates)for(const cooldown of phase==='second'?secondProtocol.cooldowns:stageProtocol.cooldowns)for(const flower of phase==='second'?secondProtocol.flowers[name]:[stageProtocol.flower]){
    const p={...density,rate,cooldown,flower};
    const r=evaluateStage(sources,geometry,p,opts);
    results.push({...r,assessment:compareStage(r,base)});
  }
  return {name,phase,base,results,simulations:(results.length+1)*(opts.runs??stageProtocol.runs)};
}
export const retryProtocol={seed:19101,runs:8,dt:.025,agents:['beginner','normal'],validation:{seed:20101,runs:16,agents:['beginner','normal','expert']},fine:{seed:21101,runs:16,dt:.025}};
export function stageRetry(sources,geometry,p,agent='normal'){
  const q=retryProtocol,opts={seed:q.seed,runs:q.runs,dt:q.dt,agent},base=evaluateStage(sources,geometry,null,opts);
  const ps=[];
  for(const flower of p.name==='m1'?[.065,.07]:[.055,.06])for(const cooldown of [30,35])ps.push({...p,flower,cooldown});
  const results=ps.map(p=>{const r=evaluateStage(sources,geometry,p,opts);return {...r,assessment:compareStage(r,base)};});
  return {phase:'retry',agent,base,results,simulations:(ps.length+1)*q.runs};
}
export function stageValidate(sources,geometry,ps,agent,phase='validate'){
  const q=phase==='retryFine'?retryProtocol.fine:phase==='retryValidate'?retryProtocol.validation:phase==='fine'?stageProtocol.fine:stageProtocol.validation;
  const opts={seed:q.seed,runs:q.runs,dt:q.dt??.05,agent};
  const base=evaluateStage(sources,geometry,null,opts);
  const results=ps.map(p=>{const r=evaluateStage(sources,geometry,p,opts);return {...r,assessment:compareStage(r,base)};});
  return {phase,agent,base,results,simulations:(ps.length+1)*q.runs};
}
export const supplyProtocol={seed:22101,runs:16,dt:.05,agents:['beginner','normal','expert'],fine:{seed:23101,runs:16,dt:.025}};
export function stageSupply(sources,geometry,p,agent='normal',phase='supply'){
  const q=phase==='supplyFine'?supplyProtocol.fine:supplyProtocol,opts={seed:q.seed,runs:q.runs,dt:q.dt,agent};
  const base=evaluateStage(sources,geometry,null,opts);
  const variants=phase==='supply'&&agent==='normal'?[{sequence:true,itemCap:null},{sequence:false,itemCap:null},{sequence:true,itemCap:3},{sequence:true,itemCap:4}]:[{sequence:true,itemCap:3}];
  const results=variants.map(v=>{const r=evaluateStage(sources,geometry,p,{...opts,...v});return {...r,assessment:compareStage(r,base),strictOrder:r.rows.every(x=>x.itemNames.every((name,i)=>i>=3||name===['rock','rock','boomerang'][i])),capRespected:v.itemCap===null||r.rows.every(x=>x.items<=v.itemCap)};});
  return {phase,agent,base,results,simulations:(variants.length+1)*q.runs};
}
// Final bounded cap refinement: no relaxed gates. Keep density and cap fixed.
export const capProtocol={seed:24101,runs:8,dt:.05,flowers:[.06,.0625,.065],agents:['normal','expert'],validation:{seed:25101,runs:16,dt:.05,agents:['beginner','normal','expert']},fine:{seed:26101,runs:16,dt:.025}};
export function stageCap(sources,geometry,p,agent='normal',phase='capSearch'){
  const q=phase==='capValidate'?capProtocol.validation:phase==='capFine'?capProtocol.fine:capProtocol,opts={seed:q.seed,runs:q.runs,dt:q.dt,agent},base=evaluateStage(sources,geometry,null,opts);
  const candidates=phase==='capSearch'?capProtocol.flowers.map(flower=>({...p,flower})):[p];
  const results=candidates.map(p=>{const r=evaluateStage(sources,geometry,p,{...opts,sequence:true,itemCap:3});return {...r,assessment:compareStage(r,base),strictOrder:r.rows.every(x=>x.itemNames.every((name,i)=>name===['rock','rock','boomerang'][i])),capRespected:r.rows.every(x=>x.items<=3)};});
  return {phase,agent,base,results,simulations:(candidates.length+1)*q.runs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const p=prepare(),geometry=readJson(join(root,'simulation','experiments','stage-gear-geometry.json'));
  const mode=process.argv[4]??'first';
  const report=['capSearch','capValidate','capFine'].includes(mode)?stageCap(p.sources,geometry,readJson(process.argv[5])[0],process.argv[2],mode):['supply','supplyFine'].includes(mode)?stageSupply(p.sources,geometry,readJson(process.argv[5])[0],process.argv[2],mode):mode==='retry'?stageRetry(p.sources,geometry,readJson(process.argv[5])[Number(process.argv[6]??0)],process.argv[2]):['validate','fine','retryFine','retryValidate'].includes(mode)?stageValidate(p.sources,geometry,readJson(process.argv[5]),process.argv[2],mode):stageGroup(p.sources,geometry,process.argv[2],{},mode);
  console.log(JSON.stringify(report.results.map(r=>({p:r.p,assessment:r.assessment}))));
  saveJson(process.argv[3],report);
}
