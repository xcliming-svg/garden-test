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
const report=[];
try{
 for(const [name,w,h,query,expected] of [
  ['off',960,540,'?full=1',[false,false,false,false,false,false,false,false]],
  ['on',960,540,'?full=1&clarity=1',[true,true,true,true,true,true,false,false]],
  ['overrides',640,360,'?full=1&clarity=1&heroMarker=0&flowerFocus=0&enemyBrightness=85&enemySaturation=65',[true,true,true,false,false,true,false,false]],
  ['tone',960,540,'?full=1&enemyTone=1',[true,false,false,false,false,false,false,false]],
  ['outline',960,540,'?fairyOutline=1',[false,true,false,false,false,false,false,false]],
  ['sort',960,540,'?ySort=1',[false,false,true,false,false,false,false,false]],
  ['marker',960,540,'?heroMarker=1',[false,false,false,true,false,false,false,false]],
  ['focus',960,540,'?flowerFocus=1',[false,false,false,false,true,false,false,false]],
  ['occlusion',960,540,'?full=1&heroOcclusion=1',[false,false,false,false,false,true,false,false]],
  ['occlusion-sort',640,360,'?heroOcclusion=1&ySort=1&occlusionAlpha=40',[false,false,true,false,false,true,false,false]],
  ['occlusion-off',960,540,'?full=1&clarity=1&heroOcclusion=0',[true,true,true,true,true,false,false,false]],
  ['water-occlusion',960,540,'?waterOcclusion=1',[false,false,false,false,false,false,true,false]],
  ['flower-occlusion',960,540,'?full=1&flowerOcclusion=1',[false,false,false,false,false,false,false,true]],
  ['all-occlusion',640,360,'?full=1&clarity=1&waterOcclusion=1&flowerOcclusion=1&occlusionAlpha=40',[true,true,true,true,true,true,true,true]],
  ['flower-heads',960,540,'?flowerheads=1&flowerOcclusion=1',[false,false,false,false,false,false,false,true]],
  ['explicit-off',960,540,'?full=1&clarity=1&heroOcclusion=0&waterOcclusion=0&flowerOcclusion=0',[true,true,true,true,true,false,false,false]],
  ['shadow-off',960,540,'?full=1&shadows=0',[false,false,false,false,false,false,false,false]],
  ['shadow-enemy',960,540,'?shadows=0&enemyShadow=1',[false,false,false,false,false,false,false,false]],
  ['shadow-fairy',640,360,'?shadows=0&fairyShadow=1',[false,false,false,false,false,false,false,false]],
  ['shadow-legacy',960,540,'?full=1&shadowStyle=dark',[false,false,false,false,false,false,false,false]],
  ['shadow-light',960,540,'?uitype=1',[false,false,false,false,false,false,false,false]],
  ['flower-tone',960,540,'?full=1&flowerTone=1',[false,false,false,false,false,false,false,false]],
  ['flower-tone-subtle',640,360,'?flowerTone=1&flowerBrightness=95&flowerSaturation=80&flowerContrast=95',[false,false,false,false,false,false,false,false]],
  ['flower-tone-heads',960,540,'?flowerheads=1&flowerTone=1',[false,false,false,false,false,false,false,false]],
  ['enemy-outline',960,540,'?full=1&enemyOutline=1',[false,false,false,false,false,false,false,false]],
  ['enemy-outline-light',640,360,'?enemyOutline=1&enemyOutlineColor=light&enemyOutlineWidth=1.5',[false,false,false,false,false,false,false,false]],
  ['flower-enemy-combined',960,540,'?full=1&clarity=1&flowerTone=1&enemyOutline=1&flowerOcclusion=1',[true,true,true,true,true,true,false,true]],
  ['new-options-off',960,540,'?full=1&clarity=1&flowerTone=0&enemyOutline=0',[true,true,true,true,true,true,false,false]],
  ['combat',960,540,'?combat=1&clarity=1&flowerTone=1&enemyOutline=1',[true,true,true,true,true,true,false,false]]
 ]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[],failed=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failed.push(r.url()));
  try{
   await page.addInitScript(()=>{let seed=42;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
   await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return !!(s.enemyPreview||s.combatPreview);});
   const result=await page.evaluate(({name,expected})=>{
    const s=window.__previewGame.scene.getScene('Game'),C=window.GardenClarityPreview,c=s.enemyPreview,F=s.fairyPatrol,L=window.GardenGameLayout.spec;
    const cfg=C.config,flags=['enemyTone','fairyOutline','ySort','heroMarker','flowerFocus','heroOcclusion','waterOcclusion','flowerOcclusion'].map(k=>cfg[k]);
    if(name==='combat')return {flags,combat:!!s.combatPreview,marker:!!s.children.getByName('clarity:hero-marker'),focus:!!s.children.getByName('clarity:flower-focus'),enemies:!!c,flowerToneApplied:s.children.list.some(im=>im.name?.startsWith('garden-preview-flower:')&&im.texture?.key?.startsWith('clarity:flower-tone:'))};
    // Advance only model and render once, rather than 7,500 synchronous GPU
    // render calls. Capture real WebGL scene at the same elapsed population.
    c.advance(Math.max(0,120-c.elapsed));F.advance(Math.max(0,120-F.elapsed));s.flowerGrowth?.render(F.elapsed);c.advance(0);
    const actors=c.actors,hero=F.actors[0],fairies=F.actors,S=window.GardenGroundShadow;
    const close=(a,b)=>Math.abs(a-b)<1e-5,style=S.style(),base=style.alpha;
    let enemyShadows=0,fairyShadows=0,shadowOK=true;
    for(const a of actors){const {shadow,image}=c.sprites.get(a.id),p=a.pose;
      enemyShadows+=Number(shadow.visible);
      shadowOK&&=shadow.visible===S.config.enemy&&shadow.depth===.75&&shadow.depth<image.depth&&shadow.mask===image.mask&&close(shadow.x,p.x)&&close(shadow.y,p.ground+style.offset)&&close(shadow.displayWidth,a.entry.width*.72*style.scaleX*Math.max(.5,1-p.lift*.009))&&close(shadow.displayHeight,Math.max(3,a.entry.height*.16)*style.scaleY)&&close(shadow.alpha,base/(1+p.lift*.055));
    }
    for(const a of fairies){const {shadow,image}=a,lift=a.center.y+a.visibleHeight/2-image.y;
      fairyShadows+=Number(shadow.visible);
      shadowOK&&=shadow.visible===S.config.fairy&&shadow.depth===.75&&shadow.depth<image.depth&&close(shadow.x,image.x)&&close(shadow.y,a.center.y+a.visibleHeight/2+style.offset)&&close(shadow.displayWidth,a.visibleHeight*.48*style.scaleX*Math.max(.5,1-lift*.009))&&close(shadow.displayHeight,a.visibleHeight*.15*style.scaleY)&&close(shadow.alpha,base/(1+lift*.055));
    }
    const shadowSizes={hero:[hero.shadow.displayWidth,hero.shadow.displayHeight],water:[fairies[1].shadow.displayWidth,fairies[1].shadow.displayHeight]};
    const marker=s.children.getByName('clarity:hero-marker'),focus=s.children.getByName('clarity:flower-focus');
    let enemyOK=true,fairyOK=true,alphaOK=true,toneChanged=0,outlineAdded=0,bodyChanged=0;
    for(const a of actors){
     const im=c.sprites.get(a.id).image,k=window.GardenEnemyPreview.key(a.entry.id,a.expression);
     const body=cfg.enemyTone?C.toneKey(k):k;
     enemyOK&&=im.texture.key===(cfg.enemyOutline?C.enemyOutlineKey(body,a.entry.scale):body)&&Math.abs(im.depth-((cfg.ySort?2:3)+a.pose.ground/L.height))<1e-9;
    }
    const tex=(k)=>{const src=s.textures.get(k).getSourceImage();if(typeof src.getContext==='function')return src.getContext('2d').getImageData(0,0,src.width,src.height).data;
      const canvas=document.createElement('canvas');canvas.width=src.width;canvas.height=src.height;const ctx=canvas.getContext('2d');ctx.drawImage(src,0,0);return ctx.getImageData(0,0,src.width,src.height).data;};
    let enemyOutlineAdded=0,enemyBodyChanged=0,enemyOutlineCount=0,enemyClipped=0;
    if(cfg.enemyOutline)for(const e of c.entries)for(const expression of ['normal','closed','angry','dizzy']){
      const k=window.GardenEnemyPreview.key(e.id,expression),body=cfg.enemyTone?C.toneKey(k):k,outlined=C.enemyOutlineKey(body,e.scale);
      const a=tex(body),b=tex(outlined),w=s.textures.get(body).getSourceImage().width,h=s.textures.get(body).getSourceImage().height;
      let added=0;
      for(let i=0;i<a.length;i+=4){
        if(a[i+3]===0&&b[i+3]>0){added++;const x=i/4%w,y=Math.floor(i/4/w);if(x===0||x===w-1||y===0||y===h-1)enemyClipped++;}
        if(a[i+3]===255&&[0,1,2,3].some(j=>a[i+j]!==b[i+j]))enemyBodyChanged++;
      }
      if(added>0)enemyOutlineCount++;enemyOutlineAdded+=added;
    }
    if(cfg.enemyTone){
      const k=window.GardenEnemyPreview.key(c.entries[0].id,'normal'),a=tex(k),b=tex(C.toneKey(k));
      for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])alphaOK=false;if(a[i+3]===255&&[0,1,2].some(j=>a[i+j]!==b[i+j]))toneChanged++;}
    }
    for(const a of fairies){
      const k=window.GardenFairyPatrol.key(a.type,a.expression);
      fairyOK&&=(cfg.fairyOutline?a.image.texture.key.startsWith('clarity:outline:'):a.image.texture.key===k);
      fairyOK&&=Math.abs(a.image.depth-(2+(cfg.ySort?(a.center.y+a.visibleHeight/2)/L.height+.000001:a.center.y/L.height)))<1e-9;
    }
    if(cfg.fairyOutline){
      const a=tex(window.GardenFairyPatrol.key(hero.type,hero.expression)),b=tex(hero.image.texture.key);
      for(let i=0;i<a.length;i+=4){if(a[i+3]===0&&b[i+3]>0)outlineAdded++;if(a[i+3]===255&&[0,1,2,3].some(j=>a[i+j]!==b[i+j]))bodyChanged++;}
    }
    const flowers=s.flowerGrowth?[...s.flowerGrowth.entries.values()].map(e=>e.image):s.children.list.filter(im=>im.name?.startsWith('garden-preview-flower:'));
    let flowerToneOK=true,flowerAlphaChanged=0,flowerChanged=0,flowerChromaBefore=0,flowerChromaAfter=0,flowerPeakBefore=0,flowerPeakAfter=0,flowerStates=0;
    const prefix='clarity:flower-tone:';
    for(const im of flowers)flowerToneOK&&=im.texture.key.startsWith(prefix)===cfg.flowerTone;
    if(cfg.flowerTone){
      const keys=new Set(flowers.map(im=>im.texture.key.slice(prefix.length)));
      // Check every growth stage and HP expression, without altering live state.
      if(s.flowerGrowth)for(const name of window.GardenFlowerGrowth.names)for(const stage of [1,2,3])for(const hp of [100,66,33])keys.add(window.GardenFlowerGrowth.key(name,stage,hp));
      for(const k of keys){
        const target=C.flowerTexture(s,k),a=tex(k),b=tex(target);flowerStates++;
        const expected=C.flowerPixels(new Uint8ClampedArray(a));
        for(let i=0;i<a.length;i+=4){
          if(a[i+3]!==b[i+3])flowerAlphaChanged++;
          if(!a[i+3])continue;
          // Browser canvas premultiplies partially transparent AA pixels.
          // Alpha must be exact; compare color math on fully opaque pixels.
          if(a[i+3]!==255)continue;
          if([0,1,2].some(j=>b[i+j]!==expected[i+j]))flowerToneOK=false;
          if([0,1,2].some(j=>a[i+j]!==b[i+j]))flowerChanged++;
          const av=[a[i],a[i+1],a[i+2]],bv=[b[i],b[i+1],b[i+2]];
          flowerChromaBefore+=Math.max(...av)-Math.min(...av);flowerChromaAfter+=Math.max(...bv)-Math.min(...bv);
          flowerPeakBefore=Math.max(flowerPeakBefore,...av);flowerPeakAfter=Math.max(flowerPeakAfter,...bv);
        }
      }
    }
    const groups=[[hero.image],fairies.slice(1).map(a=>a.image),flowers];
    const enabled=[cfg.heroOcclusion,cfg.waterOcclusion,cfg.flowerOcclusion];
    const targets=groups.flatMap((g,i)=>enabled[i]?g.map(C.occlusionShape):[]);
    let faded=0,alphaMismatch=0,behindFaded=0;
    for(const a of actors){
      const im=c.sprites.get(a.id).image,shape=C.occlusionShape(im);
      const expectedAlpha=targets.some(t=>C.coversHero(t,shape))?cfg.occlusionAlpha:1;
      if(im.alpha<1)faded++;
      if(im.alpha<1&&!targets.some(t=>t.depth<im.depth))behindFaded++;
      if(Math.abs(im.alpha-expectedAlpha)>1e-9)alphaMismatch++;
    }
    // Move each target group away temporarily, then isolate one representative
    // of each type. Exercise the real render loop, including depth and restore.
    const originals=groups.flat().map(im=>({im,x:im.x,y:im.y,depth:im.depth}));
    const chosen=actors.find(a=>{const im=c.sprites.get(a.id).image;return im.y>60&&im.y<L.height-L.bottom-40;});
    const im=c.sprites.get(chosen.id).image;
    const testResults=[];
    for(const group of groups){
      for(const o of originals)o.im.setPosition(-1000,-1000);
      const target=group[0],shape=C.occlusionShape(target);
      // Align visible bounding-box centers, not transparent sprite margins.
      const enemy=C.occlusionShape(im);
      target.setPosition(target.x+(enemy.l+enemy.r-shape.l-shape.r)/2,target.y+(enemy.t+enemy.b-shape.t-shape.b)/2).setDepth(im.depth-.01);
      c.advance(0);
      const overlap=C.coversHero(C.occlusionShape(target),C.occlusionShape(im)),overlapAlpha=im.alpha;
      target.setDepth(im.depth+.01);c.advance(0);const behindAlpha=im.alpha;
      target.setPosition(-1000,-1000).setDepth(im.depth-.01);c.advance(0);const restoredAlpha=im.alpha;
      testResults.push({overlap,overlapAlpha,behindAlpha,restoredAlpha});
    }
    for(const o of originals)o.im.setPosition(o.x,o.y).setDepth(o.depth);
    c.advance(0);
    const targetCount=C.occlusionTargets(s,F).length;
    const allUnchanged=groups.flat().every(im=>im.alpha===1);
    // Synthetic masks: crossing transparent margins must not trigger a fade.
    const mask=(x)=>{const a=new Uint8Array(16);a[x]=1;return {w:4,h:4,mask:a};};
    const shape=(m,depth)=>({m,sx:1,sy:1,cos:1,sin:0,ox:0,oy:0,x:0,y:0,l:0,t:0,r:4,b:4,depth});
    const transparentRejected=!C.coversHero(shape(mask(0),2),shape(mask(15),3));
    const opaqueAccepted=C.coversHero(shape(mask(0),2),shape(mask(0),3));
    return {flags,enemyOK,flowerTone:cfg.flowerTone,enemyOutline:cfg.enemyOutline,flowerToneOK,flowerAlphaChanged,flowerChanged,flowerChromaBefore,flowerChromaAfter,flowerPeakBefore,flowerPeakAfter,flowerStates,enemyOutlineAdded,enemyBodyChanged,enemyOutlineCount,enemyClipped,outlineWidth:cfg.enemyOutlineWidth,outlineColor:cfg.enemyOutlineColor,flowerBrightness:cfg.flowerBrightness,flowerSaturation:cfg.flowerSaturation,flowerContrast:cfg.flowerContrast,shadowOK,enemyShadows,fairyShadows,shadowSizes,faded,alphaMismatch,behindFaded,testResults,targetCount,allUnchanged,transparentRejected,opaqueAccepted,occlusionAlpha:cfg.occlusionAlpha,fairyOK,alphaOK,toneChanged,outlineAdded,bodyChanged,count:actors.length,flowers:flowers.length,
     heroHeight:hero.visibleHeight,waterHeight:fairies[1].visibleHeight,marker:!!marker,focus:!!focus,markerDepth:marker?.depth,
     markerX:marker?.x,heroX:hero.image.x,focusDepth:focus?.depth,brightness:cfg.brightness,saturation:cfg.saturation,
     rings:s.children.list.filter(o=>o.name?.startsWith('clarity:')&&o.name.includes('ring')).length};
   },{name,expected});
   assert.deepEqual(result.flags,expected);
   if(name==='combat'){assert.ok(result.combat&&!result.marker&&!result.focus&&!result.enemies&&!result.flowerToneApplied);}
   else{
    assert.ok(result.enemyOK&&result.fairyOK&&result.alphaOK,JSON.stringify(result));assert.equal(result.count,200);assert.equal(result.flowers,query.includes('full=1')?100:4);
    assert.equal(result.flowerTone,query.includes('flowerTone=1'));
    assert.equal(result.enemyOutline,query.includes('enemyOutline=1'));
    assert.ok(result.flowerToneOK&&result.flowerAlphaChanged===0,JSON.stringify(result));
    if(result.flowerTone){assert.ok(result.flowerChanged>0&&result.flowerChromaAfter<result.flowerChromaBefore&&result.flowerPeakAfter<result.flowerPeakBefore,JSON.stringify(result));assert.ok(result.flowerStates===(name==='flower-tone-heads'?4:54));}
    if(result.enemyOutline){assert.equal(result.enemyOutlineCount,48);assert.ok(result.enemyOutlineAdded>0&&result.enemyBodyChanged===0&&result.enemyClipped===0,JSON.stringify(result));}
    if(name==='enemy-outline-light'){assert.equal(result.outlineColor,'light');assert.equal(result.outlineWidth,1.5);}
    if(name==='flower-tone-subtle'){assert.equal(result.flowerBrightness,.95);assert.equal(result.flowerSaturation,.8);assert.equal(result.flowerContrast,.95);}
    assert.ok(result.shadowOK,JSON.stringify(result));
    assert.equal(result.enemyShadows,['shadow-off','shadow-fairy'].includes(name)?0:200);
    assert.equal(result.fairyShadows,['shadow-off','shadow-enemy'].includes(name)?0:11);
    assert.equal(result.alphaMismatch,0);assert.equal(result.behindFaded,0);
    assert.ok(result.transparentRejected&&result.opaqueAccepted&&result.allUnchanged,JSON.stringify(result));
    assert.equal(result.targetCount,(expected[5]?1:0)+(expected[6]?10:0)+(expected[7]?result.flowers:0));
    for(const [i,test] of result.testResults.entries()){
      assert.ok(test.overlap,JSON.stringify({name,i,test}));
      assert.equal(test.overlapAlpha,expected[5+i]?result.occlusionAlpha:1,JSON.stringify({name,i,test}));
      assert.equal(test.behindAlpha,1);assert.equal(test.restoredAlpha,1);
    }
    if(name==='occlusion-sort')assert.equal(result.occlusionAlpha,.40);
    assert.equal(result.heroHeight,40);assert.ok(Math.abs(result.waterHeight-40*502/716)<.001);
    assert.equal(result.marker,expected[3]);assert.equal(result.focus,expected[4]);assert.equal(result.rings,0);
    if(expected[0])assert.ok(result.toneChanged>0);if(expected[1])assert.ok(result.outlineAdded>0&&result.bodyChanged===0,JSON.stringify(result));
    if(expected[3])assert.ok(result.markerDepth>3&&Math.abs(result.markerX-result.heroX)<.001);
    if(expected[4])assert.equal(result.focusDepth,.8);
    if(name==='overrides'){assert.equal(result.brightness,.85);assert.equal(result.saturation,.65);}
    await page.screenshot({path:join(out,'clarity-'+name+'.png'),scale:'device'});
    if(['off','shadow-light','shadow-legacy'].includes(name)){
      // Freeze simulation while preserving scene rendering. Compare actual
      // framebuffer pixels with each group independently hidden.
      await page.evaluate(()=>{window.__previewGame.scene.pause('Game');});
      await page.waitForFunction(()=>window.__previewGame.scene.isPaused('Game'));
      await page.waitForTimeout(100);
      const foot=await page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game'),sh=s.fairyPatrol.actors[0].shadow,canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect();return {x:r.x+sh.x*r.width/960,y:r.y+sh.y*r.height/540,w:sh.displayWidth*r.width/960,h:sh.displayHeight*r.height/540};});
      const both=await page.screenshot({path:join(out,'shadow-'+name+'-both.png')});
      await page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game');for(const a of s.fairyPatrol.actors)a.shadow.setVisible(false);});
      await page.waitForTimeout(100);
      const enemyOnly=await page.screenshot({path:join(out,'shadow-'+name+'-enemy.png')});
      await page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game');for(const a of s.enemyPreview.sprites.values())a.shadow.setVisible(false);});
      await page.waitForTimeout(100);
      const neither=await page.screenshot({path:join(out,'shadow-'+name+'-none.png')});
      const pixels=await page.evaluate(async ({shots,foot})=>{
        const arrays=[];let width=0,height=0;
        for(const base64 of shots){const im=new Image();im.src='data:image/png;base64,'+base64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;width=c.width;height=c.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);arrays.push(ctx.getImageData(0,0,c.width,c.height).data);}
        function diff(a,b){let changed=0,maxDelta=0;for(let i=0;i<a.length;i+=4){const d=Math.max(...[0,1,2].map(j=>Math.abs(a[i+j]-b[i+j])));if(d>1)changed++;maxDelta=Math.max(maxDelta,d);}return {changed,maxDelta};}
        const hero={changed:0,maxDelta:0,strong:0};for(let y=Math.max(0,Math.floor(foot.y-foot.h/2));y<Math.min(height,Math.ceil(foot.y+foot.h/2));y++)for(let x=Math.max(0,Math.floor(foot.x-foot.w/2));x<Math.min(width,Math.ceil(foot.x+foot.w/2));x++){
          const i=(y*width+x)*4,d=Math.max(...[0,1,2].map(j=>Math.abs(arrays[0][i+j]-arrays[1][i+j])));if(d>1)hero.changed++;if(d>=40)hero.strong++;hero.maxDelta=Math.max(hero.maxDelta,d);
        }
        return {fairy:diff(arrays[0],arrays[1]),enemy:diff(arrays[1],arrays[2]),hero};
      },{shots:[both,enemyOnly,neither].map(b=>b.toString('base64')),foot});
      assert.ok(pixels.fairy.changed>20&&pixels.enemy.changed>20,JSON.stringify(pixels));
      if(name==='off'){assert.ok(pixels.hero.strong>=12&&pixels.hero.maxDelta>=45,JSON.stringify(pixels));assert.ok(pixels.fairy.maxDelta>=45,JSON.stringify(pixels));}
      result.shadowPixels=pixels;
    }
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   report.push({name,...result,pass:true});console.log('PASS',name,JSON.stringify(result));
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'clarity-report.json'),JSON.stringify(report,null,2));}
