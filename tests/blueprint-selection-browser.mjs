import assert from 'node:assert/strict';
import {prepare} from '../simulation/io.mjs';
import {verifyBlueprintSelector,captureGeometry,runBrowser} from '../simulation/browser.mjs';
import {loadModels} from '../simulation/models.mjs';
import {createEngine} from '../simulation/engine.mjs';
import {profileFor,play} from '../simulation/agents.mjs';
const p=prepare(),w=loadModels(p.sources),catalog=w.GardenRunRules.catalog;
const result=await verifyBlueprintSelector(p);
for(const key of ['heart','butterfly']){
  const pattern=catalog.find(x=>x.id===key),r=result[key];
  assert.equal(r.id,key);assert.equal(r.cells,pattern.blueprint.length);
  assert.deepEqual(r.initial,pattern.initial);assert.equal(r.icons,pattern.blueprint.length);
  assert.equal(r.occupied,4);assert.equal(r.selects,0);
}
assert.equal(result.menu.value,'heart');assert.deepEqual(result.menu.options,catalog.map(x=>x.id));
console.log('PASS native blueprint selector',JSON.stringify(result));
const pattern=catalog.find(x=>x.id==='heart'),patch={initial:pattern.initial,blueprint:pattern.blueprint};
const geometry=await captureGeometry(p),q=prepare(patch,geometry),opts={seed:42,dt:.05,maxSeconds:90};
const model=play(createEngine(loadModels(q.sources,q.config),{...opts,geometry}),profileFor('normal'));
const browser=await runBrowser(q,profileFor('normal'),opts);
assert.equal(browser.required,pattern.blueprint.length);
assert.ok(browser.actions.some(a=>a.type==='DRAG_END'&&a.ok));
const fields=['completed','kills','spawned','shots','hits','damage','gems'];
const compare=Object.fromEntries(fields.map(k=>[k,{model:model[k],browser:browser[k],equal:model[k]===browser[k]}]));
console.log('BLUEPRINT ACTIVE PARITY',JSON.stringify(compare));
