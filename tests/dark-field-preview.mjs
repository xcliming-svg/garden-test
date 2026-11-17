import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');
mkdirSync(out,{recursive:true});
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
 for(const [name,query,mode,w,h,dpr] of [
  ['default','',6,960,540,1],['original','?bgtype=0',0,960,540,1],...Array.from({length:6},(_,i)=>['pattern-'+(i+1),'?bgtype='+(i+1),i+1,960,540,1]),
  ['invalid','?bgtype=99',6,960,540,1],['empty','?bgtype=',6,960,540,1],['light','?uitype=1&bgtype=2',0,960,540,1],
  ['fhd','?bgtype=2',2,1920,1080,1],['dpr2','?bgtype=5',5,960,540,2],['grass-fhd','?bgtype=6',6,1920,1080,1],['grass-dpr2','?bgtype=6',6,960,540,2],['grass-light','?uitype=1&bgtype=6',0,960,540,1]
 ]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[],failed=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push(r.url()));
  try{
   // Background sampling requires an empty battlefield; new enemy display has its own tests.
   await page.goto(url+'/index.html'+(query?query+'&':'?')+'enemies=0');
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').fairyPatrol?.actors.length===11);
   const info=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),L=window.GardenGameLayout.spec,B=window.GardenDarkFieldPreview,o=s.children.getByName('dark-field-pattern'),light=s.children.getByName('theme-one-field');
    const result={active:B.active,pattern:!!o,light:!!light,actors:s.fairyPatrol.actors.length,stones:s.fairyPatrol.border.images.length,flowers:s.flowerGrowth.entries.size,original:!window.GardenSvgPalette.enabled};
    if(!o)return result;
    const im=o.texture.getSourceImage(),ctx=im.getContext('2d'),d=ctx.getImageData(0,0,im.width,im.height).data;
    const counts={};let min=255,max=0,neutral=true,opaque=true,green=true,maxChannel=0;
    for(let i=0;i<d.length;i+=4){const v=d[i];min=Math.min(min,v);max=Math.max(max,v);counts[v]=(counts[v]||0)+1;neutral&&=v===d[i+1]&&v===d[i+2];opaque&&=d[i+3]===255;green&&=d[i+1]>d[i]&&d[i+1]>d[i+2];maxChannel=Math.max(maxChannel,d[i],d[i+1],d[i+2]);}
    const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;B.paint(cv.getContext('2d'),cv.width,cv.height,B.active);
    const d2=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    return {...result,min,max,neutral,opaque,green,maxChannel,counts,stable:d.every((v,i)=>v===d2[i]),depth:o.depth,interactive:!!o.input,body:!!o.body,rect:[o.x-o.displayWidth/2,o.y-o.displayHeight/2,o.displayWidth,o.displayHeight],expected:[0,L.top,L.width,L.fieldHeight]};
   });
   assert.equal(info.active,mode);assert.equal(info.pattern,!!mode);assert.equal(info.light,name==='light'||name==='grass-light');
   assert.equal(info.actors,11);assert.equal(info.flowers,6);assert.ok(info.stones>20&&info.original);
   if(mode){assert.ok((mode===6?info.green:info.neutral)&&info.opaque&&info.stable);assert.ok(info.maxChannel<=40);assert.ok(info.min>=13&&info.max<=40&&info.max>info.min);assert.ok(Object.keys(info.counts).length>=2);assert.equal(info.depth,-1.8);assert.ok(!info.interactive&&!info.body);assert.deepEqual(info.rect,info.expected);}
   const png=await page.screenshot({path:join(out,'bg-'+name+'.png')});
   // Check actual rendered pixels in an empty field patch, not just texture data.
   const pixels=await page.evaluate(async ({data,mode})=>{
    const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
    const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
    const k=img.width/960;const p=ctx.getImageData(Math.round(180*k),Math.round(180*k),Math.round(80*k),Math.round(100*k)).data;
    const values=new Set();let min=255,max=0;for(let i=0;i<p.length;i+=4){values.add(p[i]);min=Math.min(min,p[i]);max=Math.max(max,p[i]);}
    return {min,max,colors:values.size};
   },{data:png.toString('base64'),mode});
   if(mode)assert.ok(pixels.colors>=2&&pixels.min>=12&&pixels.max<=41,JSON.stringify(pixels));
   else if(!name.includes('light'))assert.deepEqual(pixels,{min:13,max:13,colors:1});
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   report.push({name,query,info,pixels});console.log('PASS background',name,JSON.stringify(pixels));
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'background-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' background browser configurations');
