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
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__economyTestGame?.scene.isActive('MainMenu'));
    const canvas=await page.locator('canvas').boundingBox();
    const point=(x,y)=>[canvas.x+x*canvas.width/960,canvas.y+y*canvas.height/540];
    await page.mouse.click(...point(480,252));
    await page.waitForFunction(()=>{
      const scene=window.__economyTestGame?.scene.getScene('Game');
      return !!scene?.gardenEconomy&&!!scene?.heroWeaponPreview&&
        !!scene?.enemyPreview&&scene.flowerGrowth?.entries.size===36;
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
    assert.deepEqual(initial.grid,[6,6]);
    assert.equal(initial.names.length,36);
    assert.deepEqual(initial.names.slice(0,6),['sunflower','sunflower','sunflower','rose','rose','rose']);
    assert.deepEqual(initial.stages,[1]);
    assert.equal(initial.actors,1);
    assert.equal(initial.slots,false);
    assert.equal(initial.gemVisible,false);
    assert.equal(initial.stats,true);
    assert.equal(initial.shopLink,true);
    assert.equal(initial.water,0);
    assert.equal(initial.hp,1000);
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

    await page.keyboard.down('Space');
    await page.waitForFunction(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      return s.fairyPatrol.paused&&s.gardenEconomy.state.plots.some(p=>p.progress>0);
    });
    const stop=await page.evaluate(()=>window.__economyTestGame.scene.getScene('Game').fairyPatrol.distance);
    await page.waitForTimeout(180);
    const distance=await page.evaluate(()=>window.__economyTestGame.scene.getScene('Game').fairyPatrol.distance);
    assert.ok(Math.abs(distance-stop)<.0001);
    await page.keyboard.up('Space');
    await page.waitForFunction(()=>!window.__economyTestGame.scene.getScene('Game').fairyPatrol.paused);

    const plotId=await page.evaluate(()=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.nearest());
    await page.evaluate(id=>{
      const s=window.__economyTestGame.scene.getScene('Game'),e=s.gardenEconomy;
      e.state.plots[id].progress=e.state.plots[id].required-.1;
      e.state.water=100;
    },plotId);
    await page.keyboard.down('Space');
    await page.waitForFunction(id=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.state.plots[id].phase==='bloom',plotId);
    await page.keyboard.up('Space');
    try{
      await page.waitForFunction(id=>window.__economyTestGame.scene.getScene('Game').gardenEconomy.state.plots[id].phase==='flight',plotId,{timeout:10000});
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
    },plotId,{timeout:10000});
    const harvest=await page.evaluate(id=>{
      const s=window.__economyTestGame.scene.getScene('Game'),p=s.gardenEconomy.state.plots[id];
      return {amount:p.count,progress:p.progress,others:s.gardenEconomy.state.plots.filter(x=>x.id!==id).map(x=>x.count),
        label:s.children.getByName('harvest-count:'+p.name)?.text};
    },plotId);
    assert.ok(harvest.amount>=1&&harvest.amount<=9);
    assert.equal(harvest.progress,0);
    assert.deepEqual(harvest.others,[0,0,0]);
    assert.equal(harvest.label,String(harvest.amount));

    await page.mouse.click(...point(890,16));
    await page.waitForFunction(()=>window.__economyTestGame.scene.isActive('GardenShop'));
    assert.equal(await page.evaluate(()=>window.__economyTestGame.scene.isPaused('Game')),true);
    assert.equal(await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('GardenShop');
      return s.children.list.filter(x=>x.name?.startsWith('garden-shop-item:')).length;
    }),12);
    await page.evaluate(()=>{
      const s=window.__economyTestGame.scene.getScene('Game');
      for(const p of s.gardenEconomy.state.plots)p.count=100;
    });
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
    console.log('PASS browser',width,height,'6x6 garden, water magnet, Space, bloom/wilt/flight, shop purchase/upgrade, simultaneous weapons');
    await page.close();
  }
} finally {
  if(browser)await browser.close();
  server.close();
}
