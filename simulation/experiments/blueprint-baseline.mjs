// Reproducible first balance study. No experimental overrides are applied to index.html.
import {parseArgs} from 'node:util';
import {loadModels,resolveConfig} from '../models.mjs';
import {createEngine} from '../engine.mjs';
import {play,profileFor} from '../agents.mjs';
import {summarize,distribution} from '../metrics.mjs';
import {sourceSet,fingerprints,saveJson,readJson,root,prepare} from '../io.mjs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function experimentCases(w){
  const R=w.GardenRunRules,map=id=>{const {initial,blueprint}=R.catalog.find(p=>p.id===id);return {initial,blueprint};};
  const rich={dropWeights:[.59,.10,.18,.13],itemInterval:8,costs:[15,25,40,60,85,115],gemValue:2};
  const rare={daisy:2,sunflower:1.6,tulip:1.2,hydrangea:.7,rose:.45,lavender:.35};
  const earlyUnlocks=R.enemyUnlocks.map(([t,id])=>[t*.5,id]);
  const swarm=R.waves.map((x,i)=>[x.start*.5,x.interval,i<3?x.cap:i<6?Math.min(80,x.cap*4):Math.min(200,x.cap*6),i<3?x.batch:i<6?Math.min(5,x.batch*3):Math.min(12,x.batch*5),x.pool]);
  const cases=[];
  const add=(group,id,patch,agent='normal',research=null)=>cases.push({group,id,patch,agent,research});
  for(const p of R.catalog)for(const agent of ['beginner','normal','expert'])add('maps',p.id+'-'+agent,map(p.id),agent);
  for(const id of ['heart','butterfly','large-heart']){
    add('flowers',id+'-uniform',map(id));add('flowers',id+'-rare',{...map(id),flowerWeights:rare});
    add('flowers',id+'-rare-strong-bias',{...map(id),flowerWeights:rare,run:{neededFlowerBias:.95}});
  }
  add('growth','large-current',map('large-heart'));
  add('growth','large-richer',{...map('large-heart'),run:rich});
  add('growth','large-richer-more-flowers',{...map('large-heart'),run:{...rich,dropWeights:[.55,.10,.22,.13]}});
  const richer={...map('large-heart'),run:rich};
  for(const agent of ['normal','rock-only','speed-first','diverse'])add('builds','rich-'+agent,richer,agent);
  for(const progression of ['none','duplicate','timed-drop'])add('levels',progression,richer,'normal',{progression,levelTimes:[180,360]});
  // Deliberate stress profile; accelerated species/wave unlocks preserve each pool's validity.
  const stressed={...richer,run:{...rich,spawnCap:200},enemyUnlocks:earlyUnlocks,waves:swarm};
  for(const agent of ['normal','rock-only','speed-first','diverse'])add('swarm','swarm-'+agent,stressed,agent);
  add('swarm','swarm-duplicate',stressed,'normal',{progression:'duplicate'});
  const allEnemies=R.enemyUnlocks.map(([,id])=>[0,id]);
  const mixedPool=[['3_caterpillar',7],['4_beetle',2],['1_butterfly',1]];
  const fixture={...map('large-heart'),run:{initialSlots:10,maxSlots:10,costs:[],spawnCap:200},enemyUnlocks:allEnemies,
    waves:[[0,.25,200,8,mixedPool]]};
  const loadouts={
    '10-rock':Array(10).fill('rock'),
    '8-rock-2-shoes':[...Array(8).fill('rock'),'shoe','shoe'],
    'mixed':['rock','boomerang','wheel','balloon','flowerpot','paper-plane','bouncy-ball','broom','sprinkler','yellow-floor'],
    'mixed-speed':['rock','boomerang','wheel','flowerpot','paper-plane','broom','sprinkler','shoe','shoe','shield']
  };
  for(const [id,fixedLoadout] of Object.entries(loadouts))add('fixed-combat',id,fixture,'idle',{fixedLoadout});
  return cases;
}
export function runStudy(sources,{group='all',caseId=null,runs=20,seed=1,dt=.05,maxSeconds=900,geometry=null}={}){
  if(!Number.isInteger(runs)||runs<1||runs>1000||!Number.isInteger(seed)||seed<0||seed+runs-1>0xffffffff)throw Error('Invalid sample');
  const w=loadModels(sources),cases=experimentCases(w).filter(c=>(group==='all'||c.group===group)&&(!caseId||caseId===c.id)),results=[];
  if(!cases.length)throw Error('Unknown group '+group);
  const d=(rows,f)=>distribution(rows.map(f));
  for(const c of cases){
    const config=resolveConfig(w,c.patch),rows=[];
    for(let n=0;n<runs;n++){
      const engine=createEngine(loadModels(sources,config),{seed:seed+n,dt,maxSeconds,geometry,research:c.research});
      const r=play(engine,profileFor(c.agent));
      let burst=0,lo=0;
      for(let i=0;i<r.timeline.length;i++){
        while(lo<i&&r.timeline[i].time-r.timeline[lo].time>10+1e-7)lo++;
        burst=Math.max(burst,r.timeline[i].kills-r.timeline[lo].kills);
      }
      const peakSpeed=Math.max(...r.timeline.map(x=>x.speed),r.final.speed);
      const maxLevel=Math.max(1,...r.timeline.flatMap(x=>x.gearLevels.filter(Boolean)),...r.gearLevels.filter(Boolean));
      const first3=r.timeline.find(x=>x.gearLevels.includes(3))?.time??null;
      const {timeline,events,actions,...row}=r;
      rows.push({...row,burst10:burst,peakSpeed,maxLevel,first3,items:r.cardStats.item?.card_spawn??0,distinctGear:new Set(r.gear.filter(Boolean)).size,rockSlots:r.gear.filter(x=>x==='rock').length,filledSlots:r.gear.filter(Boolean).length});
    }
    const summary=summarize(rows),extra=Object.fromEntries(['burst10','peakSpeed','maxLevel','first3','items','distinctGear','rockSlots','filledSlots'].map(k=>[k,d(rows,r=>r[k])]));
    results.push({...c,config,summary,extra,lv3Runs:rows.filter(r=>r.maxLevel===3).length,tenRockRuns:rows.filter(r=>r.rockSlots===10).length,rows});
  }
  return {runs,seed,dt,maxSeconds,geometry:geometry?'measured':'fallback',cases:results};
}
export function concise(report){
  return report.cases.map(c=>({group:c.group,id:c.id,cells:c.config.blueprint.length,n:c.summary.runs,wins:c.summary.wins,defeats:c.summary.defeats,timeouts:c.summary.timeouts,
    winP50:c.summary.winTime.p50,winP90:c.summary.winTime.p90,progress:c.summary.metrics.progress.p50,kills:c.summary.metrics.kills.p50,peak:c.summary.metrics.peakEnemies.p50,
    firstItem:c.summary.metrics.firstItem.p50,gap:c.summary.metrics.maxProgressGap.p50,purchases:c.summary.metrics.purchases.p50,items:c.extra.items.p50,burst10:c.extra.burst10.p50,speed:c.extra.peakSpeed.p50,
    distinct:c.extra.distinctGear.p50,filled:c.extra.filledSlots.p50,rock:c.extra.rockSlots.p50,lv3:c.lv3Runs,first3:c.extra.first3.p50,tenRock:c.tenRockRuns}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {values:o}=parseArgs({options:{group:{type:'string',default:'all'},case:{type:'string'},runs:{type:'string',default:'20'},seed:{type:'string',default:'1'},dt:{type:'string',default:'.05'},seconds:{type:'string',default:'900'},geometry:{type:'string'},output:{type:'string'}}});
  const geometry=o.geometry?readJson(o.geometry):null,p=prepare({},geometry);
  const report={schemaVersion:1,...fingerprints(p.sources),...runStudy(p.sources,{group:o.group,caseId:o.case,runs:Number(o.runs),seed:Number(o.seed),dt:Number(o.dt),maxSeconds:Number(o.seconds),geometry})};
  console.log(JSON.stringify(concise(report),null,2));
  console.log(saveJson(o.output||join(root,'simulation','results','blueprint-study-'+Date.now()+'.json'),report));
}
