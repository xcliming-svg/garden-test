// Shared source loader. No copied damage, wave, patrol or drop formulas.
export const SOURCE_ORDER = ['run-rules','palette','svg-palette','ui','test-sprites','flower-damage','flower-growth','combat-preview','loot-preview','stone-border-preview','patrol-path-preview','dashed-grid-preview','light-field-preview','dark-field-preview','guardian-walk-preview','pebble-boundary','fairy-patrol','enemy-motion','enemy-occlusion','fairy-attack','weapon-balance','enemy-preview','flower-head-preview','item-cards','hero-weapon-preview','relic-collection','game-layout','run-drops'];
export function loadModels(sources,config={}) {
  const w={location:{search:''},GardenSimulationConfig:structuredClone(config)};
  const document={documentElement:{dataset:{playable:'true'}}};
  for(const id of SOURCE_ORDER) {
    if(typeof sources[id]!=='string') throw Error('Missing source '+id);
    new Function('window','document','URLSearchParams',sources[id])(w,document,URLSearchParams);
  }
  return w;
}
export function defaults(w) {
  const R=w.GardenRunRules,B=w.GardenWeaponBalance,F=w.GardenFairyPatrol,I=w.GardenItemCards;
  return structuredClone({
    schemaVersion:1,initial:R.initial,blueprint:R.blueprint,flowerPool:R.flowerPool,flowerWeights:R.flowerWeights,run:R.tuning,
    enemyUnlocks:R.enemyUnlocks,formations:R.formations,waves:R.waves.map(x=>[x.start,x.interval,x.cap,x.batch,x.pool]),
    itemUnlocks:R.itemUnlocks,weapons:B.data,enemyHp:Object.fromEntries(w.GardenEnemyPreview.roster.map(e=>[e.id,B.hp(e)])),
    enemyDamage:{},heightLimits:B.heightLimits,enemyMotion:w.GardenEnemyMotion.profiles,projectiles:w.GardenHeroWeaponPreview.tuning,
    relic:w.GardenRelicCollection.tuning,fairy:{speed:F.speed,maxSpeed:F.maxSpeed},
    passives:{shoe:I.runItemData('shoe').stats,shield:I.runItemData('shield').stats}
  });
}
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(p,msg)=>{throw Error('Invalid config '+p+': '+msg);};
function merge(base,patch,p='config') {
  if(!plain(patch))fail(p,'expected object');
  const result=structuredClone(base);
  for(const [key,value] of Object.entries(patch)){
    if(!Object.hasOwn(base,key))fail(p+'.'+key,'unknown field');
    const old=base[key],path=p+'.'+key;
    if(plain(old))result[key]=merge(old,value,path);
    else{
      if(Array.isArray(old)!==Array.isArray(value)||typeof old!==typeof value||value===null)fail(path,'wrong type');
      if(typeof value==='number'&&!Number.isFinite(value))fail(path,'non-finite value');
      result[key]=structuredClone(value);
    }
  }
  return result;
}
const number=(v,p,min=0,max=1e9)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(p,'number outside '+min+'..'+max);};
const integer=(v,p,min,max)=>{number(v,p,min,max);if(!Number.isInteger(v))fail(p,'expected integer');};
const arr=(v,p,min=1)=>{if(!Array.isArray(v)||v.length<min)fail(p,'invalid array');};
function numericShape(base,value,path){
  if(Array.isArray(base)){
    if(!Array.isArray(value)||base.length!==value.length)fail(path,'expected array with '+base.length+' entries');
    base.forEach((v,i)=>numericShape(v,value[i],path+'['+i+']'));
  }else if(typeof base==='number')number(value,path,base<0?-1e9:0);
}
export function resolveConfig(w,patch={}) {
  const base=defaults(w),copy=structuredClone(patch);
  if(!plain(copy))fail('root','expected object');
  const enemyDamage=copy.enemyDamage??{};delete copy.enemyDamage;
  if(!plain(enemyDamage))fail('enemyDamage','expected object');
  const c=merge(base,copy);c.enemyDamage=enemyDamage;
  if(c.schemaVersion!==1)fail('schemaVersion','only version 1');
  const flowers=new Set(w.GardenFlowerGrowth.names),enemies=new Set(w.GardenEnemyPreview.roster.map(e=>e.id)),items=new Set(w.GardenItemCards.entries.map(e=>e.id));
  function cells(a,p){
    arr(a,p);const seen=new Map();
    for(const row of a){
      if(!Array.isArray(row)||row.length!==2)fail(p,'expected [cell,flower]');
      const [id,name]=row;integer(id,p+'.cell',0,99);
      if(!flowers.has(name)||seen.has(id))fail(p,'unknown flower or duplicate cell');
      seen.set(id,name);
    }
    return seen;
  }
  for(const [name,weight] of Object.entries(c.flowerWeights))number(weight,'flowerWeights.'+name,.001,1000);
  const needed=cells(c.blueprint,'blueprint'),initial=cells(c.initial,'initial');
  if(!Array.isArray(c.flowerPool)||!c.flowerPool.length||new Set(c.flowerPool).size!==c.flowerPool.length||c.flowerPool.some(name=>!flowers.has(name)))fail('flowerPool','must contain unique known flowers');
  for(const name of needed.values())if(!c.flowerPool.includes(name))fail('flowerPool','missing required flower '+name);
  for(const [id,name] of initial)if(needed.get(id)!==name)fail('initial','must match blueprint');
  const reach=new Set(initial.keys()),queue=[...reach];
  while(queue.length){
    const i=queue.shift();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=i%10+dx,y=Math.floor(i/10)+dy,k=y*10+x;
      if(x>=0&&x<10&&y>=0&&y<10&&needed.has(k)&&!reach.has(k)){reach.add(k);queue.push(k);}
    }
  }
  if(reach.size!==needed.size)fail('blueprint','unreachable from initial cells');
  const t=c.run;
  integer(t.initialSlots,'initialSlots',1,10);integer(t.maxSlots,'maxSlots',t.initialSlots,10);
  if(t.costs.length!==t.maxSlots-t.initialSlots)fail('costs','length must equal maxSlots-initialSlots');
  t.costs.forEach(x=>integer(x,'costs',0,1e9));
  for(const k of ['growthSeconds','uprootSeconds','cardLifetime','gemValue'])number(t[k],'run.'+k,0.001);
  for(const k of ['itemInterval','enemyDamage','enemyDamagePerLevel'])number(t[k],'run.'+k);
  integer(t.startingGems,'startingGems',0,1e9);integer(t.gemValue,'gemValue',1,1e6);
  integer(t.spawnCap,'spawnCap',1,200);number(t.neededFlowerBias,'neededFlowerBias',0,1);
  if(t.dropWeights.length!==4)fail('dropWeights','gem,heart,flower,item required');
  t.dropWeights.forEach(v=>number(v,'dropWeights',0,1));
  if(Math.abs(t.dropWeights.reduce((a,b)=>a+b,0)-1)>1e-9)fail('dropWeights','sum must be 1');
  if(!Object.hasOwn(c.weapons,t.starterRock))fail('starterRock','must be weapon');
  const starter=c.weapons[t.starterRock].damage[0];
  if((Array.isArray(starter)?starter[0]:starter)<=0)fail('starterRock','must deal damage');
  function unlocks(rows,p,ids,multi){
    arr(rows,p);const map=new Map();let last=-1;
    for(const row of rows){
      if(!Array.isArray(row)||row.length!==2)fail(p,'expected [time,id(s)]');
      const [time,id]=row;number(time,p+'.time');
      if(time<last)fail(p,'must be sorted');last=time;
      const list=multi?id:[id];arr(list,p+'.ids');
      for(const k of list){if(!ids.has(k)||map.has(k))fail(p,'unknown or duplicate '+k);map.set(k,time);}
    }
    if(rows[0][0]!==0)fail(p,'must start at zero');return map;
  }
  const unlocked=unlocks(c.enemyUnlocks,'enemyUnlocks',enemies,false);
  unlocks(c.itemUnlocks,'itemUnlocks',items,true);
  arr(c.waves,'waves');let last=-1;
  for(const row of c.waves){
    if(!Array.isArray(row)||row.length!==5)fail('waves','expected [start,interval,cap,batch,pool]');
    const [at,interval,cap,batch,pool]=row;number(at,'wave.start');
    if(at<=last)fail('waves','strictly increasing starts');last=at;
    number(interval,'wave.interval',.001);integer(cap,'wave.cap',1,t.spawnCap);integer(batch,'wave.batch',1,cap);
    arr(pool,'wave.pool');const seen=new Set();
    for(const pair of pool){
      if(!Array.isArray(pair)||pair.length!==2)fail('wave.pool','expected [enemy,weight]');
      const [id,weight]=pair;
      if(!unlocked.has(id)||unlocked.get(id)>at||seen.has(id))fail('wave.pool','unknown, duplicate or locked '+id);
      seen.add(id);integer(weight,'wave.weight',1,10000);
    }
  }
  if(c.waves[0][0]!==0)fail('waves','must start at zero');
  if(!Array.isArray(c.formations))fail('formations','expected array');
  let lastFormation=-1;
  for(const row of c.formations){
    if(!Array.isArray(row)||row.length!==4)fail('formations','expected [time,pattern,enemy,count]');
    const [at,pattern,id,count]=row;number(at,'formation.time');
    if(at<lastFormation)fail('formations','must be sorted');lastFormation=at;
    if(!['pack','ring','pincer','line'].includes(pattern))fail('formations','unknown pattern '+pattern);
    if(!unlocked.has(id)||unlocked.get(id)>at)fail('formations','species not unlocked '+id);
    integer(count,'formation.count',1,t.spawnCap);
    const cap=c.waves.findLast(w=>w[0]<=at)[2];if(count>cap)fail('formations','count exceeds wave cap');
  }
  for(const [id,hp] of Object.entries(c.enemyHp))number(hp,'enemyHp.'+id,.001);
  for(const [id,amount] of Object.entries(c.enemyDamage)){if(!enemies.has(id))fail('enemyDamage','unknown '+id);number(amount,'enemyDamage.'+id);}
  for(const group of ['weapons','projectiles','enemyMotion','passives']){
    for(const [id,data] of Object.entries(c[group]))for(const [key,value] of Object.entries(data))numericShape(base[group][id][key],value,group+'.'+id+'.'+key);
  }
  for(const [id,data] of Object.entries(c.weapons)){
    number(data.range,id+'.range',.001);data.cooldown.forEach(v=>number(v,id+'.cooldown',.001));
    if(data.repeat!==undefined)number(data.repeat,id+'.repeat',.001);
    if(data.duration!==undefined)number(data.duration,id+'.duration',.001);
    if(data.maxHits!==undefined)integer(data.maxHits,id+'.maxHits',1,1000);
    if(data.slow)data.slow.forEach(v=>number(v,id+'.slow',0,.9));
  }
  for(const [key,value] of Object.entries(c.heightLimits))number(value,'heightLimits.'+key);
  for(const [id,p] of Object.entries(c.enemyMotion)){number(p.recovery,id+'.recovery',.001);number(p.retreat,id+'.retreat',.001);number(p.windup,id+'.windup',.001);number(p.strike,id+'.strike',.001);number(p.baseSpeed,id+'.baseSpeed',.001);number(p.hz,id+'.hz',.001);number(p.squash,id+'.squash',0,.99);}
  for(const [id,p] of Object.entries(c.projectiles)){
    for(const k of ['life','span','speed','minFlight','maxFlight','hop','fall','period','emitInterval','dropLife','minSpeed','initialSpeed'])if(k in p)number(p[k],id+'.'+k,.001);
    if(p.minFlight!==undefined&&p.maxFlight!==undefined&&p.minFlight>p.maxFlight)fail(id,'minFlight > maxFlight');
  }
  for(const [k,v] of Object.entries(c.relic))number(v,'relic.'+k);
  for(const k of ['maxSpeed','initialSpeed','acceleration','collectRadius'])number(c.relic[k],'relic.'+k,.001);
  number(c.relic.maxEnergy,'relic.maxEnergy',.001);number(c.relic.lifetime,'relic.lifetime',.001);number(c.relic.pickupRange,'relic.pickupRange',8);
  number(c.relic.magnetAngle,'relic.magnetAngle',0,360);
  number(c.fairy.speed,'fairy.speed',.001);number(c.fairy.maxSpeed,'fairy.maxSpeed',c.fairy.speed);
  return c;
}
export function rng(seed,label=''){
  let s=seed>>>0;
  for(let i=0;i<label.length;i++)s=Math.imul(s^label.charCodeAt(i),16777619)>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}
