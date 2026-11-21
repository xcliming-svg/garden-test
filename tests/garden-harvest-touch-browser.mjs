import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

// Serve the actual Phaser game and bundle, replacing only the CDN dependency
// with the same installed Phaser version and exposing the running game to tests.
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
    [390,844,'a','auto'],[390,844,'a','space'],
    [390,844,'c','auto'],[390,844,'c','space'],
    [844,390,'a','auto']
  ]){
    const context=await browser.newContext({
      viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e.stack||e)));
    page.on('requestfailed',r=>errors.push('request failed '+r.url()));
    const url='http://127.0.0.1:'+server.address().port+'/?plot='+plot+'&harvest='+harvest;
    await page.goto(url);
    await page.waitForFunction(()=>window.__harvestTestGame?.scene.isActive('MainMenu'));
    const box=await page.locator('canvas').boundingBox();
    const point=(x,y)=>({x:box.x+x*box.width/960,y:box.y+y*box.height/540});
    const center=point(480,252),hold=point(700,390);
    await page.touchscreen.tap(center.x,center.y);
    await page.waitForFunction(()=>{
      const s=window.__harvestTestGame?.scene.getScene('Game');
      return !!s?.gardenHarvest&&s?.flowerGrowth?.entries.size===36;
    },null,{timeout:30000});
    assert.deepEqual(await page.evaluate(()=>window.GardenHarvest.config),{plot,harvest});
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#game canvas')).touchAction),'none');

    const cdp=await context.newCDPSession(page);
    const down=()=>cdp.send('Input.dispatchTouchEvent',{
      type:'touchStart',touchPoints:[{id:1,...hold,radiusX:2,radiusY:2}]
    });
    const up=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const cancel=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    const id=await page.evaluate(()=>{
      const s=window.__harvestTestGame.scene.getScene('Game');
      const h=s.gardenHarvest;
      h.state.water=40;
      return h.nearest();
    });

    // Desktop mouse clicks must not act like mobile watering taps.
    await page.mouse.move(hold.x,hold.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.__harvestTestGame.scene.getScene('Game').fairyPatrol.paused),false,
      'mouse down is not a touch hold');
    await page.mouse.up();

    await down();
    await page.waitForFunction(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game');
      return s.fairyPatrol.paused&&s.gardenHarvest.state.plots[id].progress>0;
    },id,{timeout:10000});
    const before=await page.evaluate(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game');
      return {distance:s.fairyPatrol.distance,water:s.gardenHarvest.state.water,
        growth:s.gardenHarvest.state.plots[id].progress};
    },id);
    await page.waitForTimeout(220);
    const holding=await page.evaluate(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game');
      return {distance:s.fairyPatrol.distance,water:s.gardenHarvest.state.water,
        growth:s.gardenHarvest.state.plots[id].progress};
    },id);
    assert.ok(Math.abs(before.distance-holding.distance)<1e-5,'touch keeps fairy stationary');
    assert.ok(holding.water<before.water,'touch consumes droplet water');
    assert.ok(holding.growth>before.growth,'touch grows nearest plot');
    await up();
    await page.waitForFunction(()=>!window.__harvestTestGame.scene.getScene('Game').fairyPatrol.paused);
    const released=await page.evaluate(()=>window.__harvestTestGame.scene.getScene('Game').fairyPatrol.distance);
    await page.waitForTimeout(220);
    const walking=await page.evaluate(()=>window.__harvestTestGame.scene.getScene('Game').fairyPatrol.distance);
    assert.ok(Math.abs(walking-released)>1,'fairy resumes walking on touch release');

    // Water a 99% plot, then verify manual harvest is a *second* touch.
    const next=await page.evaluate(()=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),h=s.gardenHarvest,id=h.nearest();
      h.state.water=40;
      h.state.plots[id].progress=99;
      return id;
    });
    await down();
    if(harvest==='auto'){
      await page.waitForFunction(id=>
        window.__harvestTestGame.scene.getScene('Game').gardenHarvest.state.plots[id].count===1,
      next,{timeout:10000});
      await page.waitForTimeout(180);
      const once=await page.evaluate(id=>{
        const s=window.__harvestTestGame.scene.getScene('Game');
        return {count:s.gardenHarvest.state.plots[id].count,progress:s.gardenHarvest.state.plots[id].progress};
      },next);
      assert.deepEqual(once,{count:1,progress:0},'auto harvest happens once per touch hold');
      await up();
    }else{
      await page.waitForFunction(id=>{
        const plot=window.__harvestTestGame.scene.getScene('Game').gardenHarvest.state.plots[id];
        return plot.progress===100;
      },next,{timeout:10000});
      assert.equal(await page.evaluate(id=>
        window.__harvestTestGame.scene.getScene('Game').gardenHarvest.state.plots[id].count,next),
        0,'mature plot remains unharvested until next touch');
      await up();
      await down();
      await page.waitForFunction(id=>
        window.__harvestTestGame.scene.getScene('Game').gardenHarvest.state.plots[id].count===1,
      next,{timeout:10000});
      await up();
    }
    await page.waitForFunction(()=>!window.__harvestTestGame.scene.getScene('Game').fairyPatrol.paused);
    const harvestState=await page.evaluate(id=>{
      const s=window.__harvestTestGame.scene.getScene('Game'),h=s.gardenHarvest;
      return {count:h.state.plots[id].count,progress:h.state.plots[id].progress,
        label:s.children.getByName('harvest-count:'+h.state.plots[id].name).text};
    },next);
    assert.equal(harvestState.count,1,'one touch harvest yields exactly +1');
    assert.equal(harvestState.progress,0,'harvested plot restarts as leaf');
    assert.ok(harvestState.label.endsWith(' 1'),'bottom inventory updated');

    // Interrupted touches must not strand the fairy in the stopped state.
    await down();
    await page.waitForFunction(()=>window.__harvestTestGame.scene.getScene('Game').fairyPatrol.paused);
    await cancel();
    await page.waitForFunction(()=>!window.__harvestTestGame.scene.getScene('Game').fairyPatrol.paused,
      null,{timeout:10000});
    assert.deepEqual(errors,[],'mobile browser errors: '+JSON.stringify({width,height,plot,harvest}));
    console.log('Mobile touch PASS',width,height,plot,harvest,
      'touch hold → stop/water → release/walk → one harvest → cancellation');
    await context.close();
  }
}finally{
  if(browser)await browser.close();
  server.close();
}
