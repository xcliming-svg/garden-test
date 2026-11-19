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
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',e.stack||String(e));});
  await page.goto('http://127.0.0.1:'+server.address().port+'/#stress7');
  await page.waitForFunction(()=>window.__previewGame?.scene.getScene('Game').flowerCarry);
  const snap=()=>page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game'),e=s.enemyPreview.model;return {stress:window.GardenFairyFlowerbeds.stress,flowers:s.runGarden.occupied.size,fairies:s.fairyFlowerbeds.actors().map(a=>a.weapon),spawned:e.spawned,kills:e.kills,alive:e.actors.length,cap:s.enemyPreview.targetCount,shots:s.heroWeaponPreview.model.state.fired,rendered:s.enemyPreview.sprites.size,species:new Set(e.actors.map(a=>a.entry.id)).size};});
  let a=await snap();assert(a.stress);assert.equal(a.flowers,56);assert.equal(a.fairies.length,7);assert(a.spawned>=48);assert.equal(a.cap,48);assert(a.alive>=40);assert(a.species>=10);assert(a.rendered>=40);
  assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').children.getByName('flowerbed-stress-label').visible),true);
  await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return s.heroWeaponPreview.model.state.fired>0&&s.enemyPreview.model.kills>0;},{},{timeout:30000});
  a=await snap();assert(a.shots>0);assert(a.kills>0);assert(a.alive<=48);assert.deepEqual(errors,[]);
  await page.close();console.log('PASS stress7 browser',width,height,JSON.stringify(a));
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
