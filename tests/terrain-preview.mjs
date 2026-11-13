import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
const root=process.cwd();
const server=createServer(async(req,res)=>{
 try{
  const p=new URL(req.url,'http://localhost').pathname;
  const f=p==='/phaser.js'?resolve(root,'node_modules/phaser/dist/phaser.min.js'):resolve(root,'.'+p);
  const data=await readFile(f);
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(f)]||'application/octet-stream');res.end(data);
 }catch(e){res.statusCode=404;res.end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}});
 await page.route('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',r=>r.fulfill({path:resolve(root,'node_modules/phaser/dist/phaser.min.js'),contentType:'text/javascript'}));
 await page.route('**/src/main.js',async r=>{const s=await readFile(resolve(root,'src/main.js'),'utf8');await r.fulfill({contentType:'text/javascript',body:s.replace("window.addEventListener('resize',","window.__testGame=game;\n  window.addEventListener('resize',")});});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(v,msg)=>{if(!v)throw Error(msg);console.log('PASS '+msg);};
 async function start(path){
  await page.goto(origin+path);
  await page.waitForFunction(()=>window.__testGame?.scene.isActive('MainMenu'));
  const pos=await page.evaluate(()=>{const s=window.__testGame.scene.getScene('MainMenu');const o=s.children.list.find(o=>o.type==='Container'&&o.list?.[1]?.text==='새 게임');return {x:o.x*s.cameras.main.zoom,y:o.y*s.cameras.main.zoom};});
  await page.mouse.click(pos.x,pos.y);
  await page.waitForFunction(()=>window.__testGame.scene.isActive('Game'));
 }
 const state=()=>page.evaluate(()=>{const game=window.__testGame,s=game.scene.getScene('Game'),L=window.GardenGameLayout,g=L.spec.garden,t=s.textures.get('ui-test:garden-soil:'+g.cell),z=s.cameras.main.zoom;const i=s.children.getByName('garden-preview-soil'),px=(x,y)=>Array.from(t.getContext().getImageData(Math.round(x*z),Math.round(y*z),1,1).data);return {grass:!!s.children.getByName('temporary-grass-field'),field:s.children.getByName('battlefield').visible,soil:px(4*g.pitch+4,4*g.pitch+4),border:px(4*g.pitch+4,4*g.pitch),corner:px(4*g.pitch,4*g.pitch),g,z,flowers:s.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:')).length,drop:[s.children.getByName('placeholder:flower:0').x,s.children.getByName('placeholder:flower:0').y]};});
 await start('/index.html');let a=await state();check(!a.grass&&a.field&&a.soil.join()==='22,22,25,255','original is unchanged');
 await start('/assets/terrain-preview/index.html');a=await state();check(a.grass&&!a.field&&a.soil[0]>100&&a.border.join()==='87,57,34,255'&&a.corner[3]===0,'grass and soil, original corner mask');await page.screenshot({path:'terrain-preview.png'});
 await page.mouse.move(...a.drop);await page.mouse.down();await page.mouse.move(a.g.x+4*a.g.pitch+8,a.g.y+3*a.g.pitch+8,{steps:10});await page.mouse.up();let b=await state();check(b.flowers===5,'flower drag and planting unchanged');
 await page.setViewportSize({width:1920,height:1080});await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').cameras.main.zoom===2);b=await state();check(b.grass&&b.soil[0]>100&&b.border.join()==='87,57,34,255','FHD terrain and soil');await page.screenshot({path:'terrain-preview-fhd.png'});
 check(errors.length===0,'no page errors');
}finally{await browser.close();server.close();}
