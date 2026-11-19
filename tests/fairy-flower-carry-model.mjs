import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/flower-carry.js','utf8'),w={GardenRunRules:{active:true}};
new Function('window',source)(w);const C=w.GardenFlowerCarry,b={left:0,right:100,top:0,bottom:100};
assert(C.enabled);assert.equal(C.speedBonus,80);assert.deepEqual(C.step({x:50,y:50},0,0,1,120,b),{x:50,y:50});
const d=C.step({x:50,y:50},1,1,.1,120,b);assert(Math.abs(Math.hypot(d.x-50,d.y-50)-12)<1e-9);
assert.deepEqual(C.step({x:50,y:50},-1,0,1,120,b),{x:0,y:50});
const a={kind:'flower',x:27,y:0},near={kind:'flower',x:3,y:4},item={kind:'item',x:0,y:0},dead={kind:'flower',x:0,y:0,consumed:true};
assert.equal(C.nearest([item,a,dead,near],{x:0,y:0}),near);
assert.equal(C.nearest([{kind:'flower',x:29,y:0}],{x:0,y:0}),null);
for(const extra of [{GardenSimulationConfig:{}},{__gardenSimHarness:true},{GardenFlowerCarryDisabled:true},{GardenRunRules:{active:false}}]){const v={GardenRunRules:{active:true},...extra};new Function('window',source)(v);assert(!v.GardenFlowerCarry.enabled);}
console.log('PASS manual motion, normalized diagonal, boundaries, pickup and isolation');
