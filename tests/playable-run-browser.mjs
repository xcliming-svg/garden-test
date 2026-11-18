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
    await page.goto('http://127.0.0.1:'+server.address().port+'/?enemies=0&weapons=0');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const box=await page.locator('canvas').boundingBox();
    const xy=p=>[box.x+p.x*box.width/960,box.y+p.y*box.height/540];
    await page.mouse.click(...xy({x:480,y:252}));
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').runDrops);
    const read=fn=>page.evaluate(fn);
    const initial=await read(()=>{
      const s=window.__previewGame.scene.getScene('Game');
      return {slots:s.run.state.slotCount,gear:s.runEquipment.equipped.map(x=>x?.id??null),fairies:s.fairyPatrol.actors.length,flowers:[...s.flowerGrowth.entries.values()].map(x=>x.stage),progress:s.children.getByName('hud-progress-value').text,drop:s.runDrops.drops.size,visible:s.children.getByName('preview-equipped:0').visible,attack:s.heroWeaponPreview.model.state.equipped[0]};
    });
    assert.deepEqual(initial,{slots:4,gear:['rock',...Array(9).fill(null)],fairies:1,flowers:[3,3,3,3],progress:'25%',drop:0,visible:true,attack:'rock'});
    assert.equal(await page.locator('#hero-weapon-select').count(),0);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.fired>0);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').enemyPreview.model.kills>0,null,{timeout:30000});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
    const clock=()=>read(()=>window.__previewGame.scene.getScene('Game').run.state.elapsed);
    const paused=await clock();await page.waitForTimeout(200);assert.equal(await clock(),paused);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
    async function drag(kind,id,index){
      const points=await page.evaluate(({kind,id,index})=>{
        const s=window.__previewGame.scene.getScene('Game'),d=s.runDrops.spawn(kind,220,180,id);
        const g=window.GardenGameLayout.spec.garden;
        const dest=kind==='item'?s.children.getByName('preview-slot:'+index):{x:g.x+(index%10)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(index/10)*g.pitch+g.line+g.cell/2};
        return {from:{x:d.x,y:d.y},to:{x:dest.x,y:dest.y}};
      },{kind,id,index});
      await page.mouse.move(...xy(points.from));await page.mouse.down();await page.mouse.move(...xy(points.to),{steps:12});await page.mouse.up();
    }
    await drag('item','water-fairy',1);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.actors.length),2);
    await drag('flower','daisy',34);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(34)?.name),'daisy');
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(34)?.stage),1);
    await read(()=>{const s=window.__previewGame.scene.getScene('Game');s.run.tick(16);s.fairyPatrol.refreshHud();});
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(34)?.stage),3);
    await read(()=>window.__previewGame.scene.getScene('Game').relicCollection.model.damageFlower(34,1000));
    await page.waitForFunction(()=>!window.__previewGame.scene.getScene('Game').flowerGrowth.entries.has(34));
    await read(()=>window.__previewGame.scene.getScene('Game').run.credit(500));
    for(let n=4;n<10;n++){
      const p=await read(()=>{const z=window.__previewGame.scene.getScene('Game').children.getByName('run-slot-purchase');return {x:z.x,y:z.y};});
      await page.mouse.click(...xy(p));
      assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').run.state.slotCount),n+1);
    }
    await page.waitForFunction(()=>{const r=window.__previewGame.scene.getScene('Game').run.state;return r.gems===r.displayGems;});
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').children.getByName('run-slot-purchase').visible),false);
    await drag('item','wheel',9);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.equipped[9]),'wheel');
    await read(()=>{const s=window.__previewGame.scene.getScene('Game');for(const id of s.runGarden.occupied)s.relicCollection.model.damageFlower(id,1000);});
    await page.waitForFunction(()=>window.__previewGame.scene.isActive('Defeat'));
    assert.deepEqual(errors,[]);
    console.log('PASS playable browser',width,height);
    await page.close();
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
