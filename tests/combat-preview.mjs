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
const configs=[[640,360,1,''],[960,540,1,''],[1280,720,1,''],[1600,900,1,''],[1920,1080,1,''],[960,540,2,''],[960,540,1,'?garden=32&person=56'],[960,540,1,'?slots=36&person=28']];
try{
 for(const [w,h,dpr,query] of configs){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   await page.mouse.click(box.x+box.width/2,box.y+box.height*252/540);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').combatPreview);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed>0.8);
   const result=await page.evaluate(()=>{
    const scene=window.__previewGame.scene.getScene('Game'),c=scene.combatPreview,s=c.state,
      spec=window.GardenGameLayout.spec,g=spec.garden,P=window.GardenPalette.n;
    const list=scene.children.list,person=scene.children.getByName('placeholder:guardian:0'),soil=scene.children.getByName('garden-preview-soil');
    const p=soil.texture.getContext().getImageData(0,0,soil.texture.width,soil.texture.height).data;
    let soilGood=true;
    for(let i=0;i<p.length;i+=4)if(p[i]!==22||p[i+1]!==22||p[i+2]!==25||p[i+3]!==255)soilGood=false;
    const checkTexture=(tex,body,rim)=>{
     const w=tex.width,h=tex.height,p=tex.getContext().getImageData(0,0,w,h).data;
     const pixel=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return -1;const i=(y*w+x)*4;return p[i+3]===255?(p[i]<<16)|(p[i+1]<<8)|p[i+2]:-1;};
     let width=0,minX=w,maxX=-1,minY=h,maxY=-1,outlined=0,unoutlined=0;
     for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const v=pixel(x,y);
      if(v===rim)outlined++;
      if(v!==body)continue;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>pixel(a,b)===-1))unoutlined++;
     }
     return {w:maxX-minX+1,h:maxY-minY+1,outlined,unoutlined};
    };
    const before={...s.guardian},t=s.elapsed;
    c.advance(1);
    const move=Math.hypot(s.guardian.x-before.x,s.guardian.y-before.y);
    const early={elapsed:s.elapsed,kills:s.kills,spawned:s.spawned,rate:s.rate,pulses:s.pulsesEmitted};
    const enemy=s.enemies.find(e=>e.id===0);
    const approach=enemy?Math.hypot(enemy.tx-enemy.x,enemy.ty-enemy.y):null;
    const testModel=window.GardenCombatPreview.create(spec,window.GardenGameLayout.patrolBounds(new Set(Array.from({length:100},(_,i)=>i))),window.GardenGameLayout.patrolPosition);
    testModel.advance(0.3);
    const first=testModel.state.enemies[0],start={x:first.x,y:first.y,d:Math.hypot(first.tx-first.x,first.ty-first.y)};
    testModel.advance(0.2);
    const inward=Math.hypot(first.tx-first.x,first.ty-first.y)<start.d;
    const firstOutside=start.y<spec.top;
    c.advance(18);
    const middle={elapsed:s.elapsed,kills:s.kills,spawned:s.spawned,rate:s.rate,pulses:s.pulsesEmitted,live:s.enemies.length};
    c.advance(65);
    const late={elapsed:s.elapsed,kills:s.kills,spawned:s.spawned,rate:s.rate,pulses:s.pulsesEmitted,live:s.enemies.length,arrived:s.arrived};
    const rendered=scene.children.list.filter(o=>o.name?.startsWith('placeholder:enemy:caterpillar:'));
    const hud={time:scene.children.getByName('hud-time-value').text,kills:scene.children.getByName('hud-kills-value').text,speed:scene.children.getByName('stat-value:moveSpeed').text};
    const enemyArt=checkTexture(scene.textures.get('flower-head-preview:caterpillar:32'),P.growth,P.slate);
    const personArt=checkTexture(person.texture,P.teal,P.slate);
    const pulse=scene.children.getByName('combat-preview-pulses');
    return {soilGood,personArt,enemyArt,move,early,middle,late,firstOutside,inward,
     flowerCount:list.filter(o=>o.name?.startsWith('garden-preview-flower:')).length,
     slots:list.filter(o=>o.name?.startsWith('slot-frame:')).length,
     count:rendered.length,actorsMasked:rendered.every(o=>!!o.mask),pulseMasked:!!pulse.mask,hud,
     canvas:[window.__previewGame.canvas.width,window.__previewGame.canvas.height],
     personSize:person.displayHeight,rateCap:window.GardenCombatPreview.spawnRate(1000)};
   });
   assert.ok(result.soilGood);assert.equal(result.flowerCount,100);assert.equal(result.slots,10);
   const n=Number(new URLSearchParams(query).get('person')||44);
   assert.equal(result.personSize,n+2);assert.equal(result.personArt.h,n);
   assert.ok(Math.abs(result.personArt.w-n*15/24)<=1);
   assert.ok(result.personArt.outlined>0&&result.personArt.unoutlined===0);
   assert.deepEqual([result.enemyArt.w,result.enemyArt.h],[30,16]);
   assert.ok(result.enemyArt.outlined>0&&result.enemyArt.unoutlined===0);
   assert.ok(Math.abs(result.move-24)<0.1,JSON.stringify(result.move));
   assert.ok(result.firstOutside&&result.inward);
   assert.ok(result.middle.rate>result.early.rate&&result.late.rate>result.middle.rate);
   assert.ok(result.late.spawned>result.middle.spawned&&result.late.kills>result.middle.kills&&result.middle.kills>0);
   assert.ok(result.late.live<=160&&result.late.spawned===result.late.kills+result.late.live+result.late.arrived);
   assert.equal(result.rateCap,6);assert.equal(result.count,result.late.live);assert.ok(result.actorsMasked&&result.pulseMasked);
   assert.equal(result.hud.kills,String(result.late.kills));assert.equal(result.hud.speed,'24');
   assert.deepEqual(result.canvas,[w*dpr,h*dpr]);assert.deepEqual(errors,[]);
   if(w*dpr===1920){
    await page.evaluate(()=>{
      const s=window.__previewGame.scene.getScene('Game'),c=s.combatPreview;
      // Ensure a visible expanding ring before capture.
      while(!c.state.pulses.some(p=>p.r>45&&p.r<100))c.advance(0.1);
    });
    const png=await page.screenshot({path:join(out,'combat-'+w+'-'+dpr+'.png'),scale:'device'});
    const pixels=await page.evaluate(async b64=>{
      const im=await createImageBitmap(await(await fetch('data:image/png;base64,'+b64)).blob());
      const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;
      const ctx=cv.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,cv.width,cv.height).data;
      const color=(x,y)=>{const i=(y*cv.width+x)*4;return (p[i]<<16)|(p[i+1]<<8)|p[i+2];};
      const spec=window.GardenGameLayout.spec,g=spec.garden;
      let green=0,teal=0,rim=0,soil=0,hudGreen=0;
      for(let y=64;y<1000;y++)for(let x=0;x<cv.width;x++){
       const c=color(x,y);if(c===0x6aba2c)green++;if(c===0x0c9484)teal++;if(c===0x51516b)rim++;
      }
      for(let x=g.x*2;x<(g.x+g.size)*2;x++)if(color(x,g.y*2)===0x161619)soil++;
      for(let y=1000;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(color(x,y)===0x6aba2c)hudGreen++;
      return {green,teal,rim,soil,hudGreen};
    },png.toString('base64'));
    assert.ok(pixels.green>0&&pixels.teal>0&&pixels.rim>0&&pixels.soil>0&&pixels.hudGreen===0,JSON.stringify(pixels));
    result.pixels=pixels;
   }
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   const paused=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed);
   await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed),paused);
   await page.keyboard.press('Escape');await page.waitForFunction(previous=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed>previous,paused);
   if(w===960&&dpr===1&&!query){
    await page.evaluate(()=>window.__previewGame.scene.stop('Game'));
    await page.waitForFunction(()=>!window.__previewGame.scene.getScene('Game').combatPreview);
    await page.evaluate(()=>window.__previewGame.scene.start('Game'));
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').combatPreview);
    assert.ok(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed<1));
   }
   assert.deepEqual(errors,[]);
   report.push({w,h,dpr,query,result,pass:true});
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'combat-report.json'),JSON.stringify(report,null,2));}
console.log('PASS: '+report.length+' live browser configurations; 84s accelerated survival, rendering, pause/restart and HUD');
