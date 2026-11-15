import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');
mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
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
const expected=[[0,1,100],[10,2,100],[20,3,100],[30,4,100],[40,4,66],[45,4,33],[50,3,100],[55,3,50],[60,2,100],[65,2,50],[70,1,100],[75,1,50],[80,1,100]];
const reports=[];
try{
 for(const [w,h,dpr,query] of [[640,360,1,''],[960,540,1,''],[1920,1080,1,''],[960,540,2,'?garden=32']]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const failed=[];page.on('requestfailed',r=>failed.push(r.url()));
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+box.width/2,box.y+box.height*252/540);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').flowerGrowth);
   const initial=await page.evaluate(()=>{
    const game=window.__previewGame,s=game.scene.getScene('Game'),M=window.GardenFlowerGrowth,ctrl=s.flowerGrowth;
    const alpha=(key)=>s.textures.get(key).getContext().getImageData(0,0,M.size,M.size).data;
    const checks=[];
    for(const name of M.names)for(let stage=1;stage<=4;stage++){
     const base=alpha(M.key(name,stage,100));let count=0,bottom=-1;
     for(let i=3;i<base.length;i+=4)if(base[i]){count++;bottom=Math.floor((i>>2)/M.size);}
     let previous=count;
     for(const hp of stage===4?[66,33]:[50]){
      const data=alpha(M.key(name,stage,hp));let left=0,b=-1,valid=true;
      for(let i=0;i<data.length;i+=4)if(data[i+3]){
       left++;b=Math.floor((i>>2)/M.size);
       if(data[i+3]!==255||[0,1,2,3].some(c=>data[i+c]!==base[i+c]))valid=false;
      }
      checks.push({name,stage,hp,count,left,bottom,b,valid,previous});
      previous=left;
     }
    }
    const positions=ctrl.sprites.map(o=>({name:o.name,x:o.x,y:o.y,w:o.displayWidth,h:o.displayHeight}));
    const g=window.GardenGameLayout.spec.garden;
    const tests=Array.from({length:80},(_,t)=>M.stateAt(t));
    return {positions,g,checks,tests,elapsed:ctrl.elapsed(),state:ctrl.state(),
      guardian:s.children.list.some(o=>o.name==='placeholder:guardian:0'),
      enemies:s.children.list.filter(o=>o.name?.startsWith('placeholder:enemy:')).length,
      slots:s.children.list.filter(o=>o.name?.startsWith('slot-frame:')).length};
   });
   assert.equal(initial.positions.length,6);
   assert.equal(new Set(initial.positions.map(p=>p.name)).size,6);
   assert.ok(initial.positions.every(p=>p.x>initial.g.x&&p.x<initial.g.x+initial.g.size&&p.y>initial.g.y&&p.y<initial.g.y+initial.g.size&&p.w===64&&p.h===64));
   assert.equal(initial.guardian,true);assert.equal(initial.enemies,3);assert.equal(initial.slots,10);
   assert.equal(initial.checks.length,30);
   for(const c of initial.checks)assert.ok(c.valid&&c.left>0&&c.left<c.previous&&c.b===c.bottom,JSON.stringify(c));
   for(let t=0;t<80;t++){const e=expected.filter(v=>v[0]<=t).at(-1);assert.deepEqual(initial.tests[t],{stage:e[1],hp:e[2]});}
   assert.deepEqual(initial.state,{stage:1,hp:100});
   // Use the real scene update once, then verify Escape pauses the timer.
   await page.waitForTimeout(300);
   const elapsed=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.elapsed());
   assert.ok(elapsed>initial.elapsed);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   const paused=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.elapsed());
   await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.elapsed()),paused);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
   for(const [t,stage,hp] of expected.slice(1)){
    const actual=await page.evaluate(({t})=>{
     const s=window.__previewGame.scene.getScene('Game'),c=s.flowerGrowth;
     c.advance(Math.max(0,t+.05-c.elapsed()));
     return {state:c.state(),keys:c.sprites.map(o=>o.texture.key),positions:c.sprites.map(o=>[o.x,o.y])};
    },{t});
    assert.deepEqual(actual.state,{stage,hp});
    assert.ok(actual.keys.every(k=>k.endsWith(':'+stage+':'+hp)));
    assert.deepEqual(actual.positions,initial.positions.map(p=>[p.x,p.y]));
    if(w===1920&&[10,20,30,40,45,55,65,75].includes(t))await page.screenshot({path:join(out,'growth-'+t+'.png')});
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   reports.push({w,h,dpr,query,checks:initial.checks,pass:true});
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'growth-report.json'),JSON.stringify(reports,null,2));}
console.log('PASS: '+reports.length+' browser configurations, 54 textures, 80-second growth/damage cycle, fixed anchors, pause and HUD');
