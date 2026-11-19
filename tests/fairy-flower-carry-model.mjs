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

const q=[];assert.deepEqual(Array.from({length:7},()=>C.fifoSlot(q)),[0,1,2,3,0,1,2]);assert.deepEqual(q,[3,0,1,2]);
assert(C.isInstallation('sprinkler'));assert(!C.isInstallation('rock'));
assert.equal(C.nearest([{kind:'item',id:'sprinkler',x:2,y:0}],{x:0,y:0}).id,'sprinkler');
assert.equal(C.nearest([{kind:'item',id:'rock',x:2,y:0}],{x:0,y:0},C.automatic).id,'rock');
const spec={width:300,height:300,top:0,bottom:0,garden:{x:50,y:50,pitch:20,columns:10,rows:10}};
const pt={x:140,y:140};assert.equal(C.installationCell(spec,pt),44);assert(C.installationSafe(spec,pt,[45,54,55]));assert(!C.installationSafe(spec,pt,[44]));assert(C.installationSafe(spec,{x:20,y:20},Array.from({length:100},(_,i)=>i)));
console.log('PASS FIFO and installation on empty cells, occupied rejection, exterior at full garden');
