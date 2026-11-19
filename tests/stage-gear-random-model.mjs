import assert from 'node:assert/strict';
import {join} from 'node:path';
import {prepare,root,readJson,saveJson} from '../simulation/io.mjs';
import {evaluateStage,compareStage} from '../simulation/experiments/stage-gear-search.mjs';
const folder=join(root,'simulation','experiments');
const p=readJson(join(folder,'stage-gear-cap-candidate.json'))[0],geometry=readJson(join(folder,'stage-gear-geometry.json'));
const {sources}=prepare();
const agent=process.argv[2]??'normal',dt=Number(process.argv[3]??.05);
const opts={seed:dt===.025?28101:27101,runs:16,agent,dt};
const before=evaluateStage(sources,geometry,null,opts);
const after=evaluateStage(sources,geometry,p,{...opts,sequence:false,itemCap:3});
const assessment=compareStage(after,before);
assert.ok(after.rows.every(r=>r.items<=3&&r.itemNames.every(n=>['rock','boomerang'].includes(n))));
const sequences=[...new Set(after.rows.map(r=>r.itemNames.join(',')))];
assert.ok(sequences.length>1,'randomized runs need varied sequences');
const report={agent,dt,simulations:32,before,after,assessment,sequences};
console.log('RANDOM STAGE '+JSON.stringify({agent,dt,wins:after.wins,third:after.thirdSeen,items:after.items.p50,time:[before.seconds.p50,after.seconds.p50],alive:[before.alive60.p50,after.alive60.p50],kills:[before.kills60.p50,after.kills60.p50],gap:[before.gap.p90,after.gap.p90],assessment,sequences}));
if(process.argv[4])saveJson(process.argv[4],report);
// Historical pace gates are reported rather than hiding a failed criterion.
// Removing the forced order is a requirement, not a tunable gate.
