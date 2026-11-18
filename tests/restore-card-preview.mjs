import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(path.includes('..'))return res.writeHead(404).end();
  let body=readFileSync(path==='phaser.js'?phaser:join(root,path));
  if(path==='index.html')body=body.toString().replace('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
  if(path==='src/main.js')body=body.toString().replace("  window.addEventListener('resize',","  window.__previewGame = game;\n  window.addEventListener('resize',");
  res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
 }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const [w,h] of [[960,540],[1280,720]]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[],failed=[],enemyRequests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',r=>failed.push(r.url()));
  page.on('request',r=>{if(r.url().includes('/enemies/'))enemyRequests.push(r.url());});
  try{
   await page.goto(url+'/index.html');
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   const coords=(x,y)=>[box.x+x*box.width/960,box.y+y*box.height/540];
   const click=(x,y)=>page.mouse.click(...coords(x,y));
   const drag=async(a,b,release=true)=>{
    await page.mouse.move(...coords(a.x,a.y));await page.mouse.down();
    await page.mouse.move(...coords(b.x,b.y),{steps:12});
    if(release)await page.mouse.up();
   };
   const snapshot=()=>page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),L=window.GardenGameLayout;
    const obj=n=>s.children.getByName(n),pos=o=>({x:o.x,y:o.y,visible:o.visible,alpha:o.alpha});
    // Drag raises depth and reorders the display list; retain stable card identity.
    const byName=(a,b)=>a.name.localeCompare(b.name);
    const flowers=s.children.list.filter(o=>o.name?.startsWith('placeholder:flower:')).sort(byName).map(pos);
    const items=s.children.list.filter(o=>o.name?.startsWith('placeholder:item:')).sort(byName).map(pos);
    const g=L.spec.garden,cell=i=>({x:g.x+(i%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2});
    const slot=L.bottomLayout().slots[0];
    return {flowers,items,occupied:s.fairyPatrol.occupied,enemy:!!s.enemyPreview,combat:!!s.combatPreview,
     fairy:s.fairyPatrol.actors.length,stage:s.flowerGrowth.entries.size,slot:{x:slot.x+slot.size/2,y:slot.y+slot.size/2},candidate:cell(43),invalid:cell(44),
     ghost:obj('garden-preview-ghost').visible,gear:obj('preview-equipped:0').visible,tip:obj('item-preview-tooltip').visible,
     speed:obj('stat-value:moveSpeed').text,dps:obj('stat-value:dps').text,progress:obj('hud-progress-value').text};
   });
   const start=async()=>{await click(480,252);await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').fairyPatrol?.actors.length===11);};
   await start();
   const initial=await snapshot();
   assert.equal(initial.flowers.length,3);assert.equal(initial.items.length,5);
   assert.ok([...initial.flowers,...initial.items].every(o=>o.visible));
   assert.equal(initial.enemy,false);assert.equal(initial.combat,false);assert.equal(initial.stage,4);
   await page.screenshot({path:join(out,'cards-'+w+'-initial.png')});
   // Real pointer drag: invalid occupied cell, then valid adjacent cell with ghost.
   await drag(initial.flowers[0],initial.invalid);let state=await snapshot();
   assert.equal(state.stage,4);assert.equal(state.flowers[0].visible,true);
   await drag(initial.flowers[0],initial.candidate,false);state=await snapshot();
   assert.equal(state.ghost,true);assert.equal(state.flowers[0].alpha,.25);
   await page.mouse.up();state=await snapshot();
   assert.equal(state.stage,5);assert.ok(state.occupied.includes(43));assert.equal(state.flowers[0].visible,false);assert.equal(state.progress,'5%');assert.equal(state.ghost,false);
   // Hover, equip, then replace using the restored item-card UI.
   await page.mouse.move(...coords(initial.items[0].x,initial.items[0].y));
   assert.equal((await snapshot()).tip,true);
   await drag(initial.items[0],initial.slot);state=await snapshot();
   assert.equal(state.items[0].visible,false);assert.equal(state.gear,true);assert.equal(state.speed,'110');
   await drag(initial.items[1],initial.slot);state=await snapshot();
   assert.equal(state.items[1].visible,false);assert.equal(state.gear,true);assert.equal(state.speed,'100');assert.equal(state.dps,'38');
   await page.screenshot({path:join(out,'cards-'+w+'-equipped.png')});
   // Pause cancels in-progress drag, then returning to menu resets the preview.
   await drag(initial.flowers[1],initial.candidate,false);
   await page.keyboard.press('Escape');await page.mouse.up();
   await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   state=await snapshot();assert.equal(state.flowers[1].visible,true);assert.equal(state.flowers[1].alpha,1);assert.equal(state.ghost,false);
   await click(480,338);await page.waitForFunction(()=>window.__previewGame.scene.isActive('Confirm'));
   await click(537,323);await page.waitForFunction(()=>window.__previewGame.scene.isActive('MainMenu'));
   await start();state=await snapshot();assert.equal(state.stage,4);assert.equal(state.gear,false);
   assert.ok([...state.flowers,...state.items].every(o=>o.visible));
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(enemyRequests,[]);
   console.log('PASS '+w+'x'+h+': cards, pointer drag, tooltip, equip/replace, pause, restart, no enemy requests');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();}
