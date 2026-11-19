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
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
  await page.locator('#blueprint-select').selectOption('stage-3');
  const box=await page.locator('canvas').boundingBox(),xy=(x,y)=>[box.x+x*box.width/960,box.y+y*box.height/540];
  await page.mouse.click(...xy(480,252));await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').flowerCarry);
  const read=(fn,arg)=>page.evaluate(fn,arg),pos=()=>read(()=>({...window.__previewGame.scene.getScene('Game').fairyPatrol.actors[0].center}));
  async function go(x,y){
    for(const [axis,dest,neg,posKey] of [['x',x,'a','d'],['y',y,'w','s']]){
      for(let attempt=0;attempt<5;attempt++){
        const p=await pos(),delta=dest-p[axis];if(Math.abs(delta)<7)break;
        const key=delta<0?neg:posKey;await page.keyboard.down(key);
        try{await page.waitForFunction(({axis,dest,sign})=>{const p=window.__previewGame.scene.getScene('Game').fairyPatrol.actors[0].center;return sign*(dest-p[axis])<=5;},{axis,dest,sign:Math.sign(delta)},{timeout:8000});}finally{await page.keyboard.up(key);}
      }
    }
    const p=await pos();assert(Math.hypot(p.x-x,p.y-y)<13,'movement destination '+JSON.stringify({p,x,y}));
  }
  const initial=await pos();await page.waitForTimeout(180);assert.deepEqual(await pos(),initial,'idle stays in place');
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.manualSpeed),120);
  const fixture=await read(()=>{const R=window.GardenRunRules,s=window.__previewGame.scene.getScene('Game'),g=window.GardenGameLayout.spec.garden;const id=[...R.plantCandidates(s.runGarden.occupied)][0],name=R.blueprint.find(x=>x[0]===id)[1],p=s.fairyPatrol.actors[0].center,c=s.runDrops.spawn('flower',p.x+120,p.y,name);return {id,name,x:c.x,y:c.y,cx:g.x+(id%10)*g.pitch+g.line+g.cell/2,cy:g.y+Math.floor(id/10)*g.pitch+g.line+g.cell/2,card:c.marker.name};});
  await page.keyboard.press('Space');assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried),null,'remote pickup denied');
  await go(fixture.x,fixture.y);
  await page.keyboard.press('Space');await page.waitForFunction(()=>!!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried.name),fixture.name);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').children.getByName('flower-carry-icon').visible),true);
  await page.keyboard.press('Space');assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried.name),fixture.name,'outside garden cannot plant');
  await page.keyboard.press('q');await page.waitForFunction(()=>!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  const drop=await read(()=>{const s=window.__previewGame.scene.getScene('Game');const c=[...s.runDrops.drops.values()].find(c=>c.kind==='flower'&&!c.consumed);return {x:c.x,y:c.y};});await go(drop.x,drop.y);await page.keyboard.press('Space');
  await page.waitForFunction(()=>!!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  await go(fixture.cx,fixture.cy);
  await page.keyboard.press('Space');await page.waitForFunction(id=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.has(id),fixture.id);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried),null);
  assert.equal(await read(id=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(id)?.name,fixture.id),fixture.name);
  const equipment=await read(()=>{const s=window.__previewGame.scene.getScene('Game'),c=s.runDrops.spawn('item',700,200,'boomerang',1),z=s.children.getByName('preview-slot:1');return {x:c.x,y:c.y,sx:z.x,sy:z.y};});
  await page.mouse.move(...xy(equipment.x,equipment.y));await page.mouse.down();await page.mouse.move(...xy(equipment.sx,equipment.sy),{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').runEquipment.equipped[1]?.id==='boomerang');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));const paused=await pos();await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');assert.deepEqual(await pos(),paused);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));await page.waitForTimeout(150);assert.deepEqual(await pos(),paused);
  assert.deepEqual(errors,[]);await page.close();console.log('PASS carry browser',width,height);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
