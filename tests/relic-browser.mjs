import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';
    if(path.includes('..'))return res.writeHead(404).end();
    let body=readFileSync(path==='phaser.js'?phaser:join(process.cwd(),path));
    if(path==='index.html')body=body.toString().replace('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
    if(path==='src/main.js')body=body.toString().replace("  window.addEventListener('resize',","  window.__previewGame = game;\n  window.addEventListener('resize',");
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
  }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [width,height] of [[960,540],[1280,720]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?enemies=1');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const box=await page.locator('canvas').boundingBox();
    await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').relicCollection?.state.spawnedGems>0);
    const result=await page.evaluate(()=>{
      const s=window.__previewGame.scene.getScene('Game'),R=s.relicCollection,F=s.fairyPatrol,E=s.enemyPreview,L=window.GardenGameLayout;
      const m=R.model,T=window.GardenRelicCollection.tuning;
      let checks=0;const check=(v,msg)=>{checks++;if(!v)throw Error(msg);};
      check(R.state.spawnedGems===E.model.kills,'one gem per actual kill');
      const hero=F.actors[0].center;
      const prior=R.state.gems;
      m.death(hero.x,hero.y);for(let i=0;i<20;i++)R.step(.05);
      R.render();F.refreshHud();
      check(R.state.gems>prior,'gem magnet collection');
      check(s.children.getByName('hud-gems-value').text===L.formatHudCount(R.state.gems),'HUD gems');
      R.state.drops=[];R.render();
      for(const f of R.state.flowers.values())f.energy=T.maxEnergy;
      m.damageFlower(44,70);m.damageFlower(45,30);F.refreshHud();
      check(s.flowerGrowth.entries.get(44).last.endsWith(':33'),'actual energy reflected in flower art');
      // Force deterministic heart for render and recovery without changing live RNG.
      const flower=R.state.flowers.get(44);
      R.state.drops.push({id:-1,kind:'heart',x:flower.x+50,y:flower.y,age:0,speed:0,attracted:false});
      R.render();
      const heart=s.children.getByName('ground-relic:heart:-1');
      check(heart&&Math.abs(Math.max(heart.displayWidth,heart.displayHeight)-12)<.001&&!heart.input,'12px SVG heart');
      for(let i=0;i<30;i++)R.step(.05);R.render();F.refreshHud();
      check(flower.energy>=50,'weakest flower recovers');
      check(!s.children.getByName('ground-relic:heart:-1'),'collected sprite removed');
      check(s.flowerGrowth.entries.get(44).last.endsWith(':66'),'recovery reflected in flower art');
      R.state.drops.push({id:-2,kind:'gem',x:50,y:450,age:T.lifetime-.01,speed:0,attracted:false});
      R.render();check(s.children.getByName('ground-relic:gem:-2'),'expiry test sprite exists');
      R.step(.05);R.render();check(!s.children.getByName('ground-relic:gem:-2'),'expired sprite removed');
      return checks;
    });
    assert.equal(result,10);assert.deepEqual(errors,[]);
    console.log('PASS relic browser',width,height,result);
    await page.close();
  }
}finally{await browser?.close();server.close();}
