import assert from 'node:assert/strict';
import {readSurvivalSources,makeHeadlessRun} from '../simulation/survival-runtime.mjs';
import {captureSurvivalGeometry,runSurvivalReference,compareSurvival,withSurvivalBrowser} from '../simulation/survival-browser.mjs';

const sources=readSurvivalSources(),cfg={seed:42,seconds:330,dt:.05,policy:'idle'};
const samples=[0,280,299,300,301,305,310,315,330];
const geometry=await captureSurvivalGeometry({seed:cfg.seed},sources);
const model=makeHeadlessRun(cfg,geometry,sources).runTo(cfg.seconds,samples);
const browser=await runSurvivalReference(cfg,samples);
const parity=compareSurvival(model,browser);
assert.equal(parity.status,'PASS',JSON.stringify(parity.differences.slice(0,12)));
assert.equal(model.final.events.survival_boss_spawn,1);
const appearance=await withSurvivalBrowser({seed:cfg.seed},async page=>
  page.evaluate(()=>{
    const scene=window.__survivalScene,seconds=301,dt=.05;
    window.__survivalStep=true;
    try{for(let i=0;i<Math.round(seconds/dt);i++)scene.events.emit('update',0,dt*1000);}
    finally{window.__survivalStep=false;}
    const boss=scene.enemyPreview.actors.find(a=>a.boss);
    const sprite=boss&&scene.enemyPreview.sprites.get(boss.id);
    return {bossId:boss?.boss.id,speed:boss?.entry.bossSpeed,scale:boss?.entry.scale,
      baseline:window.GardenEnemyMotion.profiles[boss?.entry.id]?.baseSpeed,
      label:scene.enemyPreview.bossLabels.get(boss?.id)?.text||'',
      banner:scene.enemyPreview.banner?.visible,
      ring:!!scene.enemyPreview.bossFx&&!!sprite,
      hp:boss?.hp,maxHp:boss?.boss.hpMax};
  }));
assert.equal(appearance.bossId,'beetle');
assert.ok(appearance.scale>1);
assert.ok(appearance.speed<appearance.baseline);
assert.match(appearance.label,/BOSS/);
assert.equal(appearance.banner,true);
assert.equal(appearance.ring,true);
console.log('PASS 330s event Phaser parity + rendered boss warning/size/ring/HP',
  JSON.stringify({seed:cfg.seed,seconds:cfg.seconds,sourceHash:model.sourceHash,
    differences:parity.differences.length,appearance}));
