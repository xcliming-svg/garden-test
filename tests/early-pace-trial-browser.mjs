import assert from 'node:assert/strict';
import {prepare} from '../simulation/io.mjs';
import {verifyPaceTrial} from '../simulation/browser.mjs';
const rows=await verifyPaceTrial(prepare());
const expected=[
  ['classic',16,[.72,.10,.10,.08],25,1.5,5,1],
  ['cross',18,[.72,.10,.10,.08],15,2.5,11,2],
  ['heart',27,[.75,.10,.09,.06],30,2,8,2],
  ['butterfly',33,[.69,.10,.18,.03],30,3,3,1],
  ['classic',16,[.72,.10,.10,.08],25,1.5,5,1]
];
for(const [i,r] of rows.entries()){
  assert.deepEqual([r.id,r.required,r.drops,r.cooldown,r.interval,r.cap,r.batch],expected[i]);
  assert.equal(r.slots,4);assert.equal(r.gear,'rock');assert.ok(Math.abs(r.elapsed-10)<1e-6);assert.ok(r.spawned>=3);
}
assert.ok(rows[0].spawned>rows[3].spawned&&rows[1].spawned>rows[3].spawned&&rows[2].spawned>rows[3].spawned);
console.log('PASS devel native pace trial',JSON.stringify(rows));
