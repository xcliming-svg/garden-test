import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const root=process.cwd(), out=resolve('benchmark-results');
mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url), phaser=require.resolve('phaser/dist/phaser.min.js');
const hashes={
 'guardian:24':'1949bbe0bc61c59f28d84a6533853da0524a6803a33a4c7e3a5796fad9c61c8b',
 'daisy:22':'fa6363186757f81145b16c59a9973e3b39a8960df4e6bc0716de2fed94b6f099',
 'daisy:32':'a94ca129b31b36f29f558a3232f6c5818a781518d5902f2d449bdd980786e3ea',
 'tulip:22':'b288fb7091d1b75354dbf5bd1d925a2dfd02c9a4fd0e981becd97f755a67f3c0',
 'tulip:32':'b77cbbf91174aa45ffb2a6f944b9464608c15c4717154291ac2198bb5859ff68',
 'sunflower:22':'9f5789b12792652d97e3f61e75175869330d4021ca85c8208356c9afe8d1b698',
 'sunflower:32':'bdc112999c8e579e53fa13d713845df05b11e24be76a39e9c4aca384c81cd800',
 'hydrangea:22':'46806e98a1048fbb1e8b577977509a29696027f7a7bfec2bd373887aa1027dc3',
 'hydrangea:32':'81a36c20c6154aa2b6f29ee3d2dbec69d4405e96c69967e0504b57c5ce9b8ca2'
};
const source=readFileSync(join(root,'src/flower-head-preview.js'),'utf8');
const runs=JSON.parse(source.match(/const runs = (\{[\s\S]*?\});/)[1]);
for(const [id,rle] of Object.entries(runs)){
 const pixels=rle.split(',').map(r=>r.slice(-1).repeat(Number(r.slice(0,-1)))).join('');
 assert.equal(createHash('sha256').update(pixels).digest('hex'),hashes[id],id+' source pixels');
}
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8'};
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
 for(const [w,h,dpr,cell,query] of [[640,360,1,22,''],[960,540,1,22,''],[1280,720,1,22,''],[1600,900,1,22,''],[1920,1080,1,22,''],[960,540,2,22,''],[960,540,1,32,'?garden=32'],[960,540,1,22,'?slots=24'],[960,540,1,22,'?slots=36']]){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try {
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+box.width/2,box.y+box.height*252/540);
   await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
   const state=await page.evaluate(()=>{
    const game=window.__previewGame,s=game.scene.getScene('Game'),g=window.GardenGameLayout.spec.garden,z=s.cameras.main.zoom;
    const list=s.children.list,flowers=list.filter(o=>o.name?.startsWith('garden-preview-flower:'));
    const guardian=list.find(o=>o.name==='placeholder:guardian:0');
    const allowed=new Set(Object.values(window.GardenPalette.n));
    const sprites=[...new Set(flowers.map(o=>o.texture.key)),guardian.texture.key].map(key=>{
     const t=s.textures.get(key),w=t.width,h=t.height,p=t.getContext().getImageData(0,0,w,h).data;
     let left=w,right=-1,top=h,bottom=-1,valid=true;
     for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,a=p[i+3]; if(a!==0&&a!==255)valid=false;
      if(a){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(!allowed.has((p[i]<<16)|(p[i+1]<<8)|p[i+2]))valid=false;}
     }
     return {key,w,h,valid,extent:Math.max(right-left+1,bottom-top+1)};
    });
    const soil=list.find(o=>o.name==='garden-preview-soil');
    const grid=soil.texture.getContext().getImageData(0,0,soil.texture.width,soil.texture.height).data;
    const colorAt=(x,y)=>Array.from(grid.slice((y*soil.texture.width+x)*4,(y*soil.texture.width+x)*4+4));
    return {g,z,count:flowers.length,markers:list.filter(o=>o.name?.startsWith('placeholder:')).map(o=>o.name),
      centers:flowers.every(o=>{const i=Number(o.name.split(':').at(-1));return o.x===g.x+(i%g.columns)*g.pitch+g.line+g.cell/2&&o.y===g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2&&o.displayWidth===g.cell&&o.displayHeight===g.cell;}),
      guardian:{x:guardian.x,y:guardian.y,w:guardian.displayWidth,h:guardian.displayHeight},sprites,
      grid:[soil.texture.width,soil.texture.height],corner:colorAt(0,0),canvas:[game.canvas.width,game.canvas.height],
      hud:!!list.find(o=>o.name==='top-hud'),slots:list.filter(o=>o.name?.startsWith('slot-frame:')).length};
   });
   assert.equal(state.count,100);assert.deepEqual(state.markers,['placeholder:guardian:0']);
   assert.equal(state.g.cell,cell);assert.ok(state.centers);assert.equal(state.sprites.length,5);
   assert.ok(state.sprites.every(t=>t.valid&&t.extent===t.w&&t.w===t.h));
   assert.deepEqual(state.corner,[0,0,0,0]);assert.equal(state.guardian.w,24);assert.equal(state.guardian.h,24);
   assert.ok(state.hud);assert.equal(state.slots,10);assert.deepEqual(state.canvas,[w*dpr,h*dpr]);
   await page.waitForFunction(({x,y})=>{const o=window.__previewGame.scene.getScene('Game').children.getByName('placeholder:guardian:0');return Math.hypot(o.x-x,o.y-y)>2;},state.guardian);
   await page.screenshot({path:join(out,'flower-head-'+w+'-'+dpr+'-'+cell+'-'+(query.replace(/[^0-9]/g,'')||'default')+'.png'),scale:'device'});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
   assert.deepEqual(errors,[]);
   report.push({w,h,dpr,cell,query,pass:true,state});
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'flower-head-report.json'),JSON.stringify(report,null,2));}
console.log('PASS: '+report.length+' real browser configurations and '+Object.keys(hashes).length+' raster hashes');
