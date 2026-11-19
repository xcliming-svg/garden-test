import assert from 'node:assert/strict';
import {prepare} from '../simulation/io.mjs';
import {verifyPaceTrial} from '../simulation/browser.mjs';
const rows=await verifyPaceTrial(prepare());
const expected=[
  ['classic',16,[.795,.10,.065,.04],35,1.25,8,2],
  ['cross',18,[.72,.10,.10,.08],15,2.5,11,2],
  ['heart',27,[.75,.10,.09,.06],30,2,8,2],
  ['butterfly',33,[.69,.10,.18,.03],30,3,3,1],
  ['classic',16,[.795,.10,.065,.04],35,1.25,8,2]
];
for(const [i,r] of rows.entries()){
  assert.deepEqual([r.id,r.required,r.drops,r.cooldown,r.interval,r.cap,r.batch],expected[i]);
  if(r.id==='classic'){
    const remaining=3-r.preItems.length;assert.ok(remaining>=0&&remaining<=3);
    assert.deepEqual(r.kinds,[...Array(remaining).fill('item'),...Array(5-remaining).fill('gem')]);assert.deepEqual(r.items,[...r.preItems,...r.expectedItems]);assert.equal(r.items.length,3);
    assert.deepEqual(r.expectedItems,Array(remaining).fill(i===0?'boomerang':'rock'));
    assert.equal(r.gemsAdded,5-remaining);assert.equal(r.reasons.filter(x=>x==='stage_item_cap').length,5-remaining);
    assert.deepEqual(r.pool,['rock','boomerang']);assert.deepEqual(r.supply,{cap:3});
  }else{
    assert.equal(r.supply,null);assert.ok(r.pool.includes('water-fairy'));assert.deepEqual(r.kinds,Array(5).fill('item'));assert.equal(r.items.length,r.preItems.length+5);assert.equal(r.gemsAdded,0);
  }
  assert.equal(r.slots,4);assert.equal(r.gear,'rock');assert.ok(Math.abs(r.elapsed-10)<1e-6);assert.ok(r.spawned>=3);
}
assert.ok(rows[0].spawned>rows[3].spawned&&rows[1].spawned>rows[3].spawned&&rows[2].spawned>rows[3].spawned);
console.log('PASS devel native pace trial',JSON.stringify(rows));
