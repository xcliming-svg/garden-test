import assert from 'node:assert/strict';
import {readSurvivalSources,makeHeadlessRun,validateSurvivalCatalog,createSurvivalWindow} from '../simulation/survival-runtime.mjs';

const sources=readSurvivalSources(),w=createSurvivalWindow(sources.sources,42);
assert.equal(w.GardenRunRules.survival,true,'Never enter legacy blueprint/card mode');
assert.equal(w.GardenEconomy.enabled,true);
const c=validateSurvivalCatalog(w);
assert.equal(c.weapons.length,w.GardenEconomy.weapons.length);
assert.equal(c.enemies.length,w.GardenEnemyPreview.roster.length);
assert.deepEqual(w.GardenEconomy.weapons.filter(id=>w.GardenEconomy.upgradeLimits[id].volley>0),['rock']);
for(const side of [1,2,3,4,5]){
  assert.equal(w.GardenEconomy.cellsForSide(side).length,4*side*side);
  assert.equal(w.GardenEconomy.requiredAt(0,side),side);
}
const cfg={seed:42,seconds:60,dt:.05,policy:'idle'};
const a=makeHeadlessRun(cfg,null,sources).runTo(),b=makeHeadlessRun(cfg,null,sources).runTo();
assert.deepEqual(a,b,'Seeded headless simulation must be reproducible');
assert.ok(a.final.spawned>0,'Live wave population spawns');
assert.ok(a.final.shots>0,'Actual automatic weapon model fires');
assert.ok(a.final.hits>0,'Actual hit resolution executes');
assert.ok(a.final.waterDrops>0,'Actual enemy death loot path executes');
assert.equal(a.final.equipped[0],'rock');
assert.equal(a.final.weaponsById.rock.fired,a.final.shots);
assert.equal(a.final.enemiesById['3_caterpillar'].spawned,a.final.spawned);
assert.equal(a.final.enemiesById['3_caterpillar'].killed,a.final.killed);
assert.ok(a.final.events.survival_enemy_kill>0,'live enemy-kill telemetry');
assert.equal(a.geometry,'unmeasured-approximation');
assert.equal(a.parity,'unverified');
const focused=makeHeadlessRun({...cfg,policy:'focused'},null,sources).runTo();
assert.ok(focused.actions.every(a=>a.ok),'Chosen actions must be executable');
assert.ok(focused.final.water>=0&&focused.final.water<=100);
assert.equal(focused.final.plotStock.length,4);
assert.ok(focused.final.gardenHp>=0&&focused.final.gardenHp<=1200);
const poison={...w.GardenEconomy,upgradeLimits:{...w.GardenEconomy.upgradeLimits,balloon:{power:2,volley:1,speed:3}}};
assert.throws(()=>validateSurvivalCatalog({...w,GardenEconomy:poison}),/Non-rock multishot/);
assert.throws(()=>validateSurvivalCatalog({...w,GardenHeroWeaponPreview:{
  ...w.GardenHeroWeaponPreview,ids:w.GardenHeroWeaponPreview.ids.filter(id=>id!=='rock')}}),
  /Weapon model\/attack asset contract missing rock/);
const damagedMotion={...w.GardenEnemyMotion,profiles:{...w.GardenEnemyMotion.profiles}};
delete damagedMotion.profiles['3_caterpillar'];
assert.throws(()=>validateSurvivalCatalog({...w,GardenEnemyMotion:damagedMotion}),/Enemy profile missing/);
assert.throws(()=>validateSurvivalCatalog({...w,GardenEconomy:{
  ...w.GardenEconomy,products:[...w.GardenEconomy.products,w.GardenEconomy.products[0]]}}),
  /Duplicate product/);
assert.throws(()=>validateSurvivalCatalog({...w,GardenRunRules:{
  ...w.GardenRunRules,enemyUnlocks:w.GardenRunRules.enemyUnlocks.slice(1)}}),
  /Enemy missing survival unlock/);
assert.throws(()=>validateSurvivalCatalog({...w,GardenEconomy:{
  ...w.GardenEconomy,weapons:w.GardenEconomy.weapons.filter(id=>id!=='wheel')}}),
  /Weapon classification mismatch|Weapon missing from economy catalog/);
assert.throws(()=>makeHeadlessRun({...cfg,dt:.5},null,sources),/dt outside/);
console.log('PASS survival headless seed repeat, real spawn/fire/hit/drop, policy, 4 beds, registry guardrails',
  JSON.stringify({sourceHash:a.sourceHash,seed:cfg.seed,dt:cfg.dt,idle:a.final,focused:focused.final}));
