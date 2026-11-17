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
 for(const [name,w,h,query] of [['default',960,540,''],['fhd',1920,1080,''],['original',960,540,'?svgcolors=original'],['light',960,540,'?uitype=1'],['fairy-front-full',960,540,'?full=1&occlusion=fairy'],['no-stones',960,540,'?pebbles=0'],['soil',960,540,'?gardenfill=soil'],['green-field',960,540,'?bgtype=7'],['all-options',960,540,'?full=1&occlusion=fairy&pebbles=0&bgtype=7&gardenfill=green']]){
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
    const outlines=[],actors=s.fairyPatrol.actors;
    function bounds(data,w){let l=w,r=-1,t=w,b=-1;for(let i=0;i<data.length;i+=4)if(data[i+3]>=128){const x=i/4%w,y=Math.floor(i/4/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return [l,r,t,b];}
    for(const a of [actors[0],actors[1]]){
     const base=s.textures.get('fairy:base:'+a.type).getSourceImage(),ring=a.outline.texture.getSourceImage();
     cv.width=cv.height=base.width;ctx.drawImage(base,0,0);const bd=ctx.getImageData(0,0,cv.width,cv.height).data;
     ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(ring,0,0);const rd=ctx.getImageData(0,0,cv.width,cv.height).data;
     const b=bounds(bd,cv.width),r=bounds(rd,cv.width),f=a.image.scaleX;
     let colored=0,inside=0;for(let i=0;i<rd.length;i+=4){if(rd[i+3]===255&&((rd[i]<<16)|(rd[i+1]<<8)|rd[i+2])===P.n.paper)colored++;if(bd[i+3]===255&&rd[i+3]>0)inside++;}
     outlines.push({type:a.type,colored,inside,widths:[b[0]-r[0],r[1]-b[1],b[2]-r[2],r[3]-b[3]].map(n=>n*f)});
    }
    const hero=actors[0].image,probe=s.add.image(hero.x,hero.y,hero.texture.key).setOrigin(hero.originX,hero.originY).setScale(hero.scaleX,hero.scaleY).setAngle(hero.angle).setFlip(hero.flipX,hero.flipY).setDepth(3.5);
    s.enemyPreview.occlusion.update([probe],.1);
    const fade=hero.alpha,outlineFade=actors[0].outline.alpha;
    s.enemyPreview.occlusion.update([],.2);probe.destroy();
    s.fairyPatrol.advance(.05);
    const synced=actors.every(a=>a.outline.x===a.image.x&&a.outline.y===a.image.y&&a.outline.rotation===a.image.rotation&&a.outline.flipX===a.image.flipX&&a.outline.depth===a.image.depth&&a.outline.alpha===a.image.alpha&&a.outline.scaleX===a.image.scaleX);
    const L=window.GardenGameLayout,grid=window.GardenDashedGridPreview,soil=s.children.getByName('garden-preview-soil'),field=s.children.getByName('dark-field-pattern'),g=L.spec.garden,z=s.cameras.main.zoom;
    const raster=L.gardenRaster(grid.all(g),g,z),occupied=new Set(s.flowerGrowth.entries.keys()),cellPixel=i=>{
      const x=Math.round((g.x+(i%g.columns)*g.pitch+g.line+g.cell/2)*z)-raster.x;
      const y=Math.round((g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2)*z)-raster.y;
      return Array.from(soil.texture.getSourceImage().getContext('2d').getImageData(x,y,1,1).data);
    };
    const terrain={stones:s.fairyPatrol.border.images.length,points:s.fairyPatrol.boundary.points.length,fillMode:grid.fillMode,
      occupied:[...occupied].map(cellPixel),candidates:[...L.gardenCandidates(occupied)].map(cellPixel),
      field:window.GardenDarkFieldPreview.active,fieldPixel:field?Array.from(field.texture.getSourceImage().getContext('2d').getImageData(0,0,1,1).data):null,
      fillColor:grid.fills[grid.fillMode],path:s.fairyPatrol.length};
    const F=window.GardenFlowerGrowth;
    for(const n of F.names)for(let stage=1;stage<=3;stage++)art.push(read(F.key(n,stage)));
    return {palette:Object.values(P.hex),reference:P.reference.hex,enabled:G.enabled,art,outlines,fade,outlineFade,synced,terrain,actors:s.fairyPatrol.actors.length,enemies:s.enemyPreview.entries.length,flowers:s.flowerGrowth.entries.size};
   });
   assert.equal(state.actors,11);assert.equal(state.flowers,query.includes('full=1')?100:4);
   assert.ok(state.synced);assert.equal(state.fade,query.includes('occlusion=fairy')?1:.5);assert.equal(state.outlineFade,state.fade);
   for(const a of state.outlines){assert.ok(a.colored>0&&a.inside===0&&a.widths.every(w=>w>=.65&&w<=1.35),JSON.stringify(a));}
   const terrain=state.terrain,hidden=query.includes('pebbles=0'),mode=query.includes('gardenfill=soil')?'soil':query.includes('gardenfill=green')?'green':'none';
   assert.equal(terrain.stones,hidden?0:terrain.points);assert.ok(terrain.points>20);
   assert.equal(terrain.fillMode,mode);
   if(mode!=='none'){
    const rgb=terrain.fillColor.match(/[0-9A-F]{2}/g).map(v=>parseInt(v,16));assert.ok(terrain.occupied.every(p=>p.join(',')===[...rgb,255].join(',')));
    assert.ok(terrain.candidates.every(p=>p[3]===0));
   }else if(name!=='light')assert.ok(terrain.occupied.every(p=>p[3]===0));
   if(query.includes('bgtype=7')){assert.equal(terrain.field,7);assert.ok(terrain.fieldPixel[1]>terrain.fieldPixel[0]&&terrain.fieldPixel[1]>60&&terrain.fieldPixel[3]===255);}
   else assert.equal(terrain.field,name==='light'?0:6);
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
   const png=await page.screenshot({path:join(out,'garden16-v9-'+name+'.png')});
   if(query.includes('bgtype=7')||mode!=='none'){
    const rendered=await page.evaluate(async ({data,fill,green})=>{
     const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();
     const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const ctx=cv.getContext('2d');ctx.drawImage(im,0,0);
     const d=ctx.getImageData(0,0,cv.width,cv.height).data;let fillPixels=0,greenPixels=0;
     const rgb=fill?fill.match(/[0-9A-F]{2}/g).map(v=>parseInt(v,16)):null;
     for(let i=0;i<d.length;i+=4){
      if(rgb&&d[i]===rgb[0]&&d[i+1]===rgb[1]&&d[i+2]===rgb[2])fillPixels++;
      if(d[i]===58&&d[i+1]===72&&d[i+2]===32)greenPixels++;
     }
     return {fillPixels,greenPixels};
    },{data:png.toString('base64'),fill:terrain.fillColor,green:query.includes('bgtype=7')});
    if(mode!=='none')assert.ok(rendered.fillPixels>100,JSON.stringify(rendered));
    if(query.includes('bgtype=7'))assert.ok(rendered.greenPixels>10000,JSON.stringify(rendered));
   }
   results.push({name,pass:true,art:state.art.map(a=>({key:a.key,opaque:a.opaque,off:a.off}))});
   console.log('PASS',name,state.art.length,'loaded textures',JSON.stringify({outlines:state.outlines,fade:state.fade,synced:state.synced,terrain:{stones:terrain.stones,field:terrain.field,fill:terrain.fillMode,path:terrain.path}}));
  }finally{await page.close();}
 }
 writeFileSync(join(out,'garden16-v9.json'),JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
