// Model-based flower economy study: reproduces production garden-economy model,
// spawn schedule and weapon nominal DPS. Combat/attention are explicit assumptions.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const input=JSON.parse(readFileSync(process.argv[2]||'simulation/experiments/garden-economy-10x10.json','utf8'));
assert.equal(input.schemaVersion,1);
const w={location:{search:''}};
const doc={documentElement:{dataset:{playable:'true'}}};
new Function('window','document',readFileSync('src/run-rules.js','utf8'))(w,doc);
new Function('window',readFileSync('src/garden-economy.js','utf8'))(w);
new Function('window',readFileSync('src/weapon-balance.js','utf8'))(w);
const E=w.GardenEconomy,R=w.GardenRunRules,B=w.GardenWeaponBalance;
assert.equal(R.survival,true);
const quant=(xs,p=.5)=>{
  const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);
  return a.length?a[Math.max(0,Math.min(a.length-1,Math.floor((a.length-1)*p)))]:null;
};
const rngFrom=seed=>{
  let x=seed>>>0||1;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
};
const avg=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
function run(seed,policy){
  const random=rngFrom(seed),m=E.create(random),s=m.state;
  const milestones={firstWeapon:null,side2:null,side3:null,side4:null,side5:null,firstUpgrade:null};
  const events=[],snapshots={},shopStep=policy.shopInterval;
  let spawned=0,kills=0,waterDropped=0,waterWasted=0,hearts=0;
  let nextSpawn=0;
  const dps=()=>E.weapons.reduce((sum,id)=>{
    if(!s.owned.has(id))return sum;
    const b=m.bonus(id);
    return sum+B.nominalDps(id,b.level)*b.volley*(1+b.speed);
  },0);
  function buyBest(t){
    const expansion=m.expansionCost();
    // During expansion, reserve most of the next investment. Buying every cheap
    // upgrade immediately would otherwise starve the 25-flower goal indefinitely.
    const reserve=expansion?expansion.map(v=>Math.ceil(.7*v)):[0,0,0,0];
    const surplusCost=id=>{
      const cost=m.cost(id,'buy');
      return m.available(id)&&cost&&cost.every((n,i)=>s.plots[i].count-n>=reserve[i]);
    };
    if(s.side>=2&&!s.owned.has('boomerang')&&
        (surplusCost('boomerang')||s.side===2&&m.affordable(m.cost('boomerang','buy')))&&
        m.purchase('boomerang')){
      milestones.firstWeapon??=t;events.push({t,action:'buy',id:'boomerang'});return;
    }
    for(const [id,required] of [['balloon',3],['shoe',3],['shield',4],['wheel',4]]){
      if(s.side>=required&&!s.owned.has(id)&&surplusCost(id)&&m.purchase(id)){
        milestones.firstWeapon??=t;events.push({t,action:'buy',id});return;
      }
    }
    if(s.side<5){
      if(m.expand()){
        milestones['side'+s.side]=t;events.push({t,action:'expand',side:s.side});
      }
      return;
    }
    for(const id of input.purchaseOrder){
      if(!s.owned.has(id)&&m.purchase(id)){
        milestones.firstWeapon??=t;events.push({t,action:'buy',id});return;
      }
    }
    const candidates=[];
    for(const id of s.owned)for(const type of ['power','volley','speed']){
      const price=m.cost(id,type);
      if(price&&m.affordable(price))candidates.push({id,type,price:price.reduce((a,b)=>a+b,0)});
    }
    candidates.sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id));
    if(candidates.length){
      const {id,type}=candidates[0];if(m.upgrade(id,type)){
        milestones.firstUpgrade??=t;events.push({t,action:'upgrade',id,type});
      }
    }
  }
  for(let t=0;t<=input.durationSeconds;t++){
    if(t+1e-8>=nextSpawn){
      spawned++;
      nextSpawn=t+R.spawnInterval(t);
      // Simplified exposure-to-kill assumption, not a combat-engine result.
      const enemyEndurance=1+Math.min(1.5,Math.max(0,t-600)/7200);
      const chance=Math.max(.2,Math.min(.9,
        (.36+.012*dps()/Math.sqrt(enemyEndurance)-t/216000)*(policy.killMultiplier??1)));
      if(random()<chance){
        kills++;
        if(random()<.015){hearts++;m.heal(E.tuning.heartRecovery);}
        else{waterDropped++;waterWasted+=E.tuning.waterPerDrop-
          m.gainWater(E.tuning.waterPerDrop);}
      }
    }
    if(t%policy.cycleSeconds<policy.waterWindow&&s.water>0){
      // Idealized optimal target choice, upper bound on accessible watering.
      const available=s.plots.filter(p=>p.phase==='growing');
      if(available.length){
        const p=available.sort((a,b)=>a.count-b.count||b.progress/b.required-a.progress/a.required)[0];
        m.water(1,p.id);
      }
    }
    if(random()<Math.min(.95,.35+.6*t/3600))m.damage(1,1,m.defense());
    m.tick(1);
    if(t>0&&t%shopStep===0)buyBest(t);
    if(input.snapshots.includes(t)){
      snapshots[t]={
        t,side:s.side,harvested:s.totalHarvested,
        flowerStock:s.plots.map(p=>p.count),water:Math.round(s.water),
        owned:s.owned.size,upgrades:Object.values(s.upgrades)
          .reduce((v,x)=>v+x.power+x.volley+x.speed,0),
        dps:Math.round(dps()*10)/10,hp:Math.round(s.hp),kills,
        waterWasted:Math.round(waterWasted)
      };
    }
    if(s.hp===0)break;
  }
  return {seed,policy:policy.id,milestones,events,snapshots,
    harvested:s.totalHarvested,side:s.side,owned:s.owned.size,
    upgrades:Object.values(s.upgrades).reduce((v,x)=>v+x.power+x.volley+x.speed,0),
    kills,spawned,waterDropped,waterWasted:Math.round(waterWasted),hearts,
    survived:s.hp>0,hp:Math.round(s.hp)};
}
const results=input.policies.flatMap(policy=>input.seeds.map(seed=>run(seed,policy)));
function summarize(){
  return input.policies.map(p=>{
    const rows=results.filter(r=>r.policy===p.id);
    const stage=[2,3,4,5].map(side=>({
      side,size:side*side,
      medianSeconds:quant(rows.map(r=>r.milestones['side'+side])),
      reached:rows.filter(r=>Number.isFinite(r.milestones['side'+side])).length
    }));
    return {
      policy:p.id,runs:rows.length,stage,
      firstWeapon:quant(rows.map(r=>r.milestones.firstWeapon)),
      firstUpgrade:quant(rows.map(r=>r.milestones.firstUpgrade)),
      first30:{
        gardenSize:quant(rows.map(r=>r.snapshots[1800]?.side)),
        harvest:quant(rows.map(r=>r.snapshots[1800]?.harvested)),
        weapons:quant(rows.map(r=>r.snapshots[1800]?.owned)),
        upgrades:quant(rows.map(r=>r.snapshots[1800]?.upgrades))
      },
      hour2:{
        gardenSize:quant(rows.map(r=>r.snapshots[7200]?.side)),
        weapons:quant(rows.map(r=>r.snapshots[7200]?.owned)),
        upgrades:quant(rows.map(r=>r.snapshots[7200]?.upgrades))
      },
      hour3:{
        gardenSize:quant(rows.map(r=>r.snapshots[10800]?.side)),
        weapons:quant(rows.map(r=>r.snapshots[10800]?.owned)),
        upgrades:quant(rows.map(r=>r.snapshots[10800]?.upgrades)),
        hp:quant(rows.map(r=>r.snapshots[10800]?.hp)),
        waterWasted:quant(rows.map(r=>r.waterWasted))
      },
      survival:rows.filter(r=>r.survived).length
    };
  });
}
const summary=summarize();
const report={schemaVersion:1,scenario:input.description,assumptions:input.assumptions,
  tuning:E.tuning,items:E.products.map(p=>({id:p.id,price:p.price,unlock:p.unlock})),
  summary,results};
const output=JSON.stringify(report,null,2);
if(process.argv.includes('--check')){
  for(const row of summary){
    assert.equal(row.runs,input.seeds.length);
    assert.equal(row.stage[3].reached,input.seeds.length);
    assert.ok(row.stage[3].medianSeconds>row.stage[0].medianSeconds,
      'expansion must take four progressively distinct purchases');
  }
  assert.ok(summary.find(x=>x.policy==='focused').firstWeapon<=300);
  assert.ok(summary.find(x=>x.policy==='casual').stage[3].medianSeconds<=2700);
  assert.ok(summary.find(x=>x.policy==='distracted').stage[3].medianSeconds<=7200);
  console.log('PASS model-based economy pacing assertions (36 runs, three hours each)');
}
if(process.argv.includes('--summary'))console.log(JSON.stringify(summary,null,2));
else if(!process.argv.includes('--check'))console.log(output);
