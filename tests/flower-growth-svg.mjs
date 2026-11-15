import {readFileSync,mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');
mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const folder=join(root,'assets/flowers');
assert.equal(readdirSync(folder).filter(n=>n.endsWith('.svg')).length,24);
assert.equal(readdirSync(join(folder,'damage')).filter(n=>n.endsWith('.svg')).length,30);
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
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
const expected=[[1,100],[2,100],[3,100],[4,100],[4,66],[4,33],[3,100],[3,50],[2,100],[2,50],[1,100],[1,50]];
const report=[];
try{
 for(const [w,h,dpr,query] of [[960,540,1,''],[1920,1080,1,'?flower=32&personstyle=3'],[960,540,2,'?uitype=1&personstyle=3']]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[],failed=[],loaded=new Set();
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',r=>failed.push(r.url()));
  page.on('response',r=>{if(r.url().includes('/assets/flowers/')&&r.ok())loaded.add(r.url());});
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   const click=(x,y)=>page.mouse.click(box.x+x*box.width/960,box.y+y*box.height/540);
   await click(480,252);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').flowerGrowth?.entries.size===6);
   const first=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),G=window.GardenFlowerGrowth,c=s.combatPreview,g=s.flowerGrowth,tex=[];
    const cv=document.createElement('canvas');cv.width=cv.height=G.sourceSize;const ctx=cv.getContext('2d',{willReadFrequently:true});
    for(const name of G.names)for(let stage=1;stage<=4;stage++)for(const hp of stage===4?[100,66,33]:[100,50]){
     const t=s.textures.get(G.key(name,stage,hp)),im=t.getSourceImage();
     ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(im,0,0);
     const data=ctx.getImageData(0,0,cv.width,cv.height).data;
     let area=0,aa=0;const colors=new Set();
     for(let i=0;i<data.length;i+=4){const a=data[i+3];if(a)area+=a/255;if(a>0&&a<255)aa++;if(a===255)colors.add((data[i]<<16)|(data[i+1]<<8)|data[i+2]);}
     tex.push({name,stage,hp,area,aa,colors:colors.size,w:im.width,h:im.height});
    }
    return {names:G.names,occupied:[...c.model.occupied],entries:[...g.entries].map(([i,e])=>[i,e.name,e.image.x,e.image.y,e.image.originX,e.image.originY,e.image.displayWidth]),tex,
     states:Array.from({length:60},(_,i)=>G.stateAt(i)),start:c.state.elapsed,
     hud:s.children.getByName('hud-progress-value').text};
   });
   assert.deepEqual(first.occupied,[43,44,45,53,54,55]);
   assert.deepEqual(first.entries.map(e=>e[1]),first.names);
   assert.equal(first.hud,'6%');
   assert.ok(first.entries.every(e=>e[4]===.5&&e[5]===.856));
   assert.equal(first.tex.length,54);assert.equal(loaded.size,54);
   for(const t of first.tex)assert.ok(t.area>0&&t.aa>0&&t.w===512&&t.h===512,JSON.stringify(t));
   for(const name of first.names)for(let stage=1;stage<=4;stage++){
    const a=first.tex.filter(t=>t.name===name&&t.stage===stage);
    assert.ok(a[0].area>a[1].area&&(!a[2]||a[1].area>a[2].area),JSON.stringify(a));
   }
   for(let t=0;t<60;t++)assert.deepEqual(first.states[t],{stage:expected[Math.floor(t/5)][0],hp:expected[Math.floor(t/5)][1]});
   // Real scene clock, not a separate timer; verify all 12 frame transitions.
   for(let i=0;i<=12;i++){
    const actual=await page.evaluate(({t})=>{
     const s=window.__previewGame.scene.getScene('Game'),c=s.combatPreview,G=s.flowerGrowth;
     c.advance(Math.max(0,t+.1-c.state.elapsed));
     return {keys:[...G.entries.values()].map(e=>e.image.texture.key),anchors:[...G.entries.values()].map(e=>[e.image.x,e.image.y,e.image.originX,e.image.originY])};
    },{t:i*5});
    const [stage,hp]=expected[i%12];
    assert.ok(actual.keys.every(k=>k.endsWith(':'+stage+':'+hp)),JSON.stringify(actual.keys));
    assert.deepEqual(actual.anchors,first.entries.map(e=>e.slice(2,6)));
    if(w===1920&&i<12)await page.screenshot({path:join(out,'svg-growth-'+String(i).padStart(2,'0')+'.png')});
   }
   // Test a newly planted flower through the existing real drop drag interaction.
   const drop=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.combatPreview;
    const d=c.state.drops.find(d=>d.kind==='flower');
    if(!d){c.state.drops.push({id:99999,kind:'flower',name:'rose',x:150,y:210,dragging:false});c.advance(0);}
    const f=c.state.drops.find(d=>d.kind==='flower'),g=window.GardenGameLayout.spec.garden;
    return {id:f.id,x:f.x,y:f.y,target:33,tx:g.x+3*g.pitch+g.line+g.cell/2,ty:g.y+3*g.pitch+g.line+g.cell/2};
   });
   await page.mouse.move(box.x+drop.x*box.width/960,box.y+drop.y*box.height/540);
   await page.mouse.down();
   await page.mouse.move(box.x+drop.tx*box.width/960,box.y+drop.ty*box.height/540,{steps:8});
   await page.mouse.up();
   await page.waitForFunction(i=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.has(i),drop.target);
   const planted=await page.evaluate(i=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.combatPreview,e=s.flowerGrowth.entries.get(i);
    const initial=e.image.texture.key,age=c.state.elapsed-e.born;
    c.advance(5.1);
    return {initial,age,next:e.image.texture.key,count:c.model.occupied.size,progress:s.children.getByName('hud-progress-value').text};
   },drop.target);
   assert.ok(planted.initial.endsWith(':1:100')&&planted.next.endsWith(':2:100')&&planted.age<1,JSON.stringify(planted));
   assert.equal(planted.count,7);assert.equal(planted.progress,'7%');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   const time=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed);
   await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed),time);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   report.push({w,h,dpr,query,loaded:loaded.size,tex:first.tex,planted,pass:true});
   console.log('PASS SVG',w,h,query,'54 assets, 12 states, 7 flowers, pause');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'svg-growth-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' SVG browser configurations');
