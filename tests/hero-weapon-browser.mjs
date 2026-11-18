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
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const box=await page.locator('canvas').boundingBox();
    await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
    const select=page.locator('#hero-weapon-select');await select.waitFor();
    assert.equal(await select.inputValue(),'');
    const ids=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.deepEqual(ids,['','balloon','boomerang','wheel','flowerpot','paper-plane','bouncy-ball','yellow-floor','sprinkler','rock','broom']);
    const initial=await page.evaluate(()=>{
      const s=window.__previewGame.scene.getScene('Game');
      return {fairies:s.fairyPatrol.actors.length,enemies:!!s.enemyPreview,shots:s.heroWeaponPreview.model.state.shots.length};
    });
    assert.deepEqual(initial,{fairies:11,enemies:false,shots:0});
    for(const id of ids.slice(1)){
      await select.selectOption(id);
      await page.waitForFunction(id=>{
        const s=window.__previewGame.scene.getScene('Game'),m=s.heroWeaponPreview.model;
        return m.state.shots.some(q=>q.kind===id)&&s.children.list.some(q=>q.name?.startsWith('hero-weapon:'+id+':'));
      },id);
      const actual=await page.evaluate(()=>{
        const s=window.__previewGame.scene.getScene('Game'),m=s.heroWeaponPreview.model;
        return {selected:m.state.selected,owners:m.state.shots.map(q=>q.owner),enemy:!!s.enemyPreview};
      });
      assert.equal(actual.selected,id);assert.ok(actual.owners.length&&actual.owners.every(x=>x===0));assert.equal(actual.enemy,false);
    }
    await select.selectOption('rock');await page.waitForTimeout(100);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
    assert.equal(await select.isVisible(),false);
    const read=()=>page.evaluate(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.elapsed);
    const paused=await read();await page.waitForTimeout(150);assert.equal(await read(),paused);
    await page.keyboard.press('Escape');await select.waitFor();assert.equal(await select.inputValue(),'rock');
    await select.selectOption('');
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.shots.length),0);
    await page.evaluate(()=>window.__previewGame.scene.getScene('Game').scene.stop());
    await select.waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    console.log('PASS hero weapon preview',width,height,ids.length-1);
    await page.close();
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
