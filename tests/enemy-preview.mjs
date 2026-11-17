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
const expectedSpans={"1_butterfly":24,"2_grasshopper":24,"6_mouse":34,"2_gray_bug":26,"1_cat":32,"3_caterpillar":24,"6_sparrow":28,"6_pigeon":34,"4_beetle":28,"2_frog":28,"6_rabbit":34,"5_bulldog":40};
const expectedTypes={"1_butterfly":["fly",1],"2_grasshopper":["jump",1],"6_mouse":["approach",3],"2_gray_bug":["charge",1],"1_cat":["charge",2],"3_caterpillar":["approach",1],"6_sparrow":["fly",2],"6_pigeon":["fly",3],"4_beetle":["approach",2],"2_frog":["jump",2],"6_rabbit":["jump",3],"5_bulldog":["charge",3]};
try{
 for(const [name,w,h,dpr,query] of [
  ['default',960,540,1,''],['fhd',1920,1080,1,''],['small',640,360,1,''],
  ['full',960,540,1,'?full=1'],['full-dpr2',960,540,2,'?flower=32&person=56&full=1&slots=36'],
  ['light',960,540,1,'?uitype=1'],['original',960,540,1,'?svgcolors=original'],
  ['hidden',960,540,1,'?enemies=0'],['combat',960,540,1,'?combat=1']
 ]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[],failed=[],loaded=new Set();
  page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push(r.url()));
  page.on('response',r=>{if(/\/assets\/(?:palette16\/)?enemies\//.test(r.url())&&r.ok())loaded.add(new URL(r.url()).pathname)});
  try{
   await page.addInitScript(()=>{let seed=42;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
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
    const atlas=sharedAtlas;
    const pix=(image)=>{if(image instanceof HTMLCanvasElement)return image.getContext('2d').getImageData(0,0,512,512).data;ctx.clearRect(0,0,512,512);ctx.drawImage(image,0,0);return ctx.getImageData(0,0,512,512).data;};
    const entries=c.entries.map(a=>{
     const base=s.textures.get('enemy-preview:'+a.id+':base').getSourceImage(),normal=pix(s.textures.get('enemy-preview:'+a.id+':normal').getSourceImage()),closed=pix(s.textures.get('enemy-preview:'+a.id+':closed').getSourceImage());
     const raw=pix(base),expected=[];
     for(const expression of ['normal','closed']){
      const pixels=new ImageData(new Uint8ClampedArray(raw),512,512);
      ctx.putImageData(pixels,0,0);
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
   assert.equal(result.fairies,11);assert.equal(result.flowers,name.startsWith('full')?100:4);assert.equal(result.combat,false);
   assert.equal(await page.locator('select').count(),0);
   for(const a of result.entries){
    assert.ok(a.exact&&a.changed>0&&a.eyeDelta>0&&a.alpha>10000,JSON.stringify(a));
    assert.equal(a.span,expectedSpans[a.id]);assert.deepEqual([a.attackType,a.level],expectedTypes[a.id]);
    assert.ok(Math.abs(Math.max(a.w,a.h)-a.span)<.01,JSON.stringify(a));
   }
   if(name==='default'||name==='full'){
    const fade=await page.evaluate(()=>{
     const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,O=window.GardenEnemyOcclusion,F=s.fairyPatrol;
     const hero=F.actors[0].image,water=F.actors[1].image,flowers=[...s.flowerGrowth.entries.values()].map(f=>f.image),flower=flowers[0];
     const targets=[hero,water,...flowers];
     const snapshot=()=>targets.map(t=>t.alpha);
     const close=(a,b)=>Math.abs(a-b)<1e-6;
     let checks=0;const check=(v,m)=>{checks++;if(!v)throw Error(m);};
     const update=(enemies,dt)=>c.occlusion.update(enemies,dt);
     update([],1);check(snapshot().every(a=>a===1),'initial opacity');
     // Use identical current silhouettes for deterministic contact and
     // duplicate coverage; separate targets cannot affect one another.
     const clone=t=>s.add.image(t.x,t.y,t.texture.key).setOrigin(t.originX,t.originY)
       .setScale(t.scaleX,t.scaleY).setAngle(t.angle).setFlip(t.flipX,t.flipY).setDepth(4);
     const blockers=[clone(hero),clone(water),clone(flower),clone(flower)];
     update(blockers,.05);check(close(hero.alpha,.75)&&close(water.alpha,.75)&&close(flower.alpha,.7),'100ms fade midpoint');
     update(blockers,.05);check(close(hero.alpha,.5)&&close(water.alpha,.5)&&close(flower.alpha,.4),'fade floors');
     check(blockers.every(b=>b.alpha===1)&&[...c.sprites.values()].every(b=>b.image.alpha===1),'enemies remain opaque');
     const other=flowers.filter(f=>!blockers.some(b=>O.covers(O.shape(f),O.shape(b),{left:0,right:960,top:0,bottom:540})));
     check(other.every(f=>f.alpha===1),'uncovered flowers stay opaque');
     update(blockers,.1);check(close(flower.alpha,.4),'multiple enemies do not multiply fade');
     update([],.1);check(close(hero.alpha,.75)&&close(flower.alpha,.7),'200ms recovery midpoint');
     update([],.1);check(snapshot().every(a=>close(a,1)),'full recovery');
     blockers[0].setDepth(hero.depth);update([blockers[0]],.1);check(hero.alpha===1,'equal depth does not cover');
     update([],1);for(const b of blockers)b.destroy();
     // Real enemy sprite, rotated and mirrored; use actual current alpha masks.
     const e=[...c.sprites.values()][0].image,copy=s.add.image(0,0,e.texture.key).setOrigin(e.originX,e.originY)
       .setScale(-Math.abs(e.scaleX),e.scaleY).setAngle(15).setDepth(4);
     const bounds=O.shape(flower);copy.setPosition((bounds.l+bounds.r)/2,(bounds.t+bounds.b)/2);
     const field={left:0,right:960,top:0,bottom:540};
     check(O.covers(O.shape(flower),O.shape(copy),field),'real enemy silhouette overlaps flower');
     update([copy],.1);check(close(flower.alpha,.4)&&copy.alpha===1,'real enemy keeps opacity and fades flower');
     copy.setPosition(-100,-100);update([copy],.2);check(flower.alpha===1,'real enemy moved away');
     copy.destroy();update([],1);
     // Transparent middle must not cause a false overlap even when the
     // enclosing visible bounds intersect.
     const tex=s.textures.createCanvas('test:occlusion-gap',48,48),ctx=tex.getContext();
     ctx.fillStyle='#fff';ctx.fillRect(0,0,8,48);ctx.fillRect(40,0,8,48);tex.refresh();
     const gap=s.add.image(flower.x,flower.y-8,tex.key).setDepth(4);
     check(!O.covers(O.shape(flower),O.shape(gap),field),'transparent canvas gap does not cover');
     update([gap],.1);check(flower.alpha===1,'transparent gap leaves flower opaque');gap.destroy();s.textures.remove(tex.key);
     update([],1);
     return {checks,flowerAlpha:O.config.flowerAlpha,fairyAlpha:O.config.fairyAlpha};
    });
    console.log('PASS occlusion',name,JSON.stringify(fade));
   }
   const motions=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,F=s.fairyPatrol,L=window.GardenGameLayout.spec,M=window.GardenEnemyMotion,E=window.GardenEnemyPreview;
    const seen=new Set(),attacked=new Set(),sides=new Set(),entered=new Set(),first=[],serials=new Set();
    let valid=true,maxActive=0,spawnedOutside=true,frames=0;
    for(let i=0;i<4000;i++){
     // Simulate every step; sample real sprites every 50 steps, avoiding thousands of redundant texture/render updates.
     c.model.advance(.08);const rendered=i%50===0;if(rendered)c.advance(0);maxActive=Math.max(maxActive,c.actors.length);
     valid&&=c.actors.length<=E.spawning.maxActive&&(!rendered||c.sprites.size===c.actors.length);
     for(const a of c.actors){
      const e=a.entry,p=a.pose,im=rendered?c.sprites.get(a.id).image:null,rad=p.angle*Math.PI/180,y=p.ground-e.height*p.sy/2-p.lift,hw=e.width*p.sx/2,hh=e.height*p.sy/2,ex=Math.abs(Math.cos(rad))*hw+Math.abs(Math.sin(rad))*hh,ey=Math.abs(Math.sin(rad))*hw+Math.abs(Math.cos(rad))*hh;
      const b=F.boundary.border,m=F.boundary.frame/2;
      if(!serials.has(a.id)){serials.add(a.id);first.push(e.id);sides.add(a.path.side);spawnedOutside&&=p.x+ex<b.left||p.x-ex>b.right||y+ey<b.top||y-ey>b.bottom;}
      seen.add(e.id);
      valid&&=p.x-ex>=8-1e-6&&p.x+ex<=L.width-8+1e-6&&F.occupied.includes(a.path.flower);
      if(rendered)valid&&=im.x===p.x&&im.mask&&Math.abs(im.y-y)<1e-6&&Math.abs(im.rotation-rad)<1e-6&&((im.scaleX<0)===p.flip)&&im.texture.key===E.key(e.id,a.expression)&&!im.body&&!im.input;
      valid&&=Math.abs((a.path.start-a.path.stage)/M.travelTime(e,a.path,0)-M.speed(e,0))<1e-7;
      if(p.phase==='strike'){attacked.add(e.id);valid&&=a.expression==='angry'&&y-ey>=L.top&&y+ey<=L.height-L.bottom;}
      valid&&=p.flip===(a.path.ux<0?p.phase!=='return':a.path.ux>0?p.phase==='return':false);
      if(p.phase==='recover'&&p.x-ex>=b.left+m&&p.x+ex<=b.right-m&&y-ey>=b.top+m&&y+ey<=b.bottom-m)entered.add(e.id);
     }
     frames++;
     if(seen.size===12&&attacked.size===12&&entered.size===12&&sides.size===8&&c.model.completed>=12)break;
    }
    c.advance(0);valid&&=c.sprites.size===c.actors.length;
    return {valid,spawnedOutside,seen:[...seen],attacked:[...attacked],entered:[...entered],sides:[...sides],first:first.slice(0,12),maxActive,frames,spawned:c.model.spawned,completed:c.model.completed};
   });
   assert.ok(motions.valid&&motions.spawnedOutside,JSON.stringify(motions));
   assert.equal(motions.seen.length,12);assert.equal(motions.attacked.length,12);assert.equal(motions.entered.length,12);assert.equal(new Set(motions.first).size,12);assert.equal(motions.sides.length,8);assert.ok(motions.maxActive>1&&motions.maxActive<=200&&motions.completed>=12,JSON.stringify(motions));
   await page.screenshot({path:join(out,'enemy-'+name+'.png'),scale:'device'});
   let swarm=null;
   if(name==='default'||name==='full'){
    swarm=await page.evaluate(async()=>{
     const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,F=s.fairyPatrol,E=window.GardenEnemyPreview,L=window.GardenGameLayout.spec;
     c.advance(Math.max(0,120-c.elapsed));c.advance(.5);
     const sample=()=>{
      const visible=c.actors.filter(a=>{const im=c.sprites.get(a.id).image,e=a.entry,p=a.pose;
       return im.y+e.height*p.sy/2>L.top&&im.y-e.height*p.sy/2<L.height-L.bottom;
      }).length;
      return {count:c.actors.length,sprites:c.sprites.size,visible,flowers:s.flowerGrowth.entries.size,
       fairyHeight:F.actors[0].visibleHeight,waterHeight:F.actors[1].visibleHeight,levels:[1,2,3].map(l=>c.actors.filter(a=>a.entry.level===l).length)};
     };
     const before=sample();let timestamps=[];
     await new Promise(resolve=>{function tick(t){timestamps.push(t);if(timestamps.length===61)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
     const delta=timestamps.slice(1).map((t,i)=>t-timestamps[i]).sort((a,b)=>a-b),after=sample();
     return {before,after,target:c.targetCount,cap:E.spawning.maxActive,medianFrameMs:delta[30],p95FrameMs:delta[57]};
    });
    assert.equal(swarm.target,200);assert.equal(swarm.cap,200);
    for(const v of [swarm.before,swarm.after]){
     assert.ok(v.count>=192&&v.count<=200&&v.sprites===v.count&&v.visible>=100,JSON.stringify(swarm));
     assert.equal(v.flowers,name==='full'?100:4);assert.equal(v.fairyHeight,40);assert.ok(Math.abs(v.waterHeight-40*502/716)<.001);
    }
    await page.screenshot({path:join(out,'swarm-200-'+name+'.png'),scale:'device'});
    console.log('SWARM',name,JSON.stringify(swarm));
   }
   if(name==='default'){
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
    const elapsed=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed),elapsed);
    await page.keyboard.press('Escape');await page.waitForFunction(t=>window.__previewGame.scene.getScene('Game').enemyPreview.elapsed>t&&window.__previewGame.scene.isActive('Game'),elapsed);
    await page.setViewportSize({width:800,height:450});
    await page.waitForFunction(()=>Math.abs(document.getElementById('game').getBoundingClientRect().width-800)<1,{},{timeout:8000});
    assert.equal(await page.locator('select').count(),0);
    await page.evaluate(()=>{window.__previewGame.scene.stop('Game');});
    await page.waitForFunction(()=>!window.__previewGame.scene.getScene('Game').enemyPreview);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   report.push({name,result,motions,swarm,pass:true});console.log('PASS',name,'12 random enemies, eight directions, default speed, shared eyes');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'enemy-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' enemy preview configurations');
