import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');mkdirSync(out,{recursive:true});
const hashes={
 "1_butterfly_1000.svg":"8f928f083c08f1d26c95e6cb36dfc1ae26f99f82b2be7f7f45d1965df2c8a341",
 "1_cat_1000.svg":"58cf8b81da559d2068cb8b09901c9cf5fb32acd36928e19d6d01a7d4ef6adef6",
 "2_frog_1000.svg":"df4ae3633fa952eefc7622511fa24619dd679bb4ae4cf4177f711a18513764b2",
 "2_grasshopper_1000.svg":"39d3deec7ac434853934364f261bbf30f14bc32cee5e3506b46607e4d9916788",
 "2_gray_bug_1000.svg":"a4a1ff5b8ff0fa75ee3f89cc9482ccba6e690bd1652b8ceb9d0a46b39f7cc9d0",
 "3_caterpillar_1000.svg":"dcf380e06222784f02b0c2cc4216c4e8bbe5039edf174253440858958ab639f2",
 "4_beetle_1000.svg":"cf31e6331380bbf255846f36698f23e66f6f669b5d7ef6ad363935495662f0ce",
 "5_bulldog_1000.svg":"94126b70ba86b06b522d6bda3c12262b8ea3fea7a13871f29afdad1d2a489fc2",
 "6_mouse_1000.svg":"f5e1f84318b2b4e1c66dab3528a724f0b94bb533b4ca9751d43c784b9a84c6f7",
 "6_pigeon_1000.svg":"a56d38be37ba7d5a4d4228a66ce7dfdeafd845daef59f3e91bc56334ef7c8733",
 "6_rabbit_1000.svg":"5da1298a8a279888a1aab99d82e47c8f28464dd7c29c1ad0c8499e47882cca77",
 "6_sparrow_1000.svg":"e801de024337a40fa2c852c9b75167d6768eb8dd856a8dc575f4ee959f7508ba",
 "eye_anchors.json":"ee82d8c963d1020c09d39e8e1b2d882797f6231c57197a0fb07ceb7902727c5b"
};
for(const [name,hash] of Object.entries(hashes)){
 const source=readFileSync(join(root,'assets/enemies',name),'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(source).digest('hex'),hash,name);
 if(name.endsWith('.svg'))assert.match(source,/id="eyes"[^>]*visibility="hidden"/);
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
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
try{
 for(const [name,w,h,dpr,query] of [
  ['default',960,540,1,''],['fhd',1920,1080,1,''],['small',640,360,1,''],
  ['full-dpr2',960,540,2,'?flower=32&person=56&full=1&slots=36'],
  ['light',960,540,1,'?uitype=1'],['palette16',960,540,1,'?svgcolors=palette16'],
  ['hidden',960,540,1,'?enemies=0'],['combat',960,540,1,'?combat=1']
 ]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[],failed=[],loaded=new Set();
  page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push(r.url()));
  page.on('response',r=>{if(r.url().includes('/assets/enemies/')&&r.ok())loaded.add(new URL(r.url()).pathname)});
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
   await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return !!(s.fairyPatrol||s.combatPreview)});
   if(name==='hidden'||name==='combat'){
    assert.equal(await page.evaluate(()=>!!window.__previewGame.scene.getScene('Game').enemyPreview),false);
    assert.equal(loaded.size,0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    report.push({name,pass:true});console.log('PASS',name);continue;
   }
   const result=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,L=window.GardenGameLayout.spec,F=s.fairyPatrol,B=F.boundary;
    const ctx=document.createElement('canvas').getContext('2d');
    ctx.canvas.width=ctx.canvas.height=512;
    const anchors=s.cache.json.get('enemy-preview:anchors'),fm=s.cache.json.get('fairy:manifest');
    const original=!window.GardenSvgPalette.enabled,sharedAtlas=s.textures.get('fairy:eyes').getSourceImage();
    let atlas=sharedAtlas;
    if(!original){atlas=document.createElement('canvas');atlas.width=sharedAtlas.width;atlas.height=sharedAtlas.height;const ec=atlas.getContext('2d');ec.drawImage(sharedAtlas,0,0);ec.globalCompositeOperation='source-in';ec.fillStyle=window.GardenPalette.hex.ink;ec.fillRect(0,0,atlas.width,atlas.height);}
    const pix=(image)=>{if(image instanceof HTMLCanvasElement)return image.getContext('2d').getImageData(0,0,512,512).data;ctx.clearRect(0,0,512,512);ctx.drawImage(image,0,0);return ctx.getImageData(0,0,512,512).data;};
    const entries=c.actors.map(a=>{
     const base=s.textures.get('enemy-preview:'+a.id+':base').getSourceImage(),normal=pix(s.textures.get('enemy-preview:'+a.id+':normal').getSourceImage()),closed=pix(s.textures.get('enemy-preview:'+a.id+':closed').getSourceImage());
     const raw=pix(base),expected=[];
     for(const expression of ['normal','closed']){
      ctx.clearRect(0,0,512,512);ctx.drawImage(base,0,0);
      if(!original)ctx.putImageData(window.GardenSvgPalette.apply(ctx.getImageData(0,0,512,512)),0,0);
      const f=fm.sheets.eyes.frames[expression],w=f.width/2;
      for(const [i,side] of ['left','right'].entries()){
       const eye=anchors.characters[a.id].eyes[side],center=fm.sourceEyeCenters[side],z=512/1000;
       ctx.drawImage(atlas,f.x+i*w,f.y,w,f.height,(eye.x-(center.x-i*w)*eye.scale)*z,(eye.y-center.y*eye.scale)*z,w*eye.scale*z,f.height*eye.scale*z);
      }
      expected.push(ctx.getImageData(0,0,512,512).data);
     }
     let changed=0,eyeDelta=0,alpha=0;
     for(let i=0;i<normal.length;i+=4){if([0,1,2,3].some(j=>normal[i+j]!==closed[i+j]))changed++;if([0,1,2,3].some(j=>normal[i+j]!==raw[i+j]))eyeDelta++;if(normal[i+3])alpha++;}
     // Canvas backends can round premultiplied antialias RGB differently. Compare
     // alpha independently and allow a tiny channel tolerance on visible pixels.
     let maxAlpha=0,opaqueDelta=0,edgeDelta=0;
     for(const [j,frame] of [normal,closed].entries())for(let i=0;i<frame.length;i+=4){
      const exp=expected[j];maxAlpha=Math.max(maxAlpha,Math.abs(frame[i+3]-exp[i+3]));
      if(frame[i+3]===255&&exp[i+3]===255)for(let k=0;k<3;k++)opaqueDelta=Math.max(opaqueDelta,Math.abs(frame[i+k]-exp[i+k]));
      else if(Math.min(frame[i+3],exp[i+3])>=128)for(let k=0;k<3;k++)edgeDelta=Math.max(edgeDelta,Math.abs(frame[i+k]-exp[i+k]));
     }
     return {id:a.id,x:a.x,y:a.y,w:a.width,h:a.height,span:a.span,changed,eyeDelta,alpha,maxAlpha,opaqueDelta,edgeDelta,
      exact:maxAlpha<=1&&opaqueDelta<=2&&edgeDelta<=4,
      rect:{left:a.x-a.width/2,right:a.x+a.width/2,top:a.y-a.height/2,bottom:a.y+a.height/2},
      visible:a.image.visible&&a.image.alpha===1,interactive:!!a.image.input,body:!!a.image.body,linear:a.image.texture.source[0].scaleMode===Phaser.Textures.FilterMode.LINEAR};
    });
    return {entries,field:{left:0,right:L.width,top:L.top,bottom:L.height-L.bottom},
     boundary:{left:B.border.left-B.frame/2,right:B.border.right+B.frame/2,top:B.border.top-B.frame/2,bottom:B.border.bottom+B.frame/2},
     blueprint:{left:L.blueprint.x,right:L.blueprint.x+L.blueprint.width,top:L.blueprint.y,bottom:L.blueprint.y+L.blueprint.height},fairies:F.actors.length,flowers:s.flowerGrowth.entries.size,combat:!!s.combatPreview};
   });
   assert.equal(loaded.size,13);assert.equal(result.entries.length,12);assert.equal(new Set(result.entries.map(e=>e.id)).size,12);
   assert.equal(result.fairies,11);assert.equal(result.flowers,name==='full-dpr2'?100:6);assert.equal(result.combat,false);
   for(const a of result.entries){
    assert.ok(a.visible&&!a.interactive&&!a.body&&a.linear&&a.exact&&a.changed>0&&a.eyeDelta>0&&a.alpha>10000,JSON.stringify(a));
    assert.ok(Math.max(a.w,a.h)>=44&&Math.max(a.w,a.h)<=a.span+.01,JSON.stringify(a));
    assert.ok(a.rect.left>=result.field.left&&a.rect.right<=result.field.right&&a.rect.top>=result.field.top&&a.rect.bottom<=result.field.bottom,JSON.stringify(a));
    assert.ok(!overlap(a.rect,result.boundary)&&!overlap(a.rect,result.blueprint),JSON.stringify(a));
    for(const b of result.entries)if(a.id!==b.id)assert.ok(!overlap(a.rect,b.rect),a.id+' overlaps '+b.id);
   }
   const blink=await page.evaluate(()=>{
    const c=window.__previewGame.scene.getScene('Game').enemyPreview,initial=c.actors.map(a=>[a.image.x,a.image.y,a.image.displayWidth,a.image.displayHeight]),closed=new Set(),reopened=new Set();
    for(let i=0;i<600;i++){
     c.advance(.02);
     c.actors.forEach(a=>{if(a.expression==='closed')closed.add(a.id);else if(closed.has(a.id))reopened.add(a.id);});
    }
    return {closed:closed.size,reopened:reopened.size,stable:c.actors.every((a,i)=>[a.image.x,a.image.y,a.image.displayWidth,a.image.displayHeight].every((v,j)=>v===initial[i][j]))};
   });
   assert.deepEqual(blink,{closed:12,reopened:12,stable:true});
   const png=await page.screenshot({path:join(out,'enemy-'+name+'.png'),scale:'device'});
   // Verify actual display in every enemy's alpha bounds, not only scene objects.
   if(name==='default'||name==='fhd'){
    const visible=await page.evaluate(async ({png,entries})=>{
     const img=new Image();img.src='data:image/png;base64,'+png;await img.decode();
     const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
     const z=img.width/960;
     return entries.map(e=>{const r=e.rect,p=ctx.getImageData(Math.floor(r.left*z),Math.floor(r.top*z),Math.ceil(e.w*z),Math.ceil(e.h*z)).data;let lit=0;for(let i=0;i<p.length;i+=4)if(Math.max(p[i],p[i+1],p[i+2])>70)lit++;return {id:e.id,lit};});
    },{png:png.toString('base64'),entries:result.entries});
    assert.ok(visible.every(a=>a.lit>100),JSON.stringify(visible));
   }
   if(name==='default'){
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
    const elapsed=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed),elapsed);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed>0&&window.__previewGame.scene.isActive('Game'));
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   report.push({name,result,blink,pass:true});console.log('PASS',name,'12 original enemies, shared eyes, static position, no overlap');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'enemy-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' enemy preview configurations');
