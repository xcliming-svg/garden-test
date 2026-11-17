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
// Fixed comparison sizes, relative to 22px flower cells and the 40px garden fairy.
const expectedSpans={"1_butterfly":26,"2_grasshopper":28,"6_mouse":42,"2_gray_bug":30,"1_cat":40,"3_caterpillar":28,"6_sparrow":34,"6_pigeon":42,"4_beetle":34,"2_frog":32,"6_rabbit":40,"5_bulldog":48};
const expectedTypes={"1_butterfly":["fly",1],"2_grasshopper":["jump",1],"6_mouse":["approach",3],"2_gray_bug":["charge",1],"1_cat":["charge",2],"3_caterpillar":["approach",1],"6_sparrow":["fly",2],"6_pigeon":["fly",3],"4_beetle":["approach",2],"2_frog":["jump",2],"6_rabbit":["jump",3],"5_bulldog":["charge",3]};
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
    assert.equal(loaded.size,0);assert.equal(await page.locator('#enemy-preview-controls').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    report.push({name,pass:true});console.log('PASS',name);continue;
   }
   const result=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,L=window.GardenGameLayout.spec,F=s.fairyPatrol,B=F.boundary;
    const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
    ctx.canvas.width=ctx.canvas.height=512;
    const anchors=s.cache.json.get('enemy-preview:anchors'),fm=s.cache.json.get('fairy:manifest');
    const original=!window.GardenSvgPalette.enabled,sharedAtlas=s.textures.get('fairy:eyes').getSourceImage();
    let atlas=sharedAtlas;
    if(!original){atlas=document.createElement('canvas');atlas.width=sharedAtlas.width;atlas.height=sharedAtlas.height;const ec=atlas.getContext('2d');ec.drawImage(sharedAtlas,0,0);ec.globalCompositeOperation='source-in';ec.fillStyle=window.GardenPalette.hex.ink;ec.fillRect(0,0,atlas.width,atlas.height);}
    const pix=(image)=>{if(image instanceof HTMLCanvasElement)return image.getContext('2d').getImageData(0,0,512,512).data;ctx.clearRect(0,0,512,512);ctx.drawImage(image,0,0);return ctx.getImageData(0,0,512,512).data;};
    const entries=c.entries.map(a=>{
     const base=s.textures.get('enemy-preview:'+a.id+':base').getSourceImage(),normal=pix(s.textures.get('enemy-preview:'+a.id+':normal').getSourceImage()),closed=pix(s.textures.get('enemy-preview:'+a.id+':closed').getSourceImage());
     const raw=pix(base),expected=[];
     for(const expression of ['normal','closed']){
      const pixels=new ImageData(new Uint8ClampedArray(raw),512,512);
      ctx.putImageData(original?pixels:window.GardenSvgPalette.apply(pixels),0,0);
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
     return {id:a.id,w:a.width,h:a.height,span:a.span,attackType:a.attackType,level:a.level,changed,eyeDelta,alpha,maxAlpha,opaqueDelta,edgeDelta,
      exact:maxAlpha<=1&&opaqueDelta<=2&&edgeDelta<=4};
    });
    return {entries,field:{left:0,right:L.width,top:L.top,bottom:L.height-L.bottom},
     boundary:{left:B.border.left-B.frame/2,right:B.border.right+B.frame/2,top:B.border.top-B.frame/2,bottom:B.border.bottom+B.frame/2},
     blueprint:{left:L.blueprint.x,right:L.blueprint.x+L.blueprint.width,top:L.blueprint.y,bottom:L.blueprint.y+L.blueprint.height},fairies:F.actors.length,flowers:s.flowerGrowth.entries.size,combat:!!s.combatPreview};
   });
   assert.equal(loaded.size,13);assert.equal(result.entries.length,12);assert.equal(new Set(result.entries.map(e=>e.id)).size,12);
   for(const type of ['approach','jump','charge','fly']){
    const stages=result.entries.filter(e=>e.attackType===type).sort((a,b)=>a.level-b.level);
    assert.deepEqual(stages.map(e=>e.level),[1,2,3]);
    assert.ok(stages[0].span<stages[1].span&&stages[1].span<stages[2].span,type);
   }
   assert.equal(result.fairies,11);assert.equal(result.flowers,name==='full-dpr2'?100:4);assert.equal(result.combat,false);
   assert.equal(await page.locator('select').count(),0);
   for(const a of result.entries){
    assert.ok(a.exact&&a.changed>0&&a.eyeDelta>0&&a.alpha>10000,JSON.stringify(a));
    assert.equal(a.span,expectedSpans[a.id]);assert.deepEqual([a.attackType,a.level],expectedTypes[a.id]);
    assert.ok(Math.abs(Math.max(a.w,a.h)-a.span)<.01,JSON.stringify(a));
   }
   const motions=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,F=s.fairyPatrol,L=window.GardenGameLayout.spec,M=window.GardenEnemyMotion,E=window.GardenEnemyPreview;
    const seen=new Set(),attacked=new Set(),sides=new Set(),entered=new Set(),first=[],serials=new Set();
    let valid=true,maxActive=0,spawnedOutside=true,frames=0;
    for(let i=0;i<4000;i++){
     c.advance(.08);maxActive=Math.max(maxActive,c.actors.length);
     valid&&=c.sprites.size===c.actors.length&&c.actors.length<=E.spawning.maxActive;
     for(const a of c.actors){
      const e=a.entry,p=a.pose,im=c.sprites.get(a.id).image,rad=im.rotation,hw=e.width*p.sx/2,hh=e.height*p.sy/2,ex=Math.abs(Math.cos(rad))*hw+Math.abs(Math.sin(rad))*hh,ey=Math.abs(Math.sin(rad))*hw+Math.abs(Math.cos(rad))*hh;
      const b=F.boundary.border,m=F.boundary.frame/2;
      if(!serials.has(a.id)){serials.add(a.id);first.push(e.id);sides.add(a.path.side);spawnedOutside&&=a.path.side==='left'?p.x+ex<b.left:p.x-ex>b.right;}
      seen.add(e.id);
      valid&&=im.x===p.x&&im.x-ex>=8-1e-6&&im.x+ex<=L.width-8+1e-6&&im.y-ey>=L.top&&im.y+ey<=L.height-L.bottom&&im.texture.key===E.key(e.id,a.expression)&&!im.body&&!im.input&&F.occupied.includes(a.path.flower);
      valid&&=Math.abs((a.path.start-a.path.stage)/M.travelTime(e,a.path,0)-M.speed(e,0))<1e-7;
      if(p.phase==='strike'){attacked.add(e.id);valid&&=a.expression==='angry';}
      if(p.phase==='recover'&&im.x-ex>=b.left+m&&im.x+ex<=b.right-m&&im.y-ey>=b.top+m&&im.y+ey<=b.bottom-m)entered.add(e.id);
     }
     frames++;
     if(seen.size===12&&attacked.size===12&&entered.size===12&&sides.size===2&&c.model.completed>=12)break;
    }
    return {valid,spawnedOutside,seen:[...seen],attacked:[...attacked],entered:[...entered],sides:[...sides],first:first.slice(0,12),maxActive,frames,spawned:c.model.spawned,completed:c.model.completed};
   });
   assert.ok(motions.valid&&motions.spawnedOutside,JSON.stringify(motions));
   assert.equal(motions.seen.length,12);assert.equal(motions.attacked.length,12);assert.equal(motions.entered.length,12);assert.equal(new Set(motions.first).size,12);assert.equal(motions.sides.length,2);assert.ok(motions.maxActive>1&&motions.maxActive<=8&&motions.completed>=12,JSON.stringify(motions));
   await page.screenshot({path:join(out,'enemy-'+name+'.png'),scale:'device'});
   if(name==='default'){
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
    const elapsed=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed),elapsed);
    await page.keyboard.press('Escape');await page.waitForFunction(t=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed>t&&window.__previewGame.scene.isActive('Game'),elapsed);
    await page.setViewportSize({width:800,height:450});
    await page.waitForFunction(()=>Math.abs(document.getElementById('game').getBoundingClientRect().width-800)<1,{},{timeout:8000});
    assert.equal(await page.locator('select').count(),0);
    await page.evaluate(()=>window.__previewGame.scene.stop('Game'));
    await page.waitForFunction(()=>!window.__previewGame.scene.getScene('Game').enemyPreview);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   report.push({name,result,motions,pass:true});console.log('PASS',name,'12 random enemies, default speed, shared eyes, bounded motion');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'enemy-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' enemy preview configurations');
