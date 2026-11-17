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
 for(const [w,h,dpr,query] of [[960,540,1,''],[1920,1080,1,'?uitype=1'],[960,540,2,'?flower=32&person=56&full=1&slots=36'],[960,540,1,'?flower=12&person=56'],[960,540,1,'?svgcolors=palette16']]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[],failed=[],loaded=new Set();
  page.on('response',r=>{if(/\/assets\/(?:palette16\/)?fairies\/[^/]+\.svg$/.test(r.url())&&r.ok())loaded.add(new URL(r.url()).pathname.slice(1));});
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
    const stats={},pebbles=c.border.images;
    const stoneStats={};
    for(const role of ['stone','silver']){
     const im=s.textures.get('garden-pebble:'+role).getSourceImage();
     ctx.clearRect(0,0,512,512);ctx.drawImage(im,0,0);
     const data=ctx.getImageData(0,0,256,256).data;let left=256,right=-1,top=256,bottom=-1;const colors=new Set();
     for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;const x=i/4%256,y=Math.floor(i/4/256);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(data[i+3]===255)colors.add((data[i]<<16)|(data[i+1]<<8)|data[i+2]);}
     stoneStats[role]={left,right,top,bottom,colors:[...colors],expected:window.GardenPalette.n[role]};
    }
    for(const type of ['garden','water']){
     function pixels(k){ctx.clearRect(0,0,512,512);ctx.drawImage(s.textures.get(k).getSourceImage(),0,0);return ctx.getImageData(0,0,512,512).data;}
     const base=pixels('fairy:base:'+type),normal=pixels('fairy:'+type+':normal'),closed=pixels('fairy:'+type+':closed');
     let changed=0,eyeDelta=0,other=0,aa=0,opaque=0,offPalette=0,left=512,right=-1,top=512,bottom=-1;const allowed=new Set(Object.values(window.GardenPalette.n));
     for(let i=0;i<base.length;i+=4){
      const x=(i/4)%512,y=Math.floor(i/4/512);
      const region=x>180&&x<335&&y>200&&y<355;
      if([0,1,2,3].some(j=>normal[i+j]!==closed[i+j])){changed++;if(!region)other++;}
      if([0,1,2,3].some(j=>base[i+j]!==normal[i+j]))eyeDelta++;
      if(normal[i+3]>0&&normal[i+3]<255)aa++;
      if(normal[i+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(normal[i+3]===255){opaque++;if(!allowed.has((normal[i]<<16)|(normal[i+1]<<8)|normal[i+2]))offPalette++;}
     }
     stats[type]={changed,eyeDelta,other,aa,opaque,offPalette,left,right,top,bottom};
    }
    return {boundary:c.boundary,stoneStats,stones:pebbles.map(o=>({x:o.x,y:o.y,angle:o.angle,key:o.texture.key,w:o.displayWidth,h:o.displayHeight,interactive:!!o.input,body:!!o.body})),paletteEnabled:window.GardenSvgPalette.enabled,counts:c.actors.map(a=>a.type),heights:c.actors.map(a=>a.visibleHeight),origins:c.actors.map(a=>[a.image.originX,a.image.originY]),stats,
      length:c.length,spacing:c.spacing,bounds:c.bounds,field:{top:L.spec.top,bottom:L.spec.height-L.spec.bottom},garden:L.spec.garden,
      flowers:s.flowerGrowth.entries.size,combat:!!s.combatPreview,status:s.children.getByName('fairy-patrol-status')?.text};
   });
   const original=!query.includes('svgcolors=palette16');
   assert.equal(initial.paletteEnabled,!original);
   const prefix='assets/'+(original?'':'palette16/')+'fairies/';
   assert.deepEqual([...loaded].sort(),['eyes.svg','garden.svg','water.svg'].map(n=>prefix+n));
   for(const v of Object.values(initial.stats))if(!original)assert.ok(v.opaque>0&&v.offPalette<=v.opaque*.05,JSON.stringify(v));
   if(original)assert.ok(Object.values(initial.stats).every(v=>v.offPalette>0));
   assert.deepEqual(initial.counts,['garden',...Array(10).fill('water')]);
   const B=initial.boundary;
   assert.equal(B.gap,5);assert.equal(initial.stones.length,B.points.length);assert.equal(initial.stones.length%2,0);
   assert.ok(initial.stones.length>20);
   assert.ok(initial.stones.every((o,i)=>o.key==='garden-pebble:'+['stone','silver'][i%2]&&o.w===B.frame&&o.h===B.frame&&!o.interactive&&!o.body));
   for(const v of Object.values(initial.stoneStats)){assert.deepEqual(v.colors,[v.expected]);assert.ok(v.right-v.left>=170&&v.bottom-v.top>=120);}
   assert.ok(B.height<=B.requestedHeight);if(!query.includes('full=1'))assert.equal(B.height,B.requestedHeight);
   assert.ok(B.border.top-B.frame*11/32>=initial.field.top&&B.border.bottom+B.frame*11/32<=initial.field.bottom);
   assert.ok(Math.abs(B.border.top-(B.swept.top-5-B.frame*8.25/32))<1e-6);
   assert.equal(initial.combat,false);assert.equal(initial.status,'정원 순찰 · 요정 11명');
   assert.equal(initial.flowers,query.includes('full=1')?100:4);
   assert.ok(initial.heights.slice(1).every(x=>Math.abs(x/initial.heights[0]-502/716)<1e-9));
   assert.ok(initial.origins.every(a=>a[0]===.5&&a[1]===.858));
   for(const v of Object.values(initial.stats))assert.ok(v.changed>50&&v.eyeDelta>50&&v.other===0&&v.aa>50,JSON.stringify(v));
   assert.ok(initial.spacing>=initial.heights[0]*1.2+4-1e-6);
   if(w===1920)await page.screenshot({path:join(out,'fairy-patrol-light.png')});
   const results=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.fairyPatrol,L=window.GardenGameLayout;
    const dirs=c.actors.map(()=>new Set()),blinks=c.actors.map(()=>0),last=c.actors.map(a=>a.expression);
    const angles=c.actors.map(()=>[Infinity,-Infinity]),lifts=c.actors.map(()=>[Infinity,-Infinity]);
    const first=c.actors.map(a=>({...a.center}));let allNormal=false,asynchronous=false,minGap=Infinity,violations=0,missing=0,innerGap=Infinity,outerGap=Infinity;
    const cv=document.createElement('canvas');cv.width=cv.height=512;const cx=cv.getContext('2d',{willReadFrequently:true});
    const bounds={};
    for(const type of ['garden','water']){
     cx.clearRect(0,0,512,512);cx.drawImage(s.textures.get('fairy:'+type+':normal').getSourceImage(),0,0);const d=cx.getImageData(0,0,512,512).data;
     let l=512,r=-1,t=512,b=-1;for(let i=0;i<d.length;i+=4)if(d[i+3]>=128){const x=i/4%512,y=Math.floor(i/4/512);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}bounds[type]={l,r:r+1,t,b:b+1};
    }
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
      const o=a.image,bb=bounds[a.type],f=o.displayWidth/512,rad=o.rotation,co=Math.cos(rad),si=Math.sin(rad),xy=[];
      for(const x of [bb.l,bb.r])for(const y of [bb.t,bb.b]){
       const xx=(x-256)*f*(o.flipX?-1:1),yy=(y-512*.858)*f;
       xy.push({x:o.x+xx*co-yy*si,y:o.y+xx*si+yy*co});
      }
      const l=Math.min(...xy.map(p=>p.x)),r=Math.max(...xy.map(p=>p.x)),t=Math.min(...xy.map(p=>p.y)),b=Math.max(...xy.map(p=>p.y));
      innerGap=Math.min(innerGap,Math.max(g.left-r,l-g.right,g.top-b,t-g.bottom));
      const R=c.boundary.border,F=c.boundary.frame*8.25/32;
      outerGap=Math.min(outerGap,l-R.left-F,R.right-r-F,t-R.top-F,R.bottom-b-F);
      const yTop=a.image.y-a.visibleHeight;
      if(yTop<L.spec.top-1||a.image.y>L.spec.height-L.spec.bottom+1)violations++;
      for(const b of c.actors)if(a.index<b.index)minGap=Math.min(minGap,Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y));
     }
    }
    const names=s.children.list.map(o=>o.name||'');
    return {innerGap,outerGap,dirs:dirs.map(x=>[...x]),blinks,angles,lifts,allNormal,asynchronous,minGap,violations,missing,
      enemy:names.filter(n=>n.startsWith('placeholder:enemy')||n.startsWith('combat-ball:')||n.startsWith('combat-drop:')).length,
      elapsed:c.elapsed-begin,period,flowerKeys:[...s.flowerGrowth.entries.values()].map(a=>a.image.texture.key)};
   });
   assert.ok(results.dirs.every(d=>d.length===4),JSON.stringify(results.dirs));
   assert.ok(results.blinks.every(n=>n>=8),JSON.stringify(results.blinks));
   assert.ok(results.allNormal&&results.asynchronous);
   // Keep a visible but gentle gait, including the directional lean at corners.
   assert.ok(results.angles.every(([a,b])=>a>=-1.751&&b<=1.751&&b-a>2),JSON.stringify(results.angles));
   assert.ok(results.lifts.every(([a,b],i)=>a>=-1e-6&&b<=.5*initial.heights[i]/40+1e-6&&b-a>.15*initial.heights[i]/40),JSON.stringify(results.lifts));
   assert.ok(results.minGap>=initial.heights[0]*.8,JSON.stringify(results));
   assert.ok(results.innerGap>=4.8&&results.outerGap>=4.8,JSON.stringify({inner:results.innerGap,outer:results.outerGap}));
   assert.equal(results.violations,0);assert.equal(results.missing,0);assert.equal(results.enemy,0);
   assert.ok(results.flowerKeys.every(k=>k.startsWith('flower-svg:')));
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   const paused=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.elapsed);
   await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.elapsed),paused);
   await page.keyboard.press('Escape');await page.waitForFunction(t=>window.__previewGame.scene.getScene('Game').fairyPatrol.elapsed>t,paused);
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   if(!query||!original)await page.screenshot({path:join(out,original?'fairy-patrol-dark.png':'fairy-patrol-palette16.png')});
   report.push({w,h,dpr,query,initial,results,pass:true});
   console.log('PASS fairy',w,h,query,'11 actors, 4 directions, independent blinks, no combat, pause');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'fairy-patrol-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' fairy browser configurations');
