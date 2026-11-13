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
 const state=()=>page.evaluate(()=>{
  const game=window.__testGame,s=game.scene.getScene('Game'),L=window.GardenGameLayout,g=L.spec.garden,t=s.textures.get('ui-test:garden-soil:'+g.cell),z=s.cameras.main.zoom;
  const p=(x,y)=>Array.from(t.getContext().getImageData(Math.round(x*z),Math.round(y*z),1,1).data);
  const f=s.children.getByName('placeholder:flower:0'),item=s.children.getByName('placeholder:item:0'),slot=s.children.getByName('slot-frame:0'),locked=s.children.getByName('slot-frame:9');
  const grass=s.children.getByName('temporary-grass-field'),theme=window.TerrainPreviewTheme;
  const n=h=>parseInt(h.slice(1),16);
  const rgb=a=>(a[0]<<16)|(a[1]<<8)|a[2];
  return {theme:theme?.type,grass:!!grass,field:s.children.getByName('battlefield').visible,soil:p(4*g.pitch+4,4*g.pitch+4),border:p(4*g.pitch+4,4*g.pitch),corner:p(4*g.pitch,4*g.pitch),g,z,flowers:s.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:')).length,drop:[f.x,f.y],item:[item.x,item.y],slot:[slot.x,slot.y],geometry:[L.spec, f.width,item.width,slot.width,f.x,f.y,item.x,item.y],card:[f.list[1].fillColor,f.list[0].fillColor,item.list[1].fillColor,item.list[0].fillColor],hud:L.colors.hud,grid:L.colors.gridFill,slotFace:slot.fillColor,locked:locked.fillColor,tip:L.itemTooltip,values:theme?{hud:n(theme.hud),tab:n(theme.tab),tabBorder:n(theme.tabBorder),flowerFace:n(theme.flowerFace),flowerEdge:n(theme.flowerEdge),locked:n(theme.disabledFill),soil:theme.soil.slice(0,4).map(n),edge:n(theme.soil[4]),active:n(theme.flowerBorder),itemActive:n(theme.itemBorder),grass:n(theme.grass[0])}:null,grassPixel:grass?rgb(Array.from(grass.texture.getContext().getImageData(0,0,1,1).data)):null};
 });
 await start('/index.html');let a=await state();check(!a.grass&&a.field&&a.soil.join()==='22,22,25,255','original is unchanged');const original=JSON.stringify(a.geometry);
 await start('/assets/terrain-preview/index.html');a=await state();check(a.grass&&!a.field&&!a.theme&&a.border.join()==='87,57,34,255','previous preview remains default');
 for(const type of ['1','2','3','4']){
  await page.setViewportSize({width:960,height:540});
  await start('/assets/terrain-preview/index.html?type='+type);a=await state();const v=a.values,rgb=p=>(p[0]<<16)|(p[1]<<8)|p[2];
  check(a.theme===type&&a.grass&&!a.field&&JSON.stringify(a.geometry)===original&&a.corner[3]===0&&v.soil.includes(rgb(a.soil))&&rgb(a.border)===v.edge,'type '+type+' original geometry and soil');
  check(a.hud===v.hud&&a.grid===v.tab&&a.slotFace===v.tab&&a.locked===v.locked&&a.card.join() === [v.flowerFace,v.flowerEdge,v.tab,v.tabBorder].join()&&a.tip.background===v.tab,'type '+type+' UI color roles');
  await page.screenshot({path:'terrain-preview-type-'+type+'.png'});
  await page.mouse.move(...a.drop);await page.mouse.down();await page.mouse.move(a.g.x+4*a.g.pitch+8,a.g.y+3*a.g.pitch+8,{steps:10});await page.mouse.up();let b=await state();check(b.flowers===5,'type '+type+' flower planting');
  await page.mouse.move(...a.item);await page.mouse.down();await page.mouse.move(...a.slot,{steps:10});await page.mouse.up();
  check(await page.evaluate(()=>window.__testGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible),'type '+type+' item equip');
  await page.setViewportSize({width:1920,height:1080});await page.waitForFunction(()=>window.__testGame.scene.getScene('Game').cameras.main.zoom===2);b=await state();check(b.grass&&v.soil.includes(rgb(b.soil))&&rgb(b.border)===v.edge,'type '+type+' FHD');
  await page.screenshot({path:'terrain-preview-type-'+type+'-fhd.png'});
 }
 check(errors.length===0,'no page errors');
}finally{await browser.close();server.close();}
