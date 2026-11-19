import assert from 'node:assert/strict';
import {sourceSet} from '../simulation/io.mjs';
import {loadModels,resolveConfig} from '../simulation/models.mjs';
const sources=sourceSet(),w=loadModels(sources),R=w.GardenRunRules,C=w.GardenCampaignV3;
assert.equal(C.stages.length,50);assert.equal(R.selectedBlueprintId,'classic');
for(const s of C.stages){
 assert(R.selectBlueprint(s.id));assert.equal(R.campaign.stage,s.stage);
 resolveConfig(loadModels(sources),s.patch);
 assert.equal(R.blueprint.length,s.blueprint.length);assert.deepEqual(R.initial,s.initial);
 assert.equal(R.tuning.maxSlots,s.patch.run.maxSlots);assert.deepEqual(R.startingGear,s.startingGear);
 assert.deepEqual(R.formations,s.formations);
 assert.equal(R.cost(R.tuning.maxSlots),null);
 const run=R.create();assert.equal(run.state.slotCount,s.patch.run.initialSlots);
 for(let i=0;i<100;i++){const c=run.pickItemCard(()=>i/100);assert(s.gearPool.some(x=>x.id===c.id&&x.level===c.level));const item=w.GardenItemCards.runItemData(c.id,c.level);assert.equal(item.level,c.level);}
 for(const [cell,name] of s.blueprint)assert(s.blueprint.some(([i,n])=>i===Math.floor(cell/10)*10+9-cell%10&&n===name));
 const occupied=new Map(s.initial.map(([i,name])=>[i,{name,stage:3}]));
 const possible=R.plantCandidates(new Set(occupied.keys()));
 for(let i=0;i<100;i++){const v=R.chooseFlower(occupied,()=>i/100);assert(s.flowerPool.includes(v));if(i<90)assert(s.blueprint.some(([k,n])=>possible.has(k)&&n===v));}
 for(let i=0;i<s.itemCap+2;i++){run.state.elapsed+=R.tuning.itemInterval+1;assert.equal(run.rewardDrop(()=>.999999),i<s.itemCap?'item':'gem');}
 assert.equal(R.completion(occupied),Math.floor(100*s.initial.length/s.blueprint.length));
}
assert(R.selectBlueprint('classic'));assert.equal(R.campaign,null);assert.equal(R.tuning.initialSlots,4);
console.log('PASS: 50 campaign configs, symmetry, supply, level draws, starter slots and legacy restoration');
