import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');
mkdirSync(out,{recursive:true});
const originals={
 'garden.svg':'723187294ee9c502cb22012f2fd8538e55f0d1eb3a718bd34796f85bae37dfb7',
 'water.svg':'cfd43e61589dc6ac9c3fdce325065b993a8573839c09f74290f8340dd3fcd72b',
 'eyes.svg':'e51a0f9437ca1cb030b704ad7d1edaa98e1490929bb79312d65d0ca2c0e3e014',
 'tears.svg':'487ed84b9a080975c1881b8add2890e69f9ad132dad2dc4fcbb28842f19b2052',
 'manifest.json':'63e938b9f371d3b6eb5da741fb4594ed7039d9e1f8d278e57747c19578fd9be4'
};
for(const [name,hash] of Object.entries(originals)){
 const s=readFileSync(join(root,'assets/fairies',name),'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(s).digest('hex'),hash,name);
}
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
 for(const [w,h,dpr,query] of [[960,540,1,''],[1920,1080,1,'?uitype=1'],[960,540,2,'?flower=32&person=56&full=1&slots=36'],[960,540,1,'?flower=12&person=56']]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',r=>failed.push(r.url()));
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').fairyPatrol?.actors.length===11);
   const initial=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.fairyPatrol,L=window.GardenGameLayout;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const stats={};
    for(const type of ['garden','water']){
     function pixels(k){ctx.clearRect(0,0,512,512);ctx.drawImage(s.textures.get(k).getSourceImage(),0,0);return ctx.getImageData(0,0,512,512).data;}
     const base=pixels('fairy:base:'+type),normal=pixels('fairy:'+type+':normal'),closed=pixels('fairy:'+type+':closed');
     let changed=0,eyeDelta=0,other=0,aa=0;
     for(let i=0;i<base.length;i+=4){
      const x=(i/4)%512,y=Math.floor(i/4/512);
      const region=x>180&&x<335&&y>200&&y<355;
      if([0,1,2,3].some(j=>normal[i+j]!==closed[i+j])){changed++;if(!region)other++;}
      if([0,1,2,3].some(j=>base[i+j]!==normal[i+j]))eyeDelta++;
      if(normal[i+3]>0&&normal[i+3]<255)aa++;
     }
     stats[type]={changed,eyeDelta,other,aa};
    }
    return {counts:c.actors.map(a=>a.type),heights:c.actors.map(a=>a.visibleHeight),origins:c.actors.map(a=>[a.image.originX,a.image.originY]),stats,
      length:c.length,spacing:c.spacing,bounds:c.bounds,field:{top:L.spec.top,bottom:L.spec.height-L.spec.bottom},garden:L.spec.garden,
      flowers:s.flowerGrowth.entries.size,combat:!!s.combatPreview,status:s.children.getByName('fairy-patrol-status')?.text};
   });
   assert.deepEqual(initial.counts,['garden',...Array(10).fill('water')]);
   assert.equal(initial.combat,false);assert.equal(initial.status,'정원 순찰 · 요정 11명');
   assert.equal(initial.flowers,query.includes('full=1')?100:6);
   assert.ok(initial.heights.slice(1).every(x=>Math.abs(x/initial.heights[0]-502/716)<1e-9));
   assert.ok(initial.origins.every(a=>a[0]===.5&&a[1]===.858));
   for(const v of Object.values(initial.stats))assert.ok(v.changed>50&&v.eyeDelta>50&&v.other===0&&v.aa>50,JSON.stringify(v));
   assert.ok(initial.spacing>=initial.heights[0]*1.2+4-1e-6);
   if(w===1920)await page.screenshot({path:join(out,'fairy-patrol-light.png')});
   const results=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.fairyPatrol,L=window.GardenGameLayout;
    const dirs=c.actors.map(()=>new Set()),blinks=c.actors.map(()=>0),last=c.actors.map(a=>a.expression);
    const angles=c.actors.map(()=>[Infinity,-Infinity]),lifts=c.actors.map(()=>[Infinity,-Infinity]);
    const first=c.actors.map(a=>({...a.center}));let allNormal=false,asynchronous=false,minGap=Infinity,violations=0,missing=0;
    const g=window.GardenDashedGridPreview.geometry(L.spec,new Set([...s.flowerGrowth.entries.keys()]),0,0).garden;
    const period=c.length/c.speed,begin=c.elapsed;
    for(let i=0;i<Math.ceil(Math.max(period+1,60)/.05);i++){
     c.advance(.05);
     allNormal ||= c.actors.every(a=>a.expression==='normal');
     asynchronous ||= c.actors.some(a=>a.expression==='closed')&&c.actors.some(a=>a.expression==='normal');
     for(const a of c.actors){
      const n=a.index;dirs[n].add(a.direction);
      if(last[n]==='normal'&&a.expression==='closed')blinks[n]++;
      last[n]=a.expression;
      const angle=a.image.angle,lift=a.center.y+a.visibleHeight/2-a.image.y;
      angles[n]=[Math.min(angles[n][0],angle),Math.max(angles[n][1],angle)];
      lifts[n]=[Math.min(lifts[n][0],lift),Math.max(lifts[n][1],lift)];
      if(!a.image.visible||a.image.texture.key!=='fairy:'+a.type+':'+a.expression)missing++;
      if(a.center.x>g.left&&a.center.x<g.right&&a.center.y>g.top&&a.center.y<g.bottom)violations++;
      const yTop=a.image.y-a.visibleHeight;
      if(yTop<L.spec.top-1||a.image.y>L.spec.height-L.spec.bottom+1)violations++;
      for(const b of c.actors)if(a.index<b.index)minGap=Math.min(minGap,Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y));
     }
    }
    const names=s.children.list.map(o=>o.name||'');
    return {dirs:dirs.map(x=>[...x]),blinks,angles,lifts,allNormal,asynchronous,minGap,violations,missing,
      enemy:names.filter(n=>n.startsWith('placeholder:enemy')||n.startsWith('combat-ball:')||n.startsWith('combat-drop:')).length,
      elapsed:c.elapsed-begin,period,flowerKeys:[...s.flowerGrowth.entries.values()].map(a=>a.image.texture.key)};
   });
   assert.ok(results.dirs.every(d=>d.length===4),JSON.stringify(results.dirs));
   assert.ok(results.blinks.every(n=>n>=8),JSON.stringify(results.blinks));
   assert.ok(results.allNormal&&results.asynchronous);
   assert.ok(results.angles.every(([a,b])=>b-a>6)&&results.lifts.every(([a,b])=>b-a>.5));
   assert.ok(results.minGap>=initial.heights[0]*.8,JSON.stringify(results));
   assert.equal(results.violations,0);assert.equal(results.missing,0);assert.equal(results.enemy,0);
   assert.ok(results.flowerKeys.every(k=>k.startsWith('flower-svg:')));
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   const paused=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.elapsed);
   await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.elapsed),paused);
   await page.keyboard.press('Escape');await page.waitForFunction(t=>window.__previewGame.scene.getScene('Game').fairyPatrol.elapsed>t,paused);
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   if(!query)await page.screenshot({path:join(out,'fairy-patrol-dark.png')});
   report.push({w,h,dpr,query,initial,results,pass:true});
   console.log('PASS fairy',w,h,query,'11 actors, 4 directions, independent blinks, no combat, pause');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'fairy-patrol-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' fairy browser configurations');
