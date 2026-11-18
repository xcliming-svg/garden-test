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
    let body=readFileSync(path==='phaser.js'?phaser:join(process.cwd(),path==='index.html'?'lab.html':path));
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
      const hero=F.actors[0],b=F.bounds,mx=(b.left+b.right)/2,my=(b.top+b.bottom)/2;
      const points={right:{x:mx,y:b.top-10},down:{x:b.right+10,y:my},
        left:{x:mx,y:b.bottom+10},up:{x:b.left-10,y:my}};
      const opposite={right:'left',left:'right',down:'up',up:'down'};
      const axis={x:(hero.center.x-mx)/((b.right-b.left)/2),y:(hero.center.y-my)/((b.bottom-b.top)/2)};
      const scale=30/Math.hypot(axis.x,axis.y);
      const point={x:hero.center.x+axis.x*scale,y:hero.center.y+axis.y*scale};
      const other=points[opposite[hero.direction]];
      check(window.GardenRelicCollection.eligible(point,hero.center,{bounds:b}),'outward fan admits point');
      check(!window.GardenRelicCollection.eligible(other,hero.center,{bounds:b}),'opposite side outside fan');
      const prior=R.state.gems;
      m.death(point.x,point.y);for(let i=0;i<60;i++)R.step(.05);
      R.render();F.refreshHud();
      check(R.state.gems>prior,'gem magnet collection');
      check(s.children.getByName('hud-gems-value').text===L.formatHudCount(R.state.gems),'HUD gems');
      R.state.drops=[];R.render();
      for(const f of R.state.flowers.values())f.energy=T.maxEnergy;
      m.damageFlower(44,70);m.damageFlower(45,30);F.refreshHud();
      check(s.flowerGrowth.entries.get(44).last.endsWith(':33'),'actual energy reflected in flower art');
      // Force deterministic heart for render and recovery without changing live RNG.
      const flower=R.state.flowers.get(44);
      R.state.drops.push({id:-1,kind:'heart',x:point.x,y:point.y,age:0,speed:0,attracted:false});
      R.render();
      const heart=s.children.getByName('ground-relic:heart:-1');
      check(heart&&Math.abs(Math.max(heart.displayWidth,heart.displayHeight)-12)<.001&&!heart.input,'12px SVG heart');
      for(let i=0;i<60;i++)R.step(.05);R.render();F.refreshHud();
      check(flower.energy>=50,'weakest flower recovers');
      check(!s.children.getByName('ground-relic:heart:-1'),'collected sprite removed');
      check(s.flowerGrowth.entries.get(44).last.endsWith(':66'),'recovery reflected in flower art');
      R.state.drops.push({id:-2,kind:'gem',x:other.x,y:other.y,age:Math.max(T.lifetime,F.length/F.speed+T.settleSeconds+1)-.01,speed:0,attracted:false});
      R.render();check(s.children.getByName('ground-relic:gem:-2'),'expiry test sprite exists');
      R.step(.05);R.render();check(!s.children.getByName('ground-relic:gem:-2'),'expired sprite removed');
      // Test a real moving hero, drops born on all four sides and at the
      // field corners. Isolate the sample from asynchronous enemy spawning.
      R.state.drops=[];
      const field=L.spec,positions=[...Object.values(points),{x:6,y:field.top+6},
        {x:field.width-6,y:field.top+6},{x:6,y:field.height-field.bottom-6},
        {x:field.width-6,y:field.height-field.bottom-6}];
      let id=-100;
      for(const pos of positions)for(const kind of ['gem','heart'])
        R.state.drops.push({id:id--,kind,...pos,age:0,speed:0,attracted:false});
      const gems=R.state.gems,hearts=R.state.hearts,expired=R.state.expired;
      const steps=Math.ceil((F.length/F.speed+T.settleSeconds+3)/.05);
      for(let i=0;i<steps;i++){F.advance(.05);R.step(.05);}
      R.render();F.refreshHud();
      check(R.state.gems===gems+positions.length,'all sides collected by hero lap');
      check(R.state.hearts===hearts+positions.length,'all hearts collected by hero lap');
      check(R.state.expired===expired&&!R.state.drops.length,'no drops lost on lap');
      return checks;
    });
    assert.equal(result,15);assert.deepEqual(errors,[]);
    console.log('PASS relic browser',width,height,result);
    await page.close();
  }
}finally{await browser?.close();server.close();}
