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
const results=[];
try{
 for(const [name,w,h,query] of [['default',960,540,''],['fhd',1920,1080,''],['original',960,540,'?svgcolors=original'],['light',960,540,'?uitype=1']]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[],failures=[],paths=new Set();
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',e=>failures.push(e.url()));
  page.on('response',r=>{if(r.ok())paths.add(new URL(r.url()).pathname);else if(r.status()>=400)failures.push(r.url()+' '+r.status());});
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
   await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return s.fairyPatrol?.actors.length===11&&s.enemyPreview?.entries.length===12&&s.flowerGrowth?.entries.size===4});
   const state=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),P=window.GardenPalette,G=window.GardenSvgPalette;
    const allowed=new Set(Object.values(P.n)),cv=document.createElement('canvas'),ctx=cv.getContext('2d',{willReadFrequently:true});
    function read(key){const im=s.textures.get(key).getSourceImage();cv.width=im.width;cv.height=im.height;ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,cv.width,cv.height).data;let opaque=0,off=0;const colors=new Set();for(let i=0;i<d.length;i+=4){if(d[i+3]===255){const c=(d[i]<<16)|(d[i+1]<<8)|d[i+2];opaque++;colors.add(c);if(!allowed.has(c))off++;}}return {key,opaque,off,colors:[...colors]}}
    const art=s.enemyPreview.entries.map(e=>read('enemy-preview:'+e.id+':base'));
    for(const key of ['fairy:garden:normal','fairy:water:normal','garden-pebble:stone','garden-pebble:silver','fairy:eyes'])art.push(read(key));
    const F=window.GardenFlowerGrowth;
    for(const n of F.names)for(let stage=1;stage<=3;stage++)art.push(read(F.key(n,stage)));
    return {palette:Object.values(P.hex),reference:P.reference.hex,enabled:G.enabled,art,actors:s.fairyPatrol.actors.length,enemies:s.enemyPreview.entries.length,flowers:s.flowerGrowth.entries.size};
   });
   assert.equal(state.palette.length,16);assert.equal(new Set(state.palette).size,16);
   assert.deepEqual(state.palette,['#4E352E','#706975','#AD7850','#96919B','#F4F1E9','#F5D3A5','#F6BB48','#FB575F','#D23840','#EB6A83','#84A83E','#C3D968','#6794D8','#91B8F7','#AB75DA','#824DB6']);
   const original=name==='original';assert.equal(state.enabled,!original);
   const prefix='/assets/'+(original?'':'palette16/');
   assert.equal([...paths].filter(p=>p.startsWith(prefix+'enemies/')&&p.endsWith('.svg')).length,12);
   assert.equal([...paths].filter(p=>p.startsWith(prefix+'flowers/')&&p.endsWith('.svg')).length,18);
   assert.equal([...paths].filter(p=>p.startsWith(prefix+'fairies/')&&p.endsWith('.svg')).length,4);
   assert.equal([...paths].filter(p=>p.startsWith(prefix+'pebbles/')&&p.endsWith('.svg')).length,2);
   if(!original)for(const a of state.art)assert.ok(a.opaque>0&&a.off/a.opaque<.08,JSON.stringify({key:a.key,opaque:a.opaque,off:a.off}));
   if(name!=='light'){assert.equal(state.reference.background,'#0D0D0E');assert.equal(state.reference.panel,'#3B3A44');assert.equal(state.reference.redText,'#F89596');}
   assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
   await page.screenshot({path:join(out,'garden16-v9-'+name+'.png')});
   results.push({name,pass:true,art:state.art.map(a=>({key:a.key,opaque:a.opaque,off:a.off}))});
   console.log('PASS',name,state.art.length,'loaded textures');
  }finally{await page.close();}
 }
 writeFileSync(join(out,'garden16-v9.json'),JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
