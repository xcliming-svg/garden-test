import assert from 'node:assert/strict';
import {readSurvivalSources,createSurvivalWindow,makeHeadlessRun} from '../simulation/survival-runtime.mjs';

const source=readSurvivalSources(),events=[];
const w=createSurvivalWindow(source.sources,42,(type,data)=>events.push({type,...data}));
const S=w.GardenSurvivalEvents,M=w.GardenEnemyMotion;
const bosses=[5,15,30,45,60,75,90,105,120,135,150,165,180,240];
for(const minute of bosses){
  const e=S.atMinute(minute);
  assert.equal(e.kind,'boss','Missing boss at '+minute);
}
assert.equal(S.atMinute(10).id,'swarm');
assert.equal(S.atMinute(20).id,'surround');
assert.equal(S.atMinute(25).id,'air');
assert.equal(S.atMinute(35).id,'tunnel');
assert.equal(S.atMinute(40).id,'shield');
assert.equal(S.atMinute(50).id,'charge');
assert.equal(S.atMinute(55).id,'double');
assert.equal(S.atMinute(65).id,'surround');
assert.equal(S.atMinute(110).id,'tunnel-air');
assert.equal(S.atMinute(115).id,'surround-shield');
assert.equal(S.atMinute(180).id,'monarch');
assert.equal(S.atMinute(180).tier,2);
assert.equal(S.atMinute(240).tier,3);
assert.equal(S.atMinute(0),null);
assert.equal(S.atMinute(3),null);
for(const enemy of w.GardenEnemyPreview.roster){
  const normal=M.profiles[enemy.id].baseSpeed;
  assert.equal(M.speed(enemy,0),normal,'Normal min speed changed '+enemy.id);
  assert.equal(M.speed(enemy,5),normal*1.5,'Normal max speed changed '+enemy.id);
}
for(const [id,boss] of Object.entries(S.bosses)){
  const ordinary=M.profiles[boss.enemy].baseSpeed;
  assert.ok(boss.speed<ordinary,'Boss must move slower than its species '+id);
  assert.equal(M.speed({id:boss.enemy,bossSpeed:boss.speed},0),boss.speed);
  assert.equal(M.speed({id:boss.enemy,bossSpeed:boss.speed},5),boss.speed);
}
const timeline=S.create((type,data)=>events.push({type,...data}));
timeline.advance(279.9);assert.equal(timeline.warning,null);
timeline.advance(280);assert.equal(timeline.warning?.minute,5);
timeline.advance(299.95);assert.equal(timeline.active,null);
timeline.advance(300);
assert.equal(timeline.active?.boss.enemy,'4_beetle');
timeline.advance(390);assert.equal(timeline.active,null);
timeline.advance(580);assert.equal(timeline.warning?.id,'swarm');
timeline.advance(600);assert.equal(timeline.active?.id,'swarm');
assert.equal(events.filter(e=>e.type==='survival_event_start').length,2);
const runner=makeHeadlessRun({seed:42,seconds:330,dt:.05,policy:'idle'},null,source);
const report=runner.runTo(330,[280,300,305,330]);
assert.ok(report.final.events.survival_event_warning>=1);
assert.equal(report.final.events.survival_event_start,1);
assert.equal(report.final.events.survival_boss_spawn,1);
assert.ok(report.final.spawned>0);
assert.ok(report.final.gardenHp>=0);
console.log('PASS survival hostile timeline, baseline speeds, boss override and 330s combat',
  JSON.stringify({sourceHash:source.sourceHash,seed:42,seconds:330,
    bossSpawns:report.final.events.survival_boss_spawn,final:report.final}));


const long=makeHeadlessRun({seed:42,seconds:10800,dt:.1,policy:'focused'},null,source)
  .runTo(10800,[300,900,1800,3600,7200,10800]);
const reached=Math.floor((long.final.time+1e-7)/300);
assert.equal(long.final.events.survival_event_start||0,reached,
  'Long-run events must start once at each reached five-minute mark');
assert.ok((long.final.events.survival_boss_spawn||0)<=
  (long.final.events.survival_event_start||0),'Boss count cannot exceed events');
for(const event of ['survival_event_warning','survival_event_start'])
  assert.ok((long.final.events[event]||0)>=1,'Missing long-run event '+event);
console.log('PASS 180-minute hostile headless run (not browser parity)',
  JSON.stringify({seed:42,policy:'focused',dt:.1,requested:10800,completed:long.final.time,
    outcome:long.outcome,spawned:long.final.spawned,killed:long.final.killed,
    eventStarts:long.final.events.survival_event_start||0,
    bossSpawns:long.final.events.survival_boss_spawn||0,
    bossKills:long.final.events.survival_boss_kill||0,
    bossEscapes:long.final.events.survival_boss_escape||0,
    remainingGardenHp:long.final.gardenHp,sourceHash:long.sourceHash}));
