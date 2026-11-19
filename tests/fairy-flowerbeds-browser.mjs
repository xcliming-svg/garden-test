import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';if(path.includes('..'))return res.writeHead(404).end();let body=readFileSync(path==='phaser.js'?phaser:join(process.cwd(),path));if(path==='index.html')body=body.toString().replace('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');if(path==='src/main.js')body=body.toString().replace("  window.addEventListener('resize',","  window.__previewGame = game;\n  window.addEventListener('resize',");res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);}catch(e){res.writeHead(500).end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [width,height] of [[960,540],[1280,720]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',e.stack||String(e));});
  await page.addInitScript(()=>{window.GardenSimulationRng={drop:()=>0};});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
  const box=await page.locator('canvas').boundingBox(),xy=(x,y)=>[box.x+x*box.width/960,box.y+y*box.height/540];
  await page.mouse.click(...xy(480,252));await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').flowerCarry);
  const read=(fn,arg)=>page.evaluate(fn,arg),pos=()=>read(()=>({...window.__previewGame.scene.getScene('Game').fairyPatrol.actors[0].center}));
  async function go(x,y){
    const bounds=await read(()=>{const s=window.__previewGame.scene.getScene('Game'),g=window.GardenGameLayout.spec,h=s.fairyPatrol.actors[0].visibleHeight/2+2;return {left:h,right:g.width-h,top:g.top+h,bottom:g.height-g.bottom-h};});
    x=Math.max(bounds.left,Math.min(bounds.right,x));y=Math.max(bounds.top,Math.min(bounds.bottom,y));
    // Drive actual key events through the real Phaser scene, then advance its
    // existing movement controller in bounded logical steps. CI frame-rate
    // variance cannot turn a 2-second walk into a wall-clock timeout.
    for(const [axis,dest,neg,positive] of [['x',x,'a','d'],['y',y,'w','s']]){
      for(let attempt=0;attempt<5;attempt++){
        const p=await pos(),delta=dest-p[axis];if(Math.abs(delta)<4)break;
        const key=delta<0?neg:positive,sign=Math.sign(delta);
        await page.keyboard.down(key);
        try{await read(({axis,dest,sign})=>{
          const g=window.__previewGame,s=g.scene.getScene('Game'),patrol=s.fairyPatrol;
          if(!g.scene.isActive('Game')||s.flowerCarry.movement()[axis]!==sign)throw Error('Movement input not active');
          for(let i=0;i<200;i++){const remaining=sign*(dest-patrol.actors[0].center[axis]);if(remaining<=1)break;patrol.advance(Math.min(.1,remaining/patrol.manualSpeed));}
        },{axis,dest,sign});}finally{await page.keyboard.up(key);}
      }
    }
    const p=await pos();assert(Math.hypot(p.x-x,p.y-y)<13,'movement destination '+JSON.stringify({p,x,y}));
  }
  assert.equal(await page.locator('#blueprint-select').count(),0);
  const snap=()=>read(()=>{const s=window.__previewGame.scene.getScene('Game');return {cols:window.GardenGameLayout.spec.garden.columns,count:s.runGarden.occupied.size,bed:s.fairyFlowerbeds.model.state.map(b=>({weapon:b.weapon,power:b.power,ready:b.ready})),actors:s.fairyFlowerbeds.actors().map(a=>({id:a.index,x:a.center.x,y:a.center.y,weapon:a.weapon})),result:s.run.state.result};});
  let a=await snap();assert.equal(a.cols,9);assert.equal(a.count,8);assert.equal(a.bed[4].weapon,'rock');assert.equal(a.bed[4].power,1);assert.equal(a.actors.length,1);
  const center=a.actors[0];await go(700,200);assert.deepEqual((await snap()).actors[0],center);
  const fired=await read(()=>{const s=window.__previewGame.scene.getScene('Game'),api=s.heroWeaponPreview.model,patrol=s.fairyPatrol,a=s.fairyFlowerbeds.actors(),target={id:999,x:a[0].center.x+100,y:a[0].center.y,ground:a[0].center.y,lift:0,hp:100,radius:5,phase:'move'};api.step(.9,patrol.actors[0],[target],()=>({hp:90}),()=>false,patrol,()=>false,a);return api.state.shots.some(q=>q.owner===104&&q.kind==='rock'&&q.origin.x===a[0].center.x);});
  assert(fired,'fixed rock fairy fires');
  const fixture=await read(()=>{const s=window.__previewGame.scene.getScene('Game'),id=window.GardenFairyFlowerbeds.beds[4].ring[0],p=s.fairyFlowerbeds.point(id);s.runGarden.remove(id);s.fairyFlowerbeds.refresh();const c=s.runDrops.spawn('flower',700,200,'daisy');return {id,p,x:c.x,y:c.y};});
  assert.equal((await snap()).bed[4].power,7/8);
  await go(fixture.x,fixture.y);await page.keyboard.press('Space');await page.waitForFunction(()=>!!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  await go(fixture.p.x,fixture.p.y);await page.keyboard.press('Space');assert.equal((await snap()).count,8);
  await read(id=>{const s=window.__previewGame.scene.getScene('Game');s.flowerGrowth.entries.get(id).mature=true;s.flowerGrowth.render(s.run.state.elapsed);s.fairyFlowerbeds.refresh();},fixture.id);
  assert.equal((await snap()).bed[4].power,1);
  const c=await read(()=>{const s=window.__previewGame.scene.getScene('Game'),c=s.runDrops.spawn('flower',700,200,'sunflower');return {x:c.x,y:c.y};});
  await go(c.x,c.y);await page.keyboard.press('Space');await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried?.name==='sunflower');
  await go(fixture.p.x,fixture.p.y);await page.keyboard.press('Space');assert.equal(await read(id=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(id).name,fixture.id),'sunflower');
  await read(()=>{const s=window.__previewGame.scene.getScene('Game'),F=window.GardenFairyFlowerbeds;for(const id of F.beds[4].ring){if(s.flowerGrowth.entries.get(id).name!=='sunflower')s.runGarden.plantCarried(id,'sunflower');s.flowerGrowth.entries.get(id).mature=true;}s.flowerGrowth.render(s.run.state.elapsed);s.fairyFlowerbeds.refresh();});
  a=await snap();assert.equal(a.bed[4].weapon,'rock');assert.equal(a.bed[4].ready,'boomerang');assert.equal(a.bed[4].power,0);
  await go(center.x,center.y);await page.keyboard.press('Space');a=await snap();assert.equal(a.bed[4].weapon,'boomerang');assert.equal(a.bed[4].power,1);
  await read(()=>{const s=window.__previewGame.scene.getScene('Game'),F=window.GardenFairyFlowerbeds;for(const bed of F.beds)for(const id of bed.ring){if(!s.runGarden.occupied.has(id))s.runGarden.plantCarried(id,'daisy');s.flowerGrowth.entries.get(id).mature=true;}s.flowerGrowth.render(s.run.state.elapsed);s.fairyFlowerbeds.refresh();});
  await page.waitForTimeout(150);a=await snap();assert.equal(a.count,72);assert.equal(a.actors.length,9);assert.equal(a.result,null);
  await read(()=>{const s=window.__previewGame.scene.getScene('Game');for(const id of [...s.runGarden.occupied])s.runGarden.remove(id);});
  await page.waitForFunction(()=>window.__previewGame.scene.isActive('Defeat'));assert.deepEqual(errors,[]);
  await page.close();console.log('PASS flowerbeds browser',width,height);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
