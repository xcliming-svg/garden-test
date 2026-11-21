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
      "  window.__harvestTestGame = game;\n  window.addEventListener('resize',");
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(data);
  }catch(error){res.writeHead(500).end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [width,height,plot,harvest] of [
    [960,540,'a','auto'],[960,540,'a','space'],
    [960,540,'c','auto'],[960,540,'c','space'],
    [1280,720,'a','auto']
  ]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>{errors.push(String(e.stack||e));console.error('PAGE ERROR',String(e.stack||e));});
    page.on('requestfailed',r=>{errors.push('request failed '+r.url());});
    const url='http://127.0.0.1:'+server.address().port+'/?plot='+plot+'&harvest='+harvest;
    await page.goto(url);
    await page.waitForFunction(()=>window.__harvestTestGame?.scene.isActive('MainMenu'));
    const canvas=await page.locator('canvas').boundingBox();
    const point=(x,y)=>[canvas.x+x*canvas.width/960,canvas.y+y*canvas.height/540];
    await page.mouse.click(...point(480,252));
    await page.waitForFunction(()=>{
      const s=window.__harvestTestGame?.scene.getScene('Game');
      return !!s?.gardenHarvest&&s?.flowerGrowth?.entries.size===36&&!!s.enemyPreview;
    },null,{timeout:60000});
    const initial=await page.evaluate(()=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),g=window.GardenGameLayout.spec.garden;
      const flowers=[...s.flowerGrowth.entries.entries()];
      return {config:s.gardenHarvest.config,width:g.width,height:g.height,columns:g.columns,rows:g.rows,
        farm:window.GardenHarvest.enabled,flowerCount:flowers.length,
        visible:flowers.filter(([,f])=>f.image.visible).length,
        stages:[...new Set(flowers.map(([,f])=>f.stage))],
        textures:[...new Set(flowers.map(([,f])=>f.image.texture.key))],
        maxWidth:Math.max(...flowers.filter(([,f])=>f.image.visible).map(([,f])=>f.image.displayWidth)),
        actorCount:s.fairyPatrol.actors.length,weapon:!!s.heroWeaponPreview,
        autoAttack:!!s.enemyPreview.attack,slot:!!s.children.getByName('preview-slot:0'),
        gemVisible:s.children.getByName('hud-gem-icon').visible,
        drops:!!s.runDrops,
        labels:window.GardenHarvest.names.map(n=>s.children.getByName('harvest-count:'+n)?.text),
        droplet:!!s.children.getByName('harvest-water-droplet')};
    });
    assert.deepEqual(initial.config,{plot,harvest});
    assert.equal(initial.farm,true);
    assert.equal(initial.columns,6);assert.equal(initial.rows,6);
    assert.equal(initial.width,139);assert.equal(initial.height,139);
    assert.equal(initial.flowerCount,36);
    assert.equal(initial.visible,plot==='a'?4:36);
    assert.deepEqual(initial.stages,[1]);
    assert.ok(initial.textures.every(t=>t.includes(':1:100')));
    assert.equal(initial.actorCount,1,'only leaf fairy walks');
    assert.equal(initial.weapon,false,'paired weapon controller removed');
    assert.equal(initial.autoAttack,true,'leaf fairy itself attacks enemies');
    assert.equal(initial.slot,false,'20 weapon slot controls removed');
    assert.equal(initial.gemVisible,false,'gem icon removed');
    assert.equal(initial.drops,false,'item/gem spawning disabled');
    assert.equal(initial.droplet,true);
    assert.deepEqual(initial.labels,['해바라기 0','장미 0','수국 0','라벤더 0']);

    const killed=await page.evaluate(()=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),m=s.enemyPreview.model;
      if(!m.actors.length)m.advance(0);
      const enemy=m.actors[0],old=s.gardenHarvest.state.water;
      const result=m.damage(enemy.id,99999);
      return {result,old,water:s.gardenHarvest.state.water,gems:s.run.state.gems,drops:s.relicCollection.state.drops.length};
    });
    assert.equal(killed.result.killed,true,'enemy death');
    assert.equal(killed.water-killed.old,20,'enemy kill directly fills droplet');
    assert.equal(killed.gems,0,'no gem credited');
    assert.equal(killed.drops,0,'no gem ground drop');

    const id=await page.evaluate(()=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),h=s.gardenHarvest;
      return h.nearest();
    });
    await page.keyboard.down('Space');
    await page.waitForFunction(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game');
      return s.fairyPatrol.paused&&s.gardenHarvest.state.plots[id].progress>0;
    },id,{timeout:10000});
    const stop=await page.evaluate(()=>window.__harvestTestGame.scene.getScene('Game').fairyPatrol.distance);
    await page.waitForTimeout(180);
    const distance=await page.evaluate(()=>window.__harvestTestGame.scene.getScene('Game').fairyPatrol.distance);
    assert.ok(Math.abs(distance-stop)<1e-5,'Space holds the leaf fairy still');
    await page.keyboard.up('Space');
    await page.waitForFunction(()=>!window.__harvestTestGame.scene.getScene('Game').fairyPatrol.paused);

    const stages=await page.evaluate(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),h=s.gardenHarvest;
      const crop=h.state.plots[id],flower=s.flowerGrowth.entries.get(window.GardenHarvest.centerCell(id));
      crop.progress=40;s.flowerGrowth.render(0);
      const middle={stage:flower.stage,key:flower.image.texture.key};
      crop.progress=90;s.flowerGrowth.render(0);
      const blooming={stage:flower.stage,key:flower.image.texture.key};
      crop.progress=0;s.flowerGrowth.render(0);
      return {middle,blooming};
    },id);
    assert.equal(stages.middle.stage,2);
    assert.ok(stages.middle.key.endsWith(':2:100'));
    assert.equal(stages.blooming.stage,3);
    assert.ok(stages.blooming.key.endsWith(':3:100'));

    // A nearly mature plot must harvest either immediately or on the next
    // distinct Space press, never produce nine items.
    await page.evaluate(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),h=s.gardenHarvest;
      h.state.plots[id].progress=99;
      h.state.water=40;
    },id);
    await page.keyboard.down('Space');
    if(harvest==='auto'){
      await page.waitForFunction(id=>{
        const s=window.__harvestTestGame.scene.getScene('Game');
        return s.gardenHarvest.state.plots[id].count===1;
      },id,{timeout:15000});
      await page.keyboard.up('Space');
    }else{
      await page.waitForFunction(id=>{
        const s=window.__harvestTestGame.scene.getScene('Game');
        return s.gardenHarvest.state.plots[id].progress===100;
      },id,{timeout:15000});
      const ready=await page.evaluate(id=>{
        const s=window.__harvestTestGame.scene.getScene('Game');
        return {count:s.gardenHarvest.state.plots[id].count,visible:s.children.getByName('harvest-ready:'+id).visible};
      },id);
      assert.equal(ready.count,0,'fully bloomed plots remain unsold');
      assert.equal(ready.visible,true,'ready indicator on mature plot');
      await page.keyboard.up('Space');
      await page.keyboard.down('Space');
      await page.waitForFunction(id=>{
        const s=window.__harvestTestGame.scene.getScene('Game');
        return s.gardenHarvest.state.plots[id].count===1;
      },id,{timeout:15000});
      await page.keyboard.up('Space');
    }
    const result=await page.evaluate(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),h=s.gardenHarvest;
      const plot=h.state.plots[id];
      return {count:plot.count,progress:plot.progress,
        label:s.children.getByName('harvest-count:'+plot.name).text,
        bonus:s.children.getByName('harvest-bonus').text,
        others:h.state.plots.filter(p=>p.id!==id).map(p=>p.count),
        actorCount:s.fairyPatrol.actors.length,
        error:!s.scene.isActive};
    },id);
    assert.equal(result.count,1,'one plot harvest gives exactly one item');
    assert.equal(result.progress,0,'plot resets to leaf stage');
    assert.ok(result.label.endsWith(' 1'));
    assert.equal(result.bonus,'+1');
    assert.deepEqual(result.others,[0,0,0],'other three plot inventories unaffected');
    assert.equal(result.actorCount,1);
    assert.deepEqual(errors,[],'browser errors '+JSON.stringify({plot,harvest,width,height}));
    console.log('Garden harvest PASS',width,height,plot,harvest,'kill → water → Space stop/water → 3 growth art stages → one harvest');
    await page.close();
  }
}finally{
  if(browser)await browser.close();
  server.close();
}
