import assert from 'node:assert/strict';
import {sourceSet} from '../simulation/io.mjs';
import {loadModels,resolveConfig} from '../simulation/models.mjs';
import {createEngine} from '../simulation/engine.mjs';
import {play,profileFor} from '../simulation/agents.mjs';
const sources=sourceSet(),w=loadModels(sources),C='3_caterpillar',B='1_butterfly',G='2_grasshopper',P='2_gray_bug';
const patch={enemyUnlocks:[[0,C],[0,B],[0,G],[0,P]],waves:[[0,3,40,1,[[C,1]]]],formations:[[0,'pack',B,9],[.5,'ring',G,12],[1,'pincer',P,8],[1.5,'line',C,10],[2,'ring',G,30]],run:{spawnCap:40}};
const config=resolveConfig(w,patch);
assert.deepEqual(w.GardenRunRules.formations,[]);
for(const formations of [[[0,'bogus',C,1]],[[0,'ring','unknown',1]],[[0,'pack',B,41]],[[2,'line',C,1],[1,'ring',C,1]]])assert.throws(()=>resolveConfig(w,{...patch,formations}),/Invalid config/);
const run=()=>play(createEngine(loadModels(sources,config),{seed:42,dt:.05,maxSeconds:3,trace:true}),profileFor('idle'));
const r=run();assert.deepEqual(r,run());assert.equal(r.peakEnemies,40);
assert.equal(r.counts.formation_spawn,5);
for(const g of Object.values(r.byFormation)){
  assert.equal(g.requested,g.count+g.blocked);
  const actors=r.events.filter(e=>e.type==='enemy_spawn'&&e.formation===g.group);
  assert.equal(actors.length,g.count);
  assert.ok(actors.every(e=>e.species===g.species&&Number.isFinite(e.x)&&Number.isFinite(e.y)));
  assert.equal(new Set(actors.map(e=>e.x+','+e.y)).size,actors.length);
}
const pack=r.events.filter(e=>e.type==='enemy_spawn'&&e.formation===0);
assert.ok(new Set(pack.map(e=>e.x)).size>1&&new Set(pack.map(e=>e.y)).size>1,'compact 2-D flock');
const ring=r.events.filter(e=>e.type==='enemy_spawn'&&e.formation===1);
assert.equal(ring.length,12);assert.ok(new Set(ring.map(e=>e.side)).size>=6,'ring surrounds the garden');
const pincer=r.events.filter(e=>e.type==='enemy_spawn'&&e.formation===2);
const bounds=w.GardenGameLayout.spec;
assert.ok((pincer.some(e=>e.x<bounds.width*.25)&&pincer.some(e=>e.x>bounds.width*.75))||(pincer.some(e=>e.y<bounds.height*.35)&&pincer.some(e=>e.y>bounds.height*.65)),'opposite approaches');
assert.ok(r.byFormation[4].blocked>0);
console.log('PASS formations',JSON.stringify(r.byFormation));
