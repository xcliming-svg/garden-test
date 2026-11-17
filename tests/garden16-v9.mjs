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
  ['light',960,540,'?uitype=1','stone',1,true]
 ]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[],failures=[],paths=new Set();
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',e=>failures.push(e.url()));
  page.on('response',r=>{if(r.ok())paths.add(new URL(r.url()).pathname);else if(r.status()>=400)failures.push(r.url()+' '+r.status());});
  try{
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
    const outlines=[],actors=s.fairyPatrol.actors,config=window.GardenFairyPatrol.outlineConfig;
    function bounds(data,w){let l=w,r=-1,t=w,b=-1;for(let i=0;i<data.length;i+=4)if(data[i+3]>=128){const x=i/4%w,y=Math.floor(i/4/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return [l,r,t,b];}
    for(const a of [actors[0],actors[1]]){
     if(!a.outline)continue;
     const base=s.textures.get('fairy:base:'+a.type).getSourceImage(),ring=a.outline.texture.getSourceImage();
     cv.width=cv.height=base.width;ctx.drawImage(base,0,0);const bd=ctx.getImageData(0,0,cv.width,cv.height).data;
     ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(ring,0,0);const rd=ctx.getImageData(0,0,cv.width,cv.height).data;
     const b=bounds(bd,cv.width),r=bounds(rd,cv.width),f=a.image.scaleX;
     let colored=0,inside=0;for(let i=0;i<rd.length;i+=4){if(rd[i+3]===255&&((rd[i]<<16)|(rd[i+1]<<8)|rd[i+2])===P.n[config.color])colored++;if(bd[i+3]===255&&rd[i+3]>0)inside++;}
     outlines.push({type:a.type,colored,inside,widths:[b[0]-r[0],r[1]-b[1],b[2]-r[2],r[3]-b[3]].map(n=>n*f)});
    }
    const c=s.enemyPreview,enemyOutlines=[];
    for(const e of c.entries){
     if(!e.outlineKey)continue;
     const base=s.textures.get('enemy-preview:'+e.id+':base').getSourceImage(),ring=s.textures.get(e.outlineKey).getSourceImage(),pad=e.outlinePad;
     cv.width=ring.width;cv.height=ring.height;
     ctx.drawImage(base,pad,pad);const bd=ctx.getImageData(0,0,cv.width,cv.height).data;
     ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(ring,0,0);const rd=ctx.getImageData(0,0,cv.width,cv.height).data;
     const b=bounds(bd,cv.width),r=bounds(rd,cv.width);
     let colored=0,inside=0;for(let i=0;i<rd.length;i+=4){if(rd[i+3]===255&&((rd[i]<<16)|(rd[i+1]<<8)|rd[i+2])===P.n[config.color])colored++;if(bd[i+3]===255&&rd[i+3]>0)inside++;}
     enemyOutlines.push({id:e.id,colored,inside,widths:[b[0]-r[0],r[1]-b[1],b[2]-r[2],r[3]-b[3]].map(n=>n*e.scale)});
    }
    const syncEnemy=(actor,sprite)=>{
     const {image,outline}=sprite,pad=actor.entry.outlinePad;
     return !config.enabled?!outline:!!outline&&outline.texture.key===actor.entry.outlineKey&&outline.mask===image.mask&&
       outline.x===image.x&&outline.y===image.y&&outline.rotation===image.rotation&&outline.scaleX===image.scaleX&&outline.scaleY===image.scaleY&&
       outline.flipX===image.flipX&&outline.flipY===image.flipY&&outline.depth===image.depth&&outline.alpha===image.alpha&&outline.visible===image.visible&&
       Math.abs(outline.displayOriginX-image.displayOriginX-pad)<1e-6&&Math.abs(outline.displayOriginY-image.displayOriginY-pad)<1e-6;
    };
    const actor=c.actors[0],sprite=c.sprites.get(actor.id),enemyInitial=syncEnemy(actor,sprite);
    c.setExpression(actor.id,'hit');const hitSynced=syncEnemy(actor,sprite)&&sprite.image.texture.key.endsWith(':dizzy');
    const fairy=actors[0].image,shape=window.GardenEnemyOcclusion.shape(fairy),body=sprite.image;
    body.setPosition((shape.l+shape.r)/2,(shape.t+shape.b)/2).setAlpha(1);
    window.GardenFairyPatrol.syncOutline(sprite,actor.entry.outlinePad);
    c.occlusion.update([body],.1);
    const enemyOverlap=body.alpha===.5&&(!sprite.outline||sprite.outline.alpha===.5);
    body.setPosition(-100,-100);c.occlusion.update([body],.2);
    const enemyRecovery=body.alpha===1&&(!sprite.outline||sprite.outline.alpha===1);
    c.setExpression(actor.id,'auto');c.advance(0);
    const enemyRestored=syncEnemy(actor,sprite);
    const oldOutline=sprite.outline,oldImage=sprite.image;
    c.model.damage(actor.id,actor.hp);c.advance(0);
    const removed=!c.sprites.has(actor.id)&&!oldImage.active&&(!oldOutline||!oldOutline.active)&&!s.children.getByName('enemy-outline:'+actor.id);
    const enemySynced=c.actors.every(a=>syncEnemy(a,c.sprites.get(a.id)));
    const enemyChecks={enemyInitial,hitSynced,enemyOverlap,enemyRecovery,enemyRestored,removed,enemySynced};
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
    return {palette:Object.values(P.hex),reference:P.reference.hex,enabled:G.enabled,art,outlines,enemyOutlines,enemyChecks,config,outlineCount:actors.filter(a=>a.outline).length,fade,enemyFade,outlineFade,synced,terrain,actors:s.fairyPatrol.actors.length,enemies:s.enemyPreview.entries.length,flowers:s.flowerGrowth.entries.size};
   });
   assert.equal(state.actors,11);assert.equal(state.flowers,query.includes('full=1')?100:4);
   assert.deepEqual(state.config,{enabled,color,width,hex:state.palette[Object.keys({bark:0,stone:0,clay:0,silver:0,paper:0,sand:0,gold:0,red:0,redDark:0,pink:0,growth:0,growthLight:0,sky:0,skyLight:0,lavender:0,violet:0}).indexOf(color)]});
   assert.equal(state.outlineCount,enabled?11:0);assert.ok(state.synced);assert.equal(state.fade,1);assert.equal(state.enemyFade,.5);assert.equal(state.outlineFade,enabled?1:null);
   for(const a of state.outlines){assert.ok(a.colored>0&&a.inside===0&&a.widths.every(w=>Math.abs(w-width)<=.35),JSON.stringify(a));}
   assert.equal(state.enemyOutlines.length,enabled?12:0);
   for(const a of state.enemyOutlines)assert.ok(a.colored>0&&a.inside===0&&a.widths.every(w=>Math.abs(w-width)<=.35),JSON.stringify(a));
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
    const dense=await page.evaluate(()=>{
     const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview;
     c.model.advance(Math.max(0,120-c.model.elapsed));c.advance(0);
     const list=[...c.sprites.values()],keys=new Set(list.map(o=>o.outline?.texture.key));
     return {count:list.length,actors:c.actors.length,keys:keys.size,all:list.every(o=>o.outline&&o.outline.alpha===o.image.alpha&&o.outline.depth===o.image.depth&&o.outline.mask===o.image.mask),sceneCount:s.children.list.filter(o=>o.name?.startsWith('enemy-outline:')).length};
    });
    assert.equal(dense.count,200);assert.equal(dense.actors,200);assert.equal(dense.sceneCount,200);assert.equal(dense.keys,12);assert.ok(dense.all);
    await page.screenshot({path:join(out,'garden16-v9-enemy-outline-dense.png')});console.log('PASS dense enemy outline',JSON.stringify(dense));
   }
   results.push({name,pass:true,art:state.art.map(a=>({key:a.key,opaque:a.opaque,off:a.off}))});
   console.log('PASS',name,state.art.length,'loaded textures',JSON.stringify({outlines:state.outlines,enemyOutlines:state.enemyOutlines,enemyChecks:state.enemyChecks,fade:state.fade,synced:state.synced,terrain:{stones:terrain.stones,field:terrain.field,path:terrain.path}}));
  }finally{await page.close();}
 }
 writeFileSync(join(out,'garden16-v9.json'),JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
