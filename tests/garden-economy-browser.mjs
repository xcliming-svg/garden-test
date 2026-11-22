import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8',
  '.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';
    if(path.includes('..'))return res.writeHead(404).end();
    let data=readFileSync(path==='phaser.js'?phaser:join(process.cwd(),path));
    if(path==='index.html')data=data.toString().replace(
      'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
    if(path==='src/main.js')data=data.toString().replace(
      "  window.addEventListener('resize',",
      "  window.__economyTestGame = game;\n  window.addEventListener('resize',");
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(data);
  }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [width,height] of [[960,540],[1280,720]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>{errors.push(String(e.stack||e));console.error('PAGE ERROR',e.stack||String(e));});
    page.on('requestfailed',r=>errors.push('request failed '+r.url()));
    // Stabilize the expected 97% water / 3% heart drop for this integration path.
    await page.addInitScript(()=>{window.GardenSimulationRng={drop:()=>.5};});
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__economyTestGame?.scene.isActive('MainMenu'));
    const canvas=await page.locator('canvas').boundingBox();
    const point=(x,y)=>[canvas.x+x*canvas.width/960,canvas.y+y*canvas.height/540];
    await page.mouse.click(...point(480,252));
    await page.waitForFunction(()=>{
      const scene=window.__economyTestGame?.scene.getScene('Game');
      return !!scene?.gardenEconomy&&!!scene?.heroWeaponPreview&&
        !!scene?.enemyPreview&&scene.flowerGrowth?.entries.size===4;
    },null,{timeout:60000});
    const initial=await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game'),g=window.GardenGameLayout.spec.garden;
      return {grid:[g.columns,g.rows],names:[...s.flowerGrowth.entries.values()].map(x=>x.name),
        stages:[...new Set([...s.flowerGrowth.entries.values()].map(x=>x.stage))],
        actors:s.fairyPatrol.actors.length,slots:!!s.children.getByName('preview-slot:0'),
        gemVisible:s.children.getByName('hud-gem-icon').visible,
        stats:['dps','defense','moveSpeed'].every(k=>!!s.children.getByName('stat-value:'+k)),
        shopLink:!!s.children.getByName('garden-shop-link'),
        water:s.gardenEconomy.state.water,
        hp:s.gardenEconomy.state.hp,
        weapon:s.heroWeaponPreview.model.state.equipped[0],
        noRunDrops:!s.runDrops};
    });
    assert.deepEqual(initial.grid,[10,10]);
    assert.equal(initial.names.length,4);
    assert.deepEqual(initial.names,['sunflower','rose','hydrangea','lavender']);
    assert.deepEqual(initial.stages,[1]);
    assert.equal(initial.actors,1);
    assert.equal(initial.slots,false);
    assert.equal(initial.gemVisible,false);
    assert.equal(initial.stats,true);
    assert.equal(initial.shopLink,true);
    assert.equal(initial.water,0);
    assert.equal(initial.hp,1200);
    assert.equal(initial.weapon,'rock');
    assert.equal(initial.noRunDrops,true);

    const killed=await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game'),m=s.enemyPreview.model;
      if(!m.actors.length)m.advance(0);
      const enemy=m.actors[0],before=s.relicCollection.state.drops.length;
      const result=m.damage(enemy.id,99999);
      const drops=s.relicCollection.state.drops;
      if(drops.length>before){
        drops.at(-1).x=s.fairyPatrol.actors[0].center.x;
        drops.at(-1).y=s.fairyPatrol.actors[0].center.y;
      }
      return {killed:result?.killed,kind:drops.at(-1)?.kind};
    });
    assert.equal(killed.killed,true);
    assert.equal(killed.kind,'water','dead enemy must drop an actual water relic');
    await page.waitForFunction(()=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.state.water>0,
      null,{timeout:10000});

    const plotId=await page.evaluate(()=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.nearest());
    await page.keyboard.down('Space');
    await page.waitForTimeout(150);
    const partial=await page.evaluate(id=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      return {water:s.gardenEconomy.state.water,progress:s.gardenEconomy.state.plots[id].progress,
        paused:s.fairyPatrol.paused};
    },plotId);
    assert.deepEqual(partial,{water:20,progress:0,paused:false},'non-MAX cannot water or stop patrol');
    await page.keyboard.up('Space');

    await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      s.gardenEconomy.gainWater(80);
    });
    await page.keyboard.down('Space');
    const poured=await page.evaluate(id=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      return {water:s.gardenEconomy.state.water,phase:s.gardenEconomy.state.plots[id].phase,
        progress:s.gardenEconomy.state.plots[id].progress,
        paused:s.fairyPatrol.paused};
    },plotId);
    assert.deepEqual(poured,{water:0,phase:'bloom',progress:1,paused:true},
      'one MAX tank must drain completely and bloom first 1/1 bed');
    const stop=await page.evaluate(()=>window.__economyTestGame.scene.getScene('Game').fairyPatrol.distance);
    await page.waitForTimeout(140);
    const distance=await page.evaluate(()=>window.__economyTestGame.scene.getScene('Game').fairyPatrol.distance);
    assert.ok(Math.abs(distance-stop)<.0001,'fairy must briefly stop to pour');
    await page.keyboard.up('Space');
    await page.waitForFunction(()=>!window.__economyTestGame.scene.getScene('Game').fairyPatrol.paused,
      null,{timeout:20000});
    try{
      await page.waitForFunction(id=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.state.plots[id].phase==='flight',plotId,{timeout:45000});
    }catch(e){
      const state=await page.evaluate(id=>{
        const g=window.__economyTestGame,s=g.scene.getScene('Game'),h=s.gardenEconomy;
        return {active:g.scene.isActive('Game'),paused:g.scene.isPaused('Game'),
          elapsed:h.state.elapsed,plot:h.state.plots[id],water:h.state.water,
          held:s.fairyPatrol.paused,sceneState:s.run.state.result,
          flights:s.children.list.filter(x=>x.name?.startsWith('garden-harvest-flight:')).length};
      },plotId);
      throw Error('Harvest flight not observed: '+JSON.stringify({state,errors,error:String(e)}));
    }
    const flying=await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      return s.children.list.filter(x=>x.name?.startsWith('garden-harvest-flight:')).length;
    });
    assert.ok(flying>=1,'bloom must visibly fly toward inventory');
    await page.waitForFunction(id=>{
      const s=window.__economyTestGame.scene.getScene('Game'),p=s.gardenEconomy.state.plots[id];
      return p.phase==='growing'&&p.count>=1;
    },plotId,{timeout:45000});
    const harvest=await page.evaluate(id=>{
      const s=window.__economyTestGame.scene.getScene('Game'),p=s.gardenEconomy.state.plots[id];
      return {amount:p.count,progress:p.progress,others:s.gardenEconomy.state.plots.filter(x=>x.id!==id).map(x=>x.count),
        label:s.children.getByName('harvest-count:'+p.name)?.text};
    },plotId);
    assert.equal(harvest.amount,1,'one flower per initial bed');
    assert.equal(harvest.progress,0);
    assert.deepEqual(harvest.others,[0,0,0]);
    assert.equal(harvest.label,String(harvest.amount));

    await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      for(const p of s.gardenEconomy.state.plots)p.count=10000;
    });
    await page.mouse.click(...point(890,16));
    await page.waitForFunction(()=>window.__economyTestGame.scene.isActive('GardenShop'));
    assert.equal(await page.evaluate(()=>window.__economyTestGame.scene.isPaused('Game')),true);
    assert.equal(await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('GardenShop');
      return s.children.list.filter(x=>x.name?.startsWith('garden-shop-item:')).length;
    }),12);
    for(let side=2;side<=5;side++){
      await page.mouse.click(...point(755,300));
      await page.waitForFunction(expected=>{
        const s=window.__economyTestGame.scene.getScene('Game');
        return s.gardenEconomy.state.side===expected&&
          s.flowerGrowth.entries.size===4*expected*expected&&
          s.fairyPatrol.occupied.length===4*expected*expected;
      },side,{timeout:45000});
    }
    const expanded=await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      return {flowers:s.flowerGrowth.entries.size,side:s.gardenEconomy.state.side,
        species:[0,1,2,3].map(i=>[...s.flowerGrowth.entries.values()].filter(x=>x.name===window.GardenEconomy.names[i]).length),
        price:s.gardenEconomy.expansionCost()};
    });
    assert.deepEqual(expanded,{flowers:100,side:5,species:[25,25,25,25],price:null});
    assert.deepEqual(await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      return s.gardenEconomy.state.plots.map(p=>[p.progress,p.required]);
    }),[[0,5],[0,5],[0,5],[0,5]],'max garden requires five MAX applications per bed');
    await page.mouse.click(...point(198+185,135));
    await page.waitForFunction(()=>window.__economyTestGame.scene.getScene('GardenShop').selected==='boomerang');
    await page.mouse.click(...point(735,402));
    await page.waitForFunction(()=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.state.owned.has('boomerang'));
    await page.mouse.click(...point(198,135));
    await page.waitForFunction(()=>window.__economyTestGame.scene.getScene('GardenShop').selected==='rock');
    await page.mouse.click(...point(200,458));
    await page.waitForFunction(()=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.bonus('rock').level===2);
    const owned=await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      return {boomerang:s.heroWeaponPreview.model.state.equipped[1],
        rock:s.heroWeaponPreview.model.state.equipped[0],level:s.heroWeaponPreview.model.state.levels[0]};
    });
    assert.deepEqual(owned,{boomerang:'boomerang',rock:'rock',level:2});
    await page.mouse.click(...point(812,66));
    await page.waitForFunction(()=>window.__economyTestGame.scene.isActive('Game'));
    assert.equal(await page.evaluate(()=>window.__economyTestGame.scene.isActive('GardenShop')),false);
    assert.deepEqual(errors,[],JSON.stringify(errors));
    console.log('PASS browser',width,height,'1–5 full-MAX water count, garden growth, harvest, shop and all owned weapons');
    await page.close();
  }
} finally {
  if(browser)await browser.close();
  server.close();
}
