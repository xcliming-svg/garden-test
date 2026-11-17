import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
const report=[];
try{
 for(const [name,w,h,query,expected] of [
  ['off',960,540,'?full=1',[false,false,false,false,false]],
  ['on',960,540,'?full=1&clarity=1',[true,true,true,true,true]],
  ['overrides',640,360,'?full=1&clarity=1&heroMarker=0&flowerFocus=0&enemyBrightness=85&enemySaturation=65',[true,true,true,false,false]],
  ['tone',960,540,'?full=1&enemyTone=1',[true,false,false,false,false]],
  ['outline',960,540,'?fairyOutline=1',[false,true,false,false,false]],
  ['sort',960,540,'?ySort=1',[false,false,true,false,false]],
  ['marker',960,540,'?heroMarker=1',[false,false,false,true,false]],
  ['focus',960,540,'?flowerFocus=1',[false,false,false,false,true]],
  ['combat',960,540,'?combat=1&clarity=1',[true,true,true,true,true]]
 ]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[],failed=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push(r.url()));
  try{
   await page.addInitScript(()=>{let seed=42;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
   await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return !!(s.enemyPreview||s.combatPreview);});
   const result=await page.evaluate(({name,expected})=>{
    const s=window.__previewGame.scene.getScene('Game'),C=window.GardenClarityPreview,c=s.enemyPreview,F=s.fairyPatrol,L=window.GardenGameLayout.spec;
    const cfg=C.config,flags=['enemyTone','fairyOutline','ySort','heroMarker','flowerFocus'].map(k=>cfg[k]);
    if(name==='combat')return {flags,combat:!!s.combatPreview,marker:!!s.children.getByName('clarity:hero-marker'),focus:!!s.children.getByName('clarity:flower-focus'),enemies:!!c};
    // Advance only model and render once, rather than 7,500 synchronous GPU
    // render calls. Capture real WebGL scene at the same elapsed population.
    c.advance(Math.max(0,120-c.elapsed));F.advance(Math.max(0,120-F.elapsed));
    const actors=c.actors,hero=F.actors[0],fairies=F.actors;
    const marker=s.children.getByName('clarity:hero-marker'),focus=s.children.getByName('clarity:flower-focus');
    let enemyOK=true,fairyOK=true,alphaOK=true,toneChanged=0,outlineAdded=0,bodyChanged=0;
    for(const a of actors){
     const im=c.sprites.get(a.id).image,k=window.GardenEnemyPreview.key(a.entry.id,a.expression);
     enemyOK&&=im.texture.key===(cfg.enemyTone?C.toneKey(k):k)&&Math.abs(im.depth-((cfg.ySort?2:3)+a.pose.ground/L.height))<1e-9;
    }
    const tex=(k)=>{const t=s.textures.get(k);return t.getContext().getImageData(0,0,t.width,t.height).data;};
    if(cfg.enemyTone){
      const k=window.GardenEnemyPreview.key(c.entries[0].id,'normal'),a=tex(k),b=tex(C.toneKey(k));
      for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])alphaOK=false;if(a[i+3]===255&&[0,1,2].some(j=>a[i+j]!==b[i+j]))toneChanged++;}
    }
    for(const a of fairies){
      const k=window.GardenFairyPatrol.key(a.type,a.expression);
      fairyOK&&=(cfg.fairyOutline?a.image.texture.key.startsWith('clarity:outline:'):a.image.texture.key===k);
      fairyOK&&=Math.abs(a.image.depth-(2+(cfg.ySort?(a.center.y+a.visibleHeight/2)/L.height+.000001:a.center.y/L.height)))<1e-9;
    }
    if(cfg.fairyOutline){
      const a=tex(window.GardenFairyPatrol.key(hero.type,hero.expression)),b=tex(hero.image.texture.key);
      for(let i=0;i<a.length;i+=4){if(a[i+3]===0&&b[i+3]>0)outlineAdded++;if(a[i+3]===255&&[0,1,2,3].some(j=>a[i+j]!==b[i+j]))bodyChanged++;}
    }
    return {flags,enemyOK,fairyOK,alphaOK,toneChanged,outlineAdded,bodyChanged,count:actors.length,flowers:s.flowerGrowth.entries.size,
     heroHeight:hero.visibleHeight,waterHeight:fairies[1].visibleHeight,marker:!!marker,focus:!!focus,markerDepth:marker?.depth,
     markerX:marker?.x,heroX:hero.image.x,focusDepth:focus?.depth,brightness:cfg.brightness,saturation:cfg.saturation,
     rings:s.children.list.filter(o=>o.name?.startsWith('clarity:')&&o.name.includes('ring')).length};
   },{name,expected});
   assert.deepEqual(result.flags,expected);
   if(name==='combat'){assert.ok(result.combat&&!result.marker&&!result.focus&&!result.enemies);}
   else{
    assert.ok(result.enemyOK&&result.fairyOK&&result.alphaOK,JSON.stringify(result));assert.equal(result.count,200);assert.equal(result.flowers,query.includes('full=1')?100:4);
    assert.equal(result.heroHeight,40);assert.ok(Math.abs(result.waterHeight-40*502/716)<.001);
    assert.equal(result.marker,expected[3]);assert.equal(result.focus,expected[4]);assert.equal(result.rings,0);
    if(expected[0])assert.ok(result.toneChanged>0);if(expected[1])assert.ok(result.outlineAdded>0&&result.bodyChanged===0,JSON.stringify(result));
    if(expected[3])assert.ok(result.markerDepth>3&&Math.abs(result.markerX-result.heroX)<.001);
    if(expected[4])assert.equal(result.focusDepth,.8);
    if(name==='overrides'){assert.equal(result.brightness,.85);assert.equal(result.saturation,.65);}
    await page.screenshot({path:join(out,'clarity-'+name+'.png'),scale:'device'});
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   report.push({name,...result,pass:true});console.log('PASS',name,JSON.stringify(result));
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'clarity-report.json'),JSON.stringify(report,null,2));}
