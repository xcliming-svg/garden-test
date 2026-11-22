// Current survival-game readiness check. Do not confuse this with the historical
// stage/card simulation CLI; that runner currently loads a non-survival mode.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {SOURCE_ORDER} from './models.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const files=['src/run-rules.js','src/garden-economy.js','src/weapon-balance.js',
  'src/enemy-preview.js','src/hero-weapon-preview.js','simulation/garden-economy-balance.mjs',
  'simulation/experiments/garden-economy-10x10.json'];
const sources=Object.fromEntries(files.map(path=>[path,readFileSync(join(root,path),'utf8')]));
const hash=createHash('sha256');
for(const path of files)hash.update(path).update('\0').update(sources[path]).update('\0');

const w={location:{search:''}};
const doc={documentElement:{dataset:{playable:'true'}}};
// Injecting GardenSimulationConfig here would silently select legacy play rules.
new Function('window','document','URLSearchParams',sources['src/run-rules.js'])(w,doc,URLSearchParams);
new Function('window',sources['src/garden-economy.js'])(w);
new Function('window','URLSearchParams',sources['src/weapon-balance.js'])(w,URLSearchParams);

assert.equal(w.GardenRunRules.survival,true,'must load real survival mode');
assert.equal(w.GardenEconomy.enabled,true);
const E=w.GardenEconomy,R=w.GardenRunRules,B=w.GardenWeaponBalance;
assert.equal(E.products.length,12,'expected 10 weapons and 2 passives');
assert.equal(E.weapons.length,10);
assert.equal(E.tuning.waterCapacity,100);
assert.equal(E.tuning.waterPerDrop,20);
assert.deepEqual([1,2,3,4,5].map(side=>E.requiredAt(10800,side)),[1,2,3,4,5]);
for(const item of E.products){
  assert.ok(E.upgradeLimits[item.id],'new item must be registered with upgrade limits');
  assert.equal(E.upgradeLimits[item.id].volley,item.id==='rock'?3:0,
    'only rocks can have multishot upgrades');
  if(item.weapon)assert.ok(B.stats(item.id,1),'weapon missing from actual damage model');
}
assert.deepEqual(E.upgradeTypes('rock'),['power','volley','speed']);
const events=[],model=E.create(()=>.5,(type,data)=>events.push({type,...data}));
assert.equal(model.gainWater(100),100);
assert.equal(model.water(0),1);
model.tick(E.tuning.bloomHold);
model.tick(E.tuning.flightDuration);
assert.deepEqual(events.map(x=>x.type),
  ['garden_water_collect','garden_water_use','garden_bloom','garden_harvest']);
assert.equal(model.state.plots[0].count,1);
assert.equal(model.state.water,0);

const experiment=JSON.parse(sources['simulation/experiments/garden-economy-10x10.json']);
assert.equal(experiment.schemaVersion,1);
assert.ok(experiment.durationSeconds>=3600);
assert.ok(experiment.seeds.length>=4);
assert.ok(experiment.policies.length>=2);
assert.ok(experiment.policies.every(p=>p.id&&p.cycleSeconds>0&&p.waterWindow>0));
assert.ok(experiment.snapshots.includes(3600));
assert.ok(!SOURCE_ORDER.includes('garden-economy'),
  'legacy simulator was upgraded: reconsider mode separation before using this report');

const report={
  status:'PASS',
  scope:'current-single-difficulty-survival',
  sourceHash:hash.digest('hex'),
  rules:{flowerSpecies:E.names,waterPerDrop:E.tuning.waterPerDrop,
    maxTank:E.tuning.waterCapacity,maxGardenSize:E.tuning.maxSide,
    maxRocksPerVolley:1+E.upgradeLimits.rock.volley,
    multishotEligible:E.weapons.filter(id=>E.upgradeLimits[id].volley>0)},
  simulation:{
    economy:'AVAILABLE - production economy and spawn rules, approximate combat/attention',
    battle:'NOT YET AVAILABLE - no validated full combat headless parity',
    oldCli:'LEGACY ONLY - simulation/cli.mjs uses GardenSimulationConfig and stage/card economy',
    liveTelemetry:'ENABLED ON OPT-IN window.GardenSimulationEvent',
    waterFairy:'NOT IN THE CURRENT FLOWER-ECONOMY GAME',
    scenario:'simulation/experiments/garden-economy-10x10.json'
  },
  commands:[
    'node simulation/survival-preflight.mjs',
    'node tests/garden-economy-model.mjs',
    'node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --check',
    'node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --summary',
    'node tests/garden-economy-browser.mjs'
  ]
};
console.log(JSON.stringify(report,null,2));
