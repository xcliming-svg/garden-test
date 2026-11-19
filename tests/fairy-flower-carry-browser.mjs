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
  await page.addInitScript(()=>{window.GardenFairyFlowerbedsDisabled=true;window.GardenSimulationRng={drop:()=>0};});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
  await page.locator('#blueprint-select').selectOption('stage-3');
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
  const initial=await pos();await page.waitForTimeout(180);assert.deepEqual(await pos(),initial,'idle stays in place');
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.manualSpeed),120);
  await page.keyboard.down('d');try{await page.waitForFunction(x=>window.__previewGame.scene.getScene('Game').fairyPatrol.actors[0].center.x>x+2,initial.x,{timeout:15000});}finally{await page.keyboard.up('d');}
  console.log('PASS real frame movement',width,height);
  const fixture=await read(()=>{const R=window.GardenRunRules,s=window.__previewGame.scene.getScene('Game'),g=window.GardenGameLayout.spec.garden;const id=[...R.plantCandidates(s.runGarden.occupied)][0],name=R.blueprint.find(x=>x[0]===id)[1],p=s.fairyPatrol.actors[0].center,c=s.runDrops.spawn('flower',700,200,name);return {id,name,x:c.x,y:c.y,cx:g.x+(id%10)*g.pitch+g.line+g.cell/2,cy:g.y+Math.floor(id/10)*g.pitch+g.line+g.cell/2,card:c.marker.name};});
  await page.keyboard.press('Space');assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried),null,'remote pickup denied');
  await go(fixture.x,fixture.y);
  await page.keyboard.press('Space');await page.waitForFunction(()=>!!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried.name),fixture.name);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').children.getByName('flower-carry-icon').visible),true);
  await page.keyboard.press('Space');await page.waitForFunction(()=>!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  const drop=await read(()=>{const s=window.__previewGame.scene.getScene('Game');const c=[...s.runDrops.drops.values()].find(c=>c.kind==='flower'&&!c.consumed);return {x:c.x,y:c.y};});await go(drop.x,drop.y);await page.keyboard.press('Space');
  await page.waitForFunction(()=>!!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  await go(fixture.cx,fixture.cy);
  await page.keyboard.press('Space');await page.waitForFunction(id=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.has(id),fixture.id);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried),null);
  assert.equal(await read(id=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(id)?.name,fixture.id),fixture.name);
  // Ordinary pickups need no mouse or Space. The fifth replaces the oldest.
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').run.state.slotCount),4);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').children.getByName('run-slot-purchase').visible),false);
  for(const id of ['boomerang','paper-plane','shoe','shield','balloon']){
    const c=await read(id=>{const s=window.__previewGame.scene.getScene('Game'),c=s.runDrops.spawn('item',700,200,id,1);return {x:c.x,y:c.y};},id);
    await go(c.x,c.y);await page.waitForFunction(id=>window.__previewGame.scene.getScene('Game').runEquipment.equipped.some(x=>x?.id===id),id);
  }
  const fifo=await read(()=>{const e=window.__previewGame.scene.getScene('Game').runEquipment;return e.fifoOrder.map(i=>e.equipped[i].id);});
  assert.deepEqual(fifo,['paper-plane','shoe','shield','balloon']);
  // Carry a one-shot installation into an empty cell inside the future garden.
  const place=await read(()=>{const R=window.GardenRunRules,s=window.__previewGame.scene.getScene('Game'),g=window.GardenGameLayout.spec.garden;
    const id=[...R.plantCandidates(s.runGarden.occupied)][0],name=R.blueprint.find(x=>x[0]===id)[1],c=s.runDrops.spawn('item',700,200,'sprinkler',2);
    const center=i=>({x:g.x+(i%10)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(i/10)*g.pitch+g.line+g.cell/2});
    return {id,name,x:c.x,y:c.y,point:center(id),occupied:center(44)};
  });
  await go(place.x,place.y);assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried),null,'installation not automatic');
  await page.keyboard.press('Space');await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried?.id==='sprinkler');
  await go(place.occupied.x,place.occupied.y);await page.keyboard.press('Space');
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried?.id),'sprinkler','cannot install on a flower');
  await go(place.point.x,place.point.y);await page.keyboard.press('Space');
  const installed=await read(()=>{const s=window.__previewGame.scene.getScene('Game');return s.heroWeaponPreview.model.state.shots.filter(x=>x.manualInstalled).map(x=>({kind:x.kind,level:x.level,life:x.life}));});
  assert.deepEqual(installed,[{kind:'sprinkler',level:2,life:12}]);
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerCarry.carried),null);
  const flower=await read(name=>{const s=window.__previewGame.scene.getScene('Game'),c=s.runDrops.spawn('flower',700,200,name);return {x:c.x,y:c.y};},place.name);
  await go(flower.x,flower.y);await page.keyboard.press('Space');await page.waitForFunction(()=>!!window.__previewGame.scene.getScene('Game').flowerCarry.carried);
  await go(place.point.x,place.point.y);await page.keyboard.press('Space');
  assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.shots.some(x=>x.manualInstalled)),false,'planting removes installation');
  // Advance existing weapon simulation to test the lifetime without a wall-clock wait.
  const expires=await read(()=>{const s=window.__previewGame.scene.getScene('Game'),p=s.fairyPatrol.actors[0].center,api=s.heroWeaponPreview,point={x:700,y:200};if(!api.install('yellow-floor',1,point,12))throw Error('install outside');
    const shot=api.model.state.shots.find(x=>x.manualInstalled);shot.age=11.99;api.model.step(.1,s.fairyPatrol.actors[0],[],()=>null,()=>false,s.fairyPatrol,()=>false,[]);return !api.model.state.shots.some(x=>x.manualInstalled);});
  assert(expires,'expired installation removed');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));const paused=await pos();await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');assert.deepEqual(await pos(),paused);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));await page.waitForTimeout(150);assert.deepEqual(await pos(),paused);
  assert.deepEqual(errors,[]);await page.close();console.log('PASS carry browser',width,height);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
