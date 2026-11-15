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
const caterpillar=source.match(/const caterpillarRle = '([^']+)';/)[1].split(',').map(r=>r.slice(-1).repeat(Number(r.slice(0,-1)))).join('');
assert.equal(caterpillar.length,32*32);
assert.equal(createHash('sha256').update(caterpillar).digest('hex'),'46f0b1ee74d961bccc1fd1e95678289274e7695fafc337e1ed77340eebb21d60');
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
 for(const [w,h,dpr,cell,query] of [[640,360,1,22,''],[960,540,1,22,''],[1280,720,1,22,''],[1600,900,1,22,''],[1920,1080,1,22,''],[960,540,2,22,''],[960,540,1,32,'?garden=32'],[960,540,1,22,'?slots=24'],[960,540,1,22,'?slots=36'],[1920,1080,1,22,'?person=24'],[1920,1080,1,22,'?person=28'],...([32,36,40,44,48,56].map(n=>[1920,1080,1,22,'?person='+n])),[960,540,1,32,'?garden=32&person=56']]){
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
    const enemies=list.filter(o=>o.name?.startsWith('placeholder:enemy:caterpillar:'));
    const allowed=new Set(Object.values(window.GardenPalette.n));
    const sprites=[...new Set(flowers.map(o=>o.texture.key)),guardian.texture.key].map(key=>{
     const t=s.textures.get(key),w=t.width,h=t.height,p=t.getContext().getImageData(0,0,w,h).data;
     let left=w,right=-1,top=h,bottom=-1,valid=true,outline=0,unoutlined=0;
     const ink=window.GardenPalette.n.ink;
     const pixel=(x,y)=>{const i=(y*w+x)*4;return x<0||y<0||x>=w||y>=h||!p[i+3]?-1:(p[i]<<16)|(p[i+1]<<8)|p[i+2];};
     for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,a=p[i+3]; if(a!==0&&a!==255)valid=false;
      if(a){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(!allowed.has((p[i]<<16)|(p[i+1]<<8)|p[i+2]))valid=false;}
     }
     if(!key.includes('guardian'))for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=pixel(x,y);if(c===ink)outline++;
      if(c!==-1&&c!==ink&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>pixel(a,b)===-1))unoutlined++;
     }
     return {key,w,h,valid,outline,unoutlined,extent:Math.max(right-left+1,bottom-top+1)};
    });
    const soil=list.find(o=>o.name==='garden-preview-soil');
    const grid=soil.texture.getContext().getImageData(0,0,soil.texture.width,soil.texture.height).data;
    const colorAt=(x,y)=>Array.from(grid.slice((y*soil.texture.width+x)*4,(y*soil.texture.width+x)*4+4));
    const seamColors=[];
    for(let i=1;i<g.columns;i++) seamColors.push(colorAt(Math.round((g.x+i*g.pitch)*z)-Math.round(g.x*z),Math.floor(soil.texture.height/2)));
    for(let i=1;i<g.rows;i++) seamColors.push(colorAt(Math.floor(soil.texture.width/2),Math.round((g.y+i*g.pitch)*z)-Math.round(g.y*z)));
    const enemyTexture=enemies[0].texture,ep=enemyTexture.getContext().getImageData(0,0,32,32).data;
    let left=32,right=-1,top=32,bottom=-1,green=0,inkCount=0,valid=true;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
     const i=(y*32+x)*4,a=ep[i+3],c=(ep[i]<<16)|(ep[i+1]<<8)|ep[i+2];
     if(a===0)continue;
     if(a!==255||![0x6aba2c,0x0d0d0d].includes(c))valid=false;
     if(c===0x6aba2c)green++;else inkCount++;
     left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    return {g,z,seamColors,enemyBounds:{w:right-left+1,h:bottom-top+1,green,inkCount,valid},enemies:enemies.map(o=>({x:o.x,y:o.y,w:o.displayWidth,h:o.displayHeight,flip:o.flipX,key:o.texture.key})),count:flowers.length,markers:list.filter(o=>o.name?.startsWith('placeholder:')).map(o=>o.name),
      centers:flowers.every(o=>{const i=Number(o.name.split(':').at(-1));return o.x===g.x+(i%g.columns)*g.pitch+g.line+g.cell/2&&o.y===g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2&&o.displayWidth===g.cell&&o.displayHeight===g.cell;}),
      guardian:{x:guardian.x,y:guardian.y,w:guardian.displayWidth,h:guardian.displayHeight},sprites,
      grid:[soil.texture.width,soil.texture.height],corner:colorAt(0,0),canvas:[game.canvas.width,game.canvas.height],
      hud:!!list.find(o=>o.name==='top-hud'),slots:list.filter(o=>o.name?.startsWith('slot-frame:')).length};
   });
   assert.equal(state.count,100);assert.deepEqual(state.markers,['placeholder:guardian:0',...Array.from({length:3},(_,i)=>'placeholder:enemy:caterpillar:'+i)]);
   assert.equal(state.enemies.length,3);assert.ok(state.enemies.every(e=>e.w===32&&e.h===32&&e.key==='flower-head-preview:caterpillar:32'));
   assert.deepEqual(state.enemies.map(e=>e.flip),[true,false,true]);
   assert.ok(state.enemyBounds.valid&&state.enemyBounds.w===32&&state.enemyBounds.h===18&&state.enemyBounds.green>0&&state.enemyBounds.inkCount>0);
   assert.equal(state.g.cell,cell);assert.ok(state.centers);assert.equal(state.sprites.length,5);
   assert.ok(state.sprites.every(t=>t.valid&&t.extent<=t.w&&t.extent>=t.w-2&&t.w===t.h),JSON.stringify(state.sprites));
   assert.ok(state.sprites.filter(t=>!t.key.includes('guardian')).every(t=>t.outline>0&&t.unoutlined===0),JSON.stringify(state.sprites));
   assert.ok(state.seamColors.every(c=>c.join(',')==='22,22,25,255'),JSON.stringify(state.seamColors));
   const person=Number(new URLSearchParams(query).get('person')||44);
   assert.deepEqual(state.corner,[0,0,0,0]);assert.equal(state.guardian.w,person);assert.equal(state.guardian.h,person);
   assert.ok(state.guardian.y-person/2>=32&&state.guardian.y+person/2<=500,JSON.stringify(state.guardian));
   assert.ok(state.hud);assert.equal(state.slots,10);assert.deepEqual(state.canvas,[w*dpr,h*dpr]);
   await page.waitForFunction(({x,y})=>{const o=window.__previewGame.scene.getScene('Game').children.getByName('placeholder:guardian:0');return Math.hypot(o.x-x,o.y-y)>2;},state.guardian);
   const png=await page.screenshot({path:join(out,'flower-head-'+w+'-'+dpr+'-'+cell+'-'+(query.replace(/[^0-9]/g,'')||'default')+'.png'),scale:'device'});
   if(w*dpr===1920){
    const actual=await page.evaluate(async data=>{
     const img=await createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob()),cv=document.createElement('canvas');
     cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
     const p=ctx.getImageData(0,0,cv.width,cv.height).data;
     const g=window.GardenGameLayout.spec.garden,z=2,s=window.__previewGame.scene.getScene('Game');
     const pixel=(x,y)=>{const i=(y*cv.width+x)*4;return (p[i]<<16)|(p[i+1]<<8)|p[i+2];};
     let seams=0,wrongSeams=0,outline=0,wrongOutline=0;
     for(let i=1;i<g.columns;i++)for(let y=(g.y+1)*z;y<(g.y+g.size-1)*z;y++){
      const x=(g.x+i*g.pitch)*z;seams++;if(pixel(x,y)!==0x161619)wrongSeams++;
     }
     for(let i=1;i<g.rows;i++)for(let x=(g.x+1)*z;x<(g.x+g.size-1)*z;x++){
      const y=(g.y+i*g.pitch)*z;seams++;if(pixel(x,y)!==0x161619)wrongSeams++;
     }
     for(const o of s.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:'))){
      const t=o.texture,n=t.width,bytes=t.getContext().getImageData(0,0,n,n).data;
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){
       const i=(y*n+x)*4;if(bytes[i+3]!==255||((bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2])!==0x0d0d0d)continue;
       outline++;if(pixel(Math.round((o.x-n/2+x)*z),Math.round((o.y-n/2+y)*z))!==0x0d0d0d)wrongOutline++;
      }
     }
     // Measure visible teal pixels in the real screenshot, independently of display size.
     let left=cv.width,right=-1,top=cv.height,bottom=-1;
     for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(pixel(x,y)===0x0c9484){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
     }
     const enemies=s.children.list.filter(o=>o.name?.startsWith('placeholder:enemy:caterpillar:')).map(o=>{
      let l=cv.width,r=-1,t=cv.height,b=-1;
      for(let y=Math.floor((o.y-16)*z);y<Math.ceil((o.y+16)*z);y++)
       for(let x=Math.floor((o.x-16)*z);x<Math.ceil((o.x+16)*z);x++)if(pixel(x,y)===0x6aba2c){
        l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
       }
      return {w:r-l+1,h:b-t+1};
     });
     return {seams,wrongSeams,outline,wrongOutline,personWidth:right-left+1,personHeight:bottom-top+1,enemies};
    },png.toString('base64'));
    assert.ok(actual.seams>0&&actual.wrongSeams===0&&actual.outline>0&&actual.wrongOutline===0,JSON.stringify(actual));
    assert.ok(Math.abs(actual.personWidth-person*2*15/24)<=2&&Math.abs(actual.personHeight-person*2)<=1,JSON.stringify(actual));
    assert.ok(actual.enemies.length===3&&actual.enemies.every(e=>e.w===60&&e.h===32),JSON.stringify(actual.enemies));
    state.actual=actual;
   }
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
   assert.deepEqual(errors,[]);
   report.push({w,h,dpr,cell,query,pass:true,state});
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'flower-head-report.json'),JSON.stringify(report,null,2));}
console.log('PASS: '+report.length+' real browser configurations and '+Object.keys(hashes).length+' raster hashes');
