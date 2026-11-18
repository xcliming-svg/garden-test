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
 for(const [name,w,h,query,color,width,enabled] of [
  ['default',960,540,'','stone',1,true],['fhd',1920,1080,'?outlineColor=paper','paper',1,true],
  ['silver-thin',960,540,'?outlineColor=silver&outlineWidth=.5','silver',.5,true],
  ['clay-thick-full',960,540,'?full=1&outlineColor=clay&outlineWidth=1.5','clay',1.5,true],
  ['off',960,540,'?outline=0','stone',1,false],
  ['invalid',960,540,'?outlineColor=constructor&outlineWidth=9&pebbles=1&occlusion=enemy&gardenfill=soil&bgtype=7','stone',1,true],
  ['original',960,540,'?svgcolors=original&outlineColor=paper&outlineWidth=.75','paper',.75,true],
  ['light',960,540,'?uitype=1','stone',1,true],
  ['density-sim',960,540,'?densitySim=1','stone',1,true],['density-sim-full',960,540,'?densitySim=1&full=1','stone',1,true]
 ]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[],failures=[],paths=new Set();
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',e=>failures.push(e.url()));
  page.on('response',r=>{if(r.ok())paths.add(new URL(r.url()).pathname);else if(r.status()>=400)failures.push(r.url()+' '+r.status());});
  try{
   await page.addInitScript(()=>{let seed=42;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
   await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return s.fairyPatrol?.actors.length===11&&s.enemyPreview?.entries.length===12&&s.flowerGrowth?.entries.size>0});
   const state=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),P=window.GardenPalette,G=window.GardenSvgPalette;
    const allowed=new Set(Object.values(P.n)),cv=document.createElement('canvas'),ctx=cv.getContext('2d',{willReadFrequently:true});
    function read(key){const im=s.textures.get(key).getSourceImage();cv.width=im.width;cv.height=im.height;ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,cv.width,cv.height).data;let opaque=0,off=0;const colors=new Set();for(let i=0;i<d.length;i+=4){if(d[i+3]===255){const c=(d[i]<<16)|(d[i+1]<<8)|d[i+2];opaque++;colors.add(c);if(!allowed.has(c))off++;}}return {key,opaque,off,colors:[...colors]}}
    const art=s.enemyPreview.entries.map(e=>read('enemy-preview:'+e.id+':base'));
    for(const key of ['fairy:garden:normal','fairy:water:normal','garden-pebble:stone','garden-pebble:silver','fairy:eyes'])art.push(read(key));
    const outlines=[],actors=s.fairyPatrol.actors,config=window.GardenFairyPatrol.outlineConfig,adaptive=window.GardenFairyPatrol.adaptive;
    function bounds(data,w){let l=w,r=-1,t=w,b=-1;for(let i=0;i<data.length;i+=4)if(data[i+3]>=128){const x=i/4%w,y=Math.floor(i/4/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return [l,r,t,b];}
    for(const a of [actors[0],actors[1]]){
     if(!a.outline)continue;
     const base=s.textures.get('fairy:base:'+a.type).getSourceImage(),ring=a.outline.texture.getSourceImage();
     cv.width=cv.height=base.width;ctx.drawImage(base,0,0);const bd=ctx.getImageData(0,0,cv.width,cv.height).data;
     ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(ring,0,0);const rd=ctx.getImageData(0,0,cv.width,cv.height).data;
     const b=bounds(bd,cv.width),r=bounds(rd,cv.width),f=a.image.scaleX;
     let colored=0,inside=0;for(let i=0;i<rd.length;i+=4){if(rd[i+3]===255&&((rd[i]<<16)|(rd[i+1]<<8)|rd[i+2])===(adaptive?0xffffff:P.n[config.color]))colored++;if(bd[i+3]===255&&rd[i+3]>0)inside++;}
     outlines.push({type:a.type,colored,inside,widths:[b[0]-r[0],r[1]-b[1],b[2]-r[2],r[3]-b[3]].map(n=>n*f)});
    }
    const c=s.enemyPreview;
    const enemyChecks={noRing:c.entries.every(e=>!e.outlineKey)&&[...c.sprites.values()].every(o=>!o.outline)&&!s.children.list.some(o=>o.name?.startsWith('enemy-outline:'))};
    const actor=c.actors[0],sprite=c.sprites.get(actor.id);
    c.setExpression(actor.id,'hit');enemyChecks.hit=sprite.image.texture.key.endsWith(':dizzy');
    c.setExpression(actor.id,'auto');
    const oldImage=sprite.image;c.model.damage(actor.id,actor.hp);c.advance(0);
    enemyChecks.removed=!c.sprites.has(actor.id)&&!oldImage.active;
    const initialTint=actors.every(a=>!a.outline||!adaptive||a.outline.tintTopLeft===P.n.stone);
    const hero=actors[0].image,probe=s.add.image(hero.x,hero.y,hero.texture.key).setOrigin(hero.originX,hero.originY).setScale(hero.scaleX,hero.scaleY).setAngle(hero.angle).setFlip(hero.flipX,hero.flipY).setDepth(3.5);
    s.enemyPreview.occlusion.update([probe],.1);
    const fade=hero.alpha,enemyFade=probe.alpha,outlineFade=actors[0].outline?.alpha??null;
    s.enemyPreview.occlusion.update([],.2);probe.destroy();
    s.fairyPatrol.advance(.05);
    const synced=actors.every(a=>!a.outline||a.outline.x===a.image.x&&a.outline.y===a.image.y&&a.outline.rotation===a.image.rotation&&a.outline.flipX===a.image.flipX&&a.outline.depth===a.image.depth&&a.outline.alpha===a.image.alpha&&a.outline.scaleX===a.image.scaleX);
    const L=window.GardenGameLayout,grid=window.GardenDashedGridPreview,soil=s.children.getByName('garden-preview-soil'),field=s.children.getByName('dark-field-pattern'),g=L.spec.garden,z=s.cameras.main.zoom;
    const raster=L.gardenRaster(grid.all(g),g,z),occupied=new Set(s.flowerGrowth.entries.keys()),cellPixel=i=>{
      const x=Math.round((g.x+(i%g.columns)*g.pitch+g.line+g.cell/2)*z)-raster.x;
      const y=Math.round((g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2)*z)-raster.y;
      return Array.from(soil.texture.getSourceImage().getContext('2d').getImageData(x,y,1,1).data);
    };
    const terrain={stones:s.fairyPatrol.border.images.length,points:s.fairyPatrol.boundary.points.length,
      occupied:[...occupied].map(cellPixel),candidates:[...L.gardenCandidates(occupied)].map(cellPixel),
      field:window.GardenDarkFieldPreview.active,fieldPixel:field?Array.from(field.texture.getSourceImage().getContext('2d').getImageData(0,0,1,1).data):null,
      path:s.fairyPatrol.length};
    const F=window.GardenFlowerGrowth;
    for(const n of F.names)for(let stage=1;stage<=3;stage++)art.push(read(F.key(n,stage)));
    return {palette:Object.values(P.hex),reference:P.reference.hex,enabled:G.enabled,art,outlines,enemyChecks,initialTint,adaptive,config,outlineCount:actors.filter(a=>a.outline).length,fade,enemyFade,outlineFade,synced,terrain,actors:s.fairyPatrol.actors.length,enemies:s.enemyPreview.entries.length,flowers:s.flowerGrowth.entries.size};
   });
   assert.equal(state.actors,11);assert.equal(state.flowers,query.includes('full=1')?100:4);
   assert.deepEqual(state.config,{enabled,color,width,hex:state.palette[Object.keys({bark:0,stone:0,clay:0,silver:0,paper:0,sand:0,gold:0,red:0,redDark:0,pink:0,growth:0,growthLight:0,sky:0,skyLight:0,lavender:0,violet:0}).indexOf(color)]});
   assert.equal(state.outlineCount,enabled?11:0);assert.ok(state.synced);assert.equal(state.fade,1);assert.equal(state.enemyFade,.5);assert.equal(state.outlineFade,enabled?1:null);
   for(const a of state.outlines){assert.ok(a.colored>0&&a.inside===0&&a.widths.every(w=>Math.abs(w-width)<=.35),JSON.stringify(a));}
   assert.ok(state.initialTint);
   assert.ok(Object.values(state.enemyChecks).every(Boolean),JSON.stringify(state.enemyChecks));
   const terrain=state.terrain;
   assert.equal(terrain.stones,0);assert.ok(terrain.points>20);
   if(name!=='light')assert.ok(terrain.occupied.every(p=>p[3]===0)&&terrain.candidates.every(p=>p[3]===0));
   assert.equal(terrain.field,name==='light'?0:6);
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
   if(name==='default'){
    const reversal=await page.evaluate(()=>{
     const s=window.__previewGame.scene.getScene('Game'),F=s.fairyPatrol,A=window.GardenFairyPatrol,T=A.densityTuning,d=A.createDensity();
     const check=(v,m)=>{if(!v)throw Error(m);};
     const step=(n,seconds)=>{let v;for(let t=0;t<seconds-1e-9;t+=.05)v=d.update(n,Math.min(.05,seconds-t));return v;};
     check(step(T.enter-1,5).mix===0,'higher entry threshold');
     check(step(T.enter,2).mix===0,'two-second density spike ignored');
     step(T.enter-1,.1);
     check(step(T.enter,T.enterHold).mix===0,'entry hold');
     const rising=step(T.enter,1);
     check(rising.mix>0&&rising.mix<.25,'slow rise after one second');
     const before=step(T.exit,T.exitHold-.05);
     check(before.dense&&before.mix<1,'release hold while rising');
     const turn=step(T.exit,.05);
     check(!turn.dense&&turn.mix>0&&turn.mix<1&&turn.transitions===2,'reverse before reaching paper');
     check(turn.mix-before.mix<.03,'no brightness jump on reversal');
     const down=step(T.exit,.25);
     check(down.mix<turn.mix&&down.mix>0,'smooth partial return');
     const beforeRise=step(T.enter,T.enterHold-.05);
     const turnUp=step(T.enter,.05);
     check(turnUp.dense&&turnUp.mix>0&&Math.abs(turnUp.mix-beforeRise.mix)<.03,'reverse again before stone');
     check(step(T.enter,4).mix===1,'complete full-duration rise');
     check(step(T.exit+1,5).mix===1,'hysteresis dead band');
     check(step(T.exit,T.exitHold+3).mix===0,'complete return');
     // Also exercise actual group tint through the controller, not only the state model.
     F.updateDensity(T.enter,T.enterHold);F.updateDensity(T.enter,1);
     const visible=F.density.snapshot(),tint=A.mixColor(visible.mix);
     check(visible.mix>0&&visible.mix<1&&F.actors.every(a=>a.outline.tintTopLeft===tint&&a.outline.alpha===1),'group partially bright');
     F.updateDensity(T.exit,T.exitHold);const actualTurn=F.density.snapshot();
     F.updateDensity(T.exit,1);const actualDown=F.density.snapshot();
     check(actualDown.mix<actualTurn.mix&&actualDown.mix>0&&F.actors.every(a=>a.outline.tintTopLeft===A.mixColor(actualDown.mix)),'group reverses together');
     F.updateDensity(T.exit,3);
     return {rising:rising.mix,before:before.mix,reversal:turn.mix,down:down.mix,reverseAgain:turnUp.mix,actualTurn:actualTurn.mix,actualDown:actualDown.mix,final:F.density.snapshot().mix};
    });
    assert.equal(reversal.final,0);console.log('PASS partial reversal',JSON.stringify(reversal));
   }
   if(name.startsWith('density-sim')){
    const timeline=[];
    for(const end of [8,20,32,42,55,65,75,85,95,105]){
     const sample=await page.evaluate(end=>{
      const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,F=s.fairyPatrol,P=window.GardenPalette.n;
      const series=[];
      while(c.elapsed<end-1e-6){
       const dt=Math.min(.1,end-c.elapsed);F.advance(dt);c.advance(dt);
       const d=F.density.snapshot(),tint=window.GardenFairyPatrol.mixColor(d.mix);
       if(!F.actors.every(a=>a.outline.tintTopLeft===tint&&a.outline.alpha===a.image.alpha))throw Error('group tint out of sync');
       if(s.children.list.some(o=>o.name?.startsWith('enemy-outline:')))throw Error('enemy outline exists');
       series.push({t:c.elapsed,count:c.actors.length,near:d.near,mix:d.mix,transitions:d.transitions});
      }
      return {series,at:c.elapsed,count:c.actors.length,...F.density.snapshot(),tint:F.actors[0].outline.tintTopLeft};
     },end);
     timeline.push(...sample.series);console.log('DENSITY',name,end,JSON.stringify({...sample,series:undefined}));
     if([8,32,42,55,75,95].includes(end))await page.screenshot({path:join(out,name+'-'+end+'.png')});
    }
    const bright=timeline.find(d=>d.mix===1),partial=timeline.filter(d=>d.mix>0&&d.mix<1),last=timeline.at(-1);
    assert.ok(bright,JSON.stringify({max:Math.max(...timeline.map(d=>d.near))}));
    assert.ok(partial.length>=40);assert.equal(last.mix,0);assert.equal(last.count,0);assert.equal(last.transitions,2);
    assert.ok(timeline.filter(d=>d.t<=8).every(d=>d.mix===0));
    writeFileSync(join(out,name+'.json'),JSON.stringify(timeline,null,2));
   }
   results.push({name,pass:true,art:state.art.map(a=>({key:a.key,opaque:a.opaque,off:a.off}))});
   console.log('PASS',name,state.art.length,'loaded textures',JSON.stringify({outlines:state.outlines,enemyChecks:state.enemyChecks,fade:state.fade,synced:state.synced,terrain:{stones:terrain.stones,field:terrain.field,path:terrain.path}}));
  }finally{await page.close();}
 }
 writeFileSync(join(out,'garden16-v9.json'),JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
