import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const window={GardenRunRules:{survival:true}};
new Function('window',readFileSync('src/garden-economy.js','utf8'))(window);
const E=window.GardenEconomy;
assert.equal(E.enabled,true);
assert.deepEqual([44,45,54,55].map(E.indexOfCell),[0,1,2,3]);
assert.equal(E.tuning.waterCapacity,100);
assert.equal(E.tuning.waterPerDrop,20);
assert.deepEqual(E.upgradeTypes('rock'),['power','volley','speed']);
assert.deepEqual(E.upgradeTypes('boomerang'),['power','speed']);
assert.deepEqual(E.upgradeTypes('shoe'),['power']);
for(const id of E.weapons){
  assert.equal(E.upgradeLimits[id].volley,id==='rock'?3:0,'only rock offers multishot');
}
for(let side=1;side<=5;side++){
  assert.equal(E.requiredAt(0,side),side);
  assert.equal(E.requiredAt(10800,side),side,'time cannot increase minimum watering count');
  const cells=E.cellsForSide(side);
  assert.equal(cells.length,4*side*side);
  assert.equal(new Set(cells.map(([id])=>id)).size,4*side*side);
}
const m=E.create(()=>.5),s=m.state;
assert.deepEqual(s.plots.map(p=>[p.progress,p.required,p.count]),[[0,1,0],[0,1,0],[0,1,0],[0,1,0]]);
assert.equal(m.water(0),0,'empty tank');
assert.equal(m.gainWater(99),99);
assert.equal(m.water(0),0,'99/100 refused without partial consumption');
assert.equal(s.water,99);
assert.equal(m.gainWater(1),1);
assert.equal(m.water(0),1,'full MAX tank is one watering');
assert.equal(s.water,0);
assert.equal(s.plots[0].phase,'bloom');
assert.equal(s.plots[0].yield,1);
assert.equal(s.plots[1].progress,0);
assert.equal(m.water(0),0,'cannot water during bloom');
assert.equal(m.expand(),false,'cannot expand during bloom');
assert.equal(m.wilt(44),false);
assert.ok(m.tick(1.5).includes(0));
assert.equal(s.plots[0].phase,'flight');
assert.equal(s.plots[0].count,0);
assert.equal(m.expand(),false,'cannot expand during flight');
m.tick(.85);
assert.equal(s.plots[0].count,1);
assert.equal(s.plots[0].progress,0);
assert.equal(s.plots[0].phase,'growing');
assert.equal(m.available('wheel'),false);
for(const p of s.plots)p.count=10000;
assert.equal(m.purchase('wheel'),false);
for(let side=2;side<=5;side++){
  const price=m.expansionCost(),old=s.plots.map(p=>p.count);
  assert.deepEqual(price,Array(4).fill(E.tuning.expansionCosts[side-2]));
  assert.equal(m.expand(),true);
  assert.equal(s.side,side);
  assert.deepEqual(s.plots.map(p=>p.count),old.map((v,i)=>v-price[i]));
  assert.ok(s.plots.every(p=>p.required===side&&p.progress===0));
  for(let id=0;id<4;id++){
    const p=s.plots[id],prior=p.count;
    for(let charge=1;charge<=side;charge++){
      assert.equal(m.gainWater(80),80);
      assert.equal(m.water(id),0,'no partial application');
      assert.equal(p.progress,charge-1);
      assert.equal(m.gainWater(20),20);
      assert.equal(m.water(id),1);
      assert.equal(s.water,0);
      assert.equal(p.progress,charge);
      assert.equal(p.phase,charge===side?'bloom':'growing');
      assert.equal(p.count,prior,'no partial harvest');
    }
    assert.equal(p.yield,side*side);
    assert.equal(p.flowers.length,side*side);
    assert.ok(m.tick(1.5).includes(id));
    m.tick(.85);
    assert.equal(p.count,prior+side*side);
    assert.equal(p.progress,0);
  }
}
assert.equal(m.expansionCost(),null);
assert.equal(m.expand(),false);
const carry=E.create();
for(const p of carry.state.plots)p.count=10000;
assert.equal(carry.expand(),true);
carry.gainWater(100);
assert.equal(carry.water(1),1);
assert.equal(carry.expand(),true);
assert.equal(carry.state.plots[1].required,3);
assert.equal(carry.state.plots[1].progress,1,'completed watering counts survive expansion');
assert.equal(carry.state.plots[0].progress,0);
assert.ok(m.purchase('boomerang'));
assert.ok(!m.purchase('boomerang'));
assert.ok(m.purchase('sprinkler'));
for(const id of E.weapons.filter(x=>x!=='rock')){
  s.owned.add(id);
  const before=s.plots.map(p=>p.count);
  assert.equal(m.cost(id,'volley'),null,id+' must not price volley');
  assert.equal(m.upgrade(id,'volley'),false,id+' must refuse volley');
  assert.deepEqual(s.plots.map(p=>p.count),before,'invalid upgrade must not spend flowers');
  assert.equal(m.bonus(id).volley,1,id+' always emits one base projectile');
}
assert.ok(m.cost('rock','volley'),'rock retains a separate multishot cost');
assert.ok(m.upgrade('rock','power'));
assert.ok(m.upgrade('rock','volley'));
assert.ok(m.upgrade('rock','speed'));
assert.deepEqual(m.bonus('rock'),{level:2,volley:2,speed:.15});
assert.ok(m.upgrade('rock','volley'));
assert.ok(m.upgrade('rock','volley'));
assert.equal(m.bonus('rock').volley,4,'existing three volley upgrades allow four stones');
assert.equal(m.cost('rock','volley'),null,'rock volley upgrade has an upper bound');
assert.equal(m.upgrade('rock','volley'),false,'cannot exceed rock cap');
assert.ok(m.upgrade('rock','power'));
assert.equal(m.upgrade('rock','power'),false);
assert.ok(m.purchase('shield'));
assert.ok(m.upgrade('shield','power'));
assert.equal(m.defense(),12);
assert.ok(m.purchase('shoe'));
assert.ok(m.upgrade('shoe','power'));
assert.equal(m.speed(),54);
assert.equal(m.upgrade('rock','not-a-type'),false);
const hp=s.hp;
assert.ok(m.damage(100,1)>0);
assert.ok(s.hp<hp);
assert.ok(m.heal(2)>0);
// The same core model emits opt-in deterministic events for later headless simulation.
const events=[],telemetry=E.create(()=>.5,(type,data)=>events.push({type,...data}));
assert.equal(telemetry.gainWater(100),100);
assert.equal(telemetry.water(0),1);
telemetry.tick(1.5);telemetry.tick(.85);
assert.deepEqual(events.map(e=>e.type),
  ['garden_water_collect','garden_water_use','garden_bloom','garden_harvest']);
assert.equal(events[1].spent,100);
assert.equal(events[2].yield,1);
assert.equal(events[3].flowers,1);
assert.equal(events[3].stock,1);
assert.equal(events[3].time,2.35);
console.log('PASS: MAX watering, rock-only volley, no spent flowers for disabled upgrades, telemetry, harvest and HP');
