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
  const C='3_caterpillar',B='4_beetle',G='2_grasshopper',F='1_butterfly',J='2_frog',K='1_cat';
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
  // Stage progression candidates: limits are per stage, not a global ramp.
  // Research only. The selectable production catalog remains the unmodified reference.
  const stages=[
    {id:'stage-1-cross',map:'cross',flowers:['daisy'],color:()=> 'daisy',initialSlots:2,maxSlots:3,costs:[12],cap:12,
      drops:[.56,.10,.24,.10],interval:12,enemies:[[0,C]],waves:[[0,3,3,1,[[C,1]]],[45,2,6,1,[[C,1]]],[90,1.7,12,1,[[C,1]]]],
      items:[[0,['rock','shoe']],[45,['boomerang']]],levelCap:1,progression:'none'},
    {id:'stage-2-heart',map:'heart',flowers:['daisy','rose'],color:name=>name==='daisy'?'daisy':'rose',initialSlots:3,maxSlots:5,costs:[15,25],cap:24,
      drops:[.61,.10,.18,.11],interval:10,enemies:[[0,C],[90,B]],waves:[[0,2.5,5,1,[[C,1]]],[45,1.6,10,1,[[C,1]]],[90,1.5,16,2,[[C,7],[B,3]]],[180,1.25,24,2,[[C,5],[B,5]]]],
      items:[[0,['rock','shoe','boomerang']],[60,['shield','balloon']]],levelCap:1,progression:'none'},
    {id:'stage-3-flower',map:'flower',flowers:['daisy','sunflower','tulip'],color:(name,cell)=>name==='daisy'?'daisy':cell%10<5?'sunflower':'tulip',initialSlots:3,maxSlots:6,costs:[15,25,40],cap:48,
      drops:[.65,.10,.12,.13],interval:9,enemies:[[0,C],[70,B],[160,G]],waves:[[0,2.5,5,1,[[C,1]]],[70,1.5,16,2,[[C,6],[B,4]]],[160,1.2,32,3,[[C,5],[B,3],[G,2]]],[240,.9,48,4,[[C,5],[B,3],[G,2]]]],
      items:[[0,['rock','shoe','boomerang','shield']],[70,['balloon','wheel']],[160,['flowerpot']]],levelCap:2,progression:'duplicate'},
    {id:'stage-4-butterfly',map:'butterfly',flowers:['lavender','hydrangea','sunflower','tulip'],color:name=>name,initialSlots:4,maxSlots:8,costs:[15,25,40,60],cap:80,
      drops:[.66,.10,.11,.13],interval:8,enemies:[[0,C],[65,B],[130,G],[220,F]],waves:[[0,2.5,6,1,[[C,1]]],[65,1.4,20,2,[[C,7],[B,3]]],[130,1.0,45,4,[[C,6],[B,2],[G,2]]],[220,.8,80,5,[[C,4],[B,2],[G,2],[F,2]]]],
      items:[[0,['rock','boomerang','shoe','shield']],[65,['balloon','water-fairy','wheel']],[130,['flowerpot','paper-plane']],[220,['bouncy-ball','yellow-floor']]],levelCap:2,progression:'duplicate'},
    {id:'stage-5-large-heart',map:'large-heart',flowers:['daisy','sunflower','tulip','hydrangea','rose','lavender'],color:(name,cell)=>name==='daisy'?(cell%10<5?'daisy':'sunflower'):name==='tulip'?(cell%10<5?'tulip':'hydrangea'):cell%10<5?'rose':'lavender',initialSlots:4,maxSlots:10,costs:[15,25,40,60,85,115],cap:200,
      drops:[.65,.10,.12,.13],interval:8,enemies:[[0,C],[65,B],[130,G],[200,F],[330,J],[420,K]],waves:[[0,2.5,6,1,[[C,1]]],[65,1.3,25,3,[[C,7],[B,3]]],[130,1,60,5,[[C,6],[B,2],[G,2]]],[200,.8,120,7,[[C,5],[B,2],[G,2],[F,1]]],[330,.65,160,8,[[C,5],[B,2],[G,2],[J,1]]],[420,.5,200,10,[[C,5],[G,2],[F,2],[K,1]]]],
      items:[[0,['rock','boomerang','shoe','shield']],[65,['water-fairy','balloon','wheel']],[130,['flowerpot','paper-plane','bouncy-ball']],[200,['yellow-floor','broom','sprinkler']]],levelCap:3,progression:'duplicate'}
  ];
  const mosaic=['..SSSSSS..','.SSLLLLSS.','SSLLRRLLSS','SLRRRRRRLS','SLRTDDTRLS','SLRTDDTRLS','SLRRRRRRLS','SSLLHHLLSS','.SSHHHHSS.','..SSSSSS..'];
  const colors={S:'sunflower',L:'lavender',R:'rose',T:'tulip',D:'daisy',H:'hydrangea'};
  const mosaicBlueprint=mosaic.flatMap((row,y)=>[...row].flatMap((letter,x)=>colors[letter]?[[y*10+x,colors[letter]]]:[]));
  const mosaicMap={blueprint:mosaicBlueprint,initial:mosaicBlueprint.filter(([id])=>[44,45,54,55].includes(id))};
  const late=stages.at(-1);
  stages.push({...late,id:'stage-6-mosaic',map:null,color:name=>name,cap:200,drops:[.69,.10,.08,.13],
    enemies:[[0,C],[65,B],[130,G],[180,F],[240,J],[300,K],[360,'6_sparrow'],[420,'6_mouse'],[480,'6_rabbit'],[540,'5_bulldog'],[600,'6_pigeon']],
    waves:[[0,2.5,6,1,[[C,1]]],[65,1.3,25,3,[[C,7],[B,3]]],[130,1,60,5,[[C,6],[B,2],[G,2]]],[180,.8,120,7,[[C,5],[B,2],[G,2],[F,1]]],[240,.65,160,8,[[C,5],[B,2],[G,2],[J,1]]],[300,.5,200,10,[[C,5],[G,2],[F,2],[K,1]]],[360,.5,200,10,[[C,5],[G,2],[J,1],['6_sparrow',2]]],[420,.5,200,10,[[C,5],[F,2],[K,1],['6_mouse',2]]],[480,.45,200,10,[[C,5],[G,2],[J,1],['6_rabbit',2]]],[540,.4,200,10,[[C,5],[F,2],[K,1],['5_bulldog',2]]],[600,.4,200,10,[[C,5],[G,2],[J,1],['6_pigeon',2]]]]});
  for(const st of stages){
    const source=st.map?map(st.map):mosaicMap,blueprint=source.blueprint.map(([id,name])=>[id,st.color(name,id)]),byId=new Map(blueprint);
    const initial=source.initial.map(([id])=>[id,byId.get(id)]);
    const patch={initial,blueprint,flowerPool:st.flowers,run:{initialSlots:st.initialSlots,maxSlots:st.maxSlots,costs:st.costs,dropWeights:st.drops,itemInterval:st.interval,spawnCap:st.cap,gemValue:st.maxSlots>=6?2:1},enemyUnlocks:st.enemies,waves:st.waves,itemUnlocks:st.items};
    add('stages',st.id,patch,'normal',{progression:st.progression,levelCap:st.levelCap});
  }
  // Same stage shapes/economies, revised enemy introduction and formation pulses.
  // Controls retain exactly the ambient schedule, without additional pulses.
  const P='2_gray_bug',S='6_sparrow',M='6_mouse',Q='6_rabbit',D='5_bulldog',V='6_pigeon';
  const revised=[
    {ids:[[0,C],[55,B]],waves:[[0,3,3,1,[[C,1]]],[30,2.4,6,1,[[C,1]]],[55,2.5,8,1,[[C,8],[B,2]]],[95,2,12,1,[[C,7],[B,3]]]],pulses:[[70,'line',C,4],[115,'pack',B,3]]},
    {ids:[[0,C],[35,B],[75,F],[125,P]],waves:[[0,2.5,5,1,[[C,1]]],[35,2,10,1,[[C,7],[B,3]]],[75,1.6,18,2,[[C,6],[B,3],[F,1]]],[125,1.4,24,2,[[C,5],[B,2],[F,2],[P,1]]]],pulses:[[50,'pack',B,5],[85,'pack',F,8],[140,'pincer',P,6]]},
    {ids:[[0,C],[35,B],[65,G],[105,F],[145,P]],waves:[[0,2.5,5,1,[[C,1]]],[35,1.8,14,2,[[C,7],[B,3]]],[65,1.5,24,2,[[C,6],[B,2],[G,2]]],[105,1.25,36,3,[[C,5],[B,2],[G,2],[F,1]]],[145,1,48,3,[[C,4],[B,2],[G,2],[F,1],[P,1]]]],pulses:[[75,'ring',G,12],[120,'pack',F,12],[160,'pincer',P,8],[195,'ring',G,16]]},
    {ids:[[0,C],[30,B],[60,G],[90,F],[120,P],[185,J]],waves:[[0,2.5,6,1,[[C,1]]],[30,1.8,16,2,[[C,7],[B,3]]],[60,1.3,30,3,[[C,6],[B,2],[G,2]]],[90,1.1,45,4,[[C,4],[B,2],[G,2],[F,2]]],[120,1,60,4,[[C,4],[G,2],[F,2],[P,2]]],[185,.9,80,4,[[C,4],[G,2],[F,2],[J,2]]]],pulses:[[70,'ring',G,16],[100,'pack',F,18],[145,'pincer',P,12],[190,'ring',G,24],[220,'pack',J,6]]},
    {ids:[[0,C],[30,B],[60,G],[90,F],[120,P],[170,J],[220,K],[270,S]],waves:[[0,2.5,6,1,[[C,1]]],[30,1.8,16,2,[[C,7],[B,3]]],[60,1.3,30,3,[[C,6],[B,2],[G,2]]],[90,1,55,4,[[C,4],[B,2],[G,2],[F,2]]],[120,.9,80,5,[[C,4],[G,2],[F,2],[P,2]]],[170,.8,120,6,[[C,4],[G,2],[F,2],[J,2]]],[220,.65,160,7,[[C,4],[G,2],[F,2],[K,2]]],[270,.55,200,9,[[C,4],[G,2],[F,2],[S,2]]]],pulses:[[70,'ring',G,20],[100,'pack',F,24],[150,'pincer',P,16],[185,'ring',G,32],[225,'pincer',K,6],[275,'line',S,16]]},
    {ids:[[0,C],[30,B],[60,G],[90,F],[120,P],[170,J],[220,K],[270,S],[330,M],[390,Q],[450,D],[510,V]],waves:[[0,2.5,6,1,[[C,1]]],[30,1.8,16,2,[[C,7],[B,3]]],[60,1.3,30,3,[[C,6],[B,2],[G,2]]],[90,1,60,4,[[C,4],[B,2],[G,2],[F,2]]],[120,.9,90,5,[[C,4],[G,2],[F,2],[P,2]]],[170,.7,140,7,[[C,4],[G,2],[F,2],[J,2]]],[220,.55,200,9,[[C,4],[G,2],[F,2],[K,2]]],[270,.5,200,10,[[C,4],[G,2],[F,2],[S,2]]],[330,.5,200,10,[[C,4],[G,2],[F,2],[M,2]]],[390,.45,200,10,[[C,4],[G,2],[F,2],[Q,2]]],[450,.4,200,10,[[C,4],[G,2],[F,2],[D,2]]],[510,.4,200,10,[[C,4],[G,2],[F,2],[V,2]]]],pulses:[[70,'ring',G,24],[100,'pack',F,32],[145,'pincer',P,24],[185,'ring',G,40],[225,'pincer',K,8],[250,'pack',F,40],[275,'line',S,24],[335,'pack',M,10],[395,'ring',Q,20],[455,'pincer',D,6],[515,'line',V,20]]}
  ];
  const stageCases=cases.filter(c=>c.group==='stages');
  for(const [index,st] of stageCases.entries()){
    const v=revised[index],patch={...st.patch,enemyUnlocks:v.ids,waves:v.waves};
    add('formations',st.id+'-ambient',patch,'normal',st.research);
    add('formations',st.id+'-groups',{...patch,formations:v.pulses},'normal',st.research);
  }
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
      const first3=r.timeline.find(x=>x.gearLevels.includes(3))?.time??(r.gearLevels.includes(3)?r.seconds:null);
      const seenSpecies=Object.entries(r.byEnemy).filter(([,v])=>v.enemy_spawn>0).map(([id])=>id);
      const largeEnemy=seenSpecies.some(id=>['2_frog','1_cat','6_sparrow','6_mouse','6_rabbit','5_bulldog','6_pigeon'].includes(id));
      const groups=Object.values(r.byFormation||{});
      const formationRequested=groups.reduce((n,g)=>n+g.requested,0),formationSpawned=groups.reduce((n,g)=>n+g.count,0),formationKills=groups.reduce((n,g)=>n+g.kills,0),formationEvents=groups.filter(g=>g.count>0).length;
      const {timeline,events,actions,...row}=r;
      rows.push({...row,formationRequested,formationSpawned,formationKills,formationEvents,burst10:burst,peakSpeed,maxLevel,first3,seenSpecies,largeEnemy,items:r.cardStats.item?.card_spawn??0,distinctGear:new Set(r.gear.filter(Boolean)).size,rockSlots:r.gear.filter(x=>x==='rock').length,filledSlots:r.gear.filter(Boolean).length});
    }
    const summary=summarize(rows),extra=Object.fromEntries(['burst10','peakSpeed','maxLevel','first3','items','distinctGear','rockSlots','filledSlots','formationRequested','formationSpawned','formationKills','formationEvents'].map(k=>[k,d(rows,r=>r[k])]));
    results.push({...c,config,summary,extra,lv2Runs:rows.filter(r=>r.maxLevel>=2).length,lv3Runs:rows.filter(r=>r.maxLevel===3).length,largeEnemyRuns:rows.filter(r=>r.largeEnemy).length,tenRockRuns:rows.filter(r=>r.rockSlots===10).length,rows});
  }
  return {runs,seed,dt,maxSeconds,geometry:geometry?'measured':'fallback',cases:results};
}
export function concise(report){
  return report.cases.map(c=>({group:c.group,id:c.id,cells:c.config.blueprint.length,flowerTypes:new Set(c.config.blueprint.map(([,name])=>name)).size,slotCap:c.config.run.maxSlots,levelCap:c.research?.levelCap??(c.research?.progression&&c.research.progression!=='none'?3:1),n:c.summary.runs,wins:c.summary.wins,defeats:c.summary.defeats,timeouts:c.summary.timeouts,
    winP50:c.summary.winTime.p50,winP90:c.summary.winTime.p90,progress:c.summary.metrics.progress.p50,kills:c.summary.metrics.kills.p50,peak:c.summary.metrics.peakEnemies.p50,
    firstItem:c.summary.metrics.firstItem.p50,gap:c.summary.metrics.maxProgressGap.p50,purchases:c.summary.metrics.purchases.p50,items:c.extra.items.p50,burst10:c.extra.burst10.p50,speed:c.extra.peakSpeed.p50,
    groupEvents:c.extra.formationEvents.p50,groupSpawned:c.extra.formationSpawned.p50,groupRequested:c.extra.formationRequested.p50,groupKills:c.extra.formationKills.p50,distinct:c.extra.distinctGear.p50,filled:c.extra.filledSlots.p50,rock:c.extra.rockSlots.p50,lv2:c.lv2Runs,lv3:c.lv3Runs,largeEnemyRuns:c.largeEnemyRuns,first3:c.extra.first3.p50,tenRock:c.tenRockRuns}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {values:o}=parseArgs({options:{group:{type:'string',default:'all'},case:{type:'string'},runs:{type:'string',default:'20'},seed:{type:'string',default:'1'},dt:{type:'string',default:'.05'},seconds:{type:'string',default:'900'},geometry:{type:'string'},output:{type:'string'}}});
  const geometry=o.geometry?readJson(o.geometry):null,p=prepare({},geometry);
  const report={schemaVersion:1,...fingerprints(p.sources),...runStudy(p.sources,{group:o.group,caseId:o.case,runs:Number(o.runs),seed:Number(o.seed),dt:Number(o.dt),maxSeconds:Number(o.seconds),geometry})};
  console.log(JSON.stringify(concise(report),null,2));
  console.log(saveJson(o.output||join(root,'simulation','results','blueprint-study-'+Date.now()+'.json'),report));
}
