import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function load(survival){
  const window={location:{search:''},GardenSimulationConfig:survival?undefined:{}};
  const document={documentElement:{dataset:{playable:'true'}}};
  for(const name of ['run-rules','fairy-combinations','weapon-balance']){
    const source=readFileSync('src/'+name+'.js','utf8');
    new Function('window','document','URLSearchParams',source)(window,document,URLSearchParams);
  }
  return window;
}
const w=load(true),R=w.GardenRunRules,C=w.GardenFairyCombinations,B=w.GardenWeaponBalance;
assert.equal(R.active,true);
assert.equal(R.survival,true);
assert.equal(R.catalog.length,0);
assert.equal(R.campaign,null);
assert.equal(R.blueprint.length,0);
assert.equal(R.initial.length,84);
assert.deepEqual(R.initial.map(([id])=>id),Array.from({length:84},(_,id)=>id));
assert.equal(new Set(R.initial.map(([,flower])=>flower)).size,6);
assert.equal(R.tuning.initialSlots,20);
assert.equal(R.tuning.maxSlots,20);
assert.equal(R.create().state.slotCount,20);
assert.equal(R.cost(20),null);
assert.equal(R.create().buy(),false);
assert.equal(R.completion(new Map()),0);
assert.equal(R.selectBlueprint('stage-1'),false);
assert.equal(R.itemPool(0).length,12);
assert.ok(!R.itemPool(600).includes('water-fairy'));
assert.equal(R.rollDrop(()=>.99),'item');
assert.equal(R.rollDrop(()=>.70),'heart');
assert.equal(R.rollDrop(()=>.80),'item');
assert.equal(R.population(0),8);
assert.equal(R.population(120),65);
assert.equal(R.spawnInterval(0),1.05);
assert.equal(R.spawnInterval(600),.4);
assert.equal(R.eligibleEnemies(0).length,1);
assert.ok(R.eligibleEnemies(100).length>2);
assert.equal(C.lookup.size,78);
assert.equal(C.rows.length,55);
assert.equal(C.ids.length,12);
const keys=new Set();
for(let i=0;i<C.ids.length;i++)for(let j=i;j<C.ids.length;j++){
  const a=C.ids[i],b=C.ids[j],first=C.resolve(a,b),reverse=C.resolve(b,a);
  assert.ok(first&&reverse, 'missing '+a+' + '+b);
  assert.equal(first,reverse);
  keys.add(first.key);
  assert.ok('base' in first);
}
assert.equal(keys.size,78);
assert.equal(C.resolve('boomerang','boomerang').volley,3);
assert.equal(C.resolve('shoe','shoe').base,null);
assert.equal(C.resolve('shoe','shield').base,null);
assert.equal(C.resolve('shoe','boomerang').base,'boomerang');
assert.equal(C.resolve('paper-plane','boomerang').returning,true);
assert.equal(C.resolve('bouncy-ball','bouncy-ball').chainMax,5);
assert.equal(C.resolve('rock','paper-plane').homing,true);
assert.equal(C.resolve(null,'rock').base,'rock');
assert.equal(C.resolve(null,'shoe').base,null);
assert.equal(C.resolve(null,null),null);
assert.equal(B.stats('boomerang',1).damage,8);
assert.equal(B.stats('boomerang',1).cooldown,2.2);
assert.equal(B.stats('rock',1).damage,10);
assert.equal(B.stats('rock',1).range,280);
const legacy=load(false);
assert.equal(legacy.GardenRunRules.survival,false);
assert.equal(legacy.GardenRunRules.tuning.initialSlots,4);
assert.equal(legacy.GardenRunRules.initial.length,4);
assert.equal(legacy.GardenRunRules.rollDrop(()=>.8),'flower');
console.log('Survival model PASS: 84 full-bloom cells, unlimited 20 slots, 78 unordered fusions, fast continuous spawns, legacy simulation retained');
