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
const configs=[[960,540,1,''],[1920,1080,1,'?person=38'],[960,540,1,'?garden=32&person=56&slots=24'],[1920,1080,1,'?person=38&full=1']];
try{
 for(const [w,h,dpr,query] of configs){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   const click=(x,y)=>page.mouse.click(box.x+x*box.width/960,box.y+y*box.height/540);
   const drag=async(a,b)=>{
     await page.mouse.move(box.x+a.x*box.width/960,box.y+a.y*box.height/540);
     await page.mouse.down();
     await page.mouse.move(box.x+b.x*box.width/960,box.y+b.y*box.height/540,{steps:6});
     await page.mouse.up();
   };
   await click(480,252);
   await page.waitForFunction(()=>!!window.__previewGame.scene.getScene('Game').combatPreview);
   const art=await page.evaluate(()=>{
    const scene=window.__previewGame.scene.getScene('Game'),o=scene.children.getByName('placeholder:guardian:0'),t=o.texture;
    const p=t.getContext().getImageData(0,0,t.width,t.height).data;
    let left=t.width,right=-1,top=t.height,bottom=-1,invalid=0;
    const colors=new Set();
    for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){
     const i=(y*t.width+x)*4,a=p[i+3];
     if(a!==0&&a!==255)invalid++;
     if(!a)continue;
     colors.add((p[i]<<16)|(p[i+1]<<8)|p[i+2]);
     left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    return {key:t.key,w:o.displayWidth,h:o.displayHeight,visibleW:right-left+1,visibleH:bottom-top+1,
      colors:[...colors].sort((a,b)=>a-b),invalid,x:o.x,y:o.y};
   });
   const size=Number(new URLSearchParams(query).get('person')||40);
   assert.equal(art.key,'flower-head-preview:guardian-sprout:'+size);
   assert.equal(art.w,Math.round(size*0.75));assert.equal(art.h,size);
   assert.deepEqual([art.visibleW,art.visibleH],[art.w,art.h]);
   assert.deepEqual(art.colors,[0x51516b,0x6aba2c,0x7c4c24,0xe9d0ab,0xf46c7c]);assert.equal(art.invalid,0);
   const border=await page.evaluate(()=>{
    const scene=window.__previewGame.scene.getScene('Game'),c=scene.combatPreview,L=window.GardenGameLayout,S=window.GardenStoneBorderPreview;
    const p=scene.children.getByName('placeholder:guardian:0'),info=S.geometry(L.spec,c.model.occupied,p.displayWidth,p.displayHeight);
    const b=info.patrol,model=window.GardenCombatPreview.create(L.spec,b,L.patrolPosition,L.nearestPatrolDistance);
    let clear=true,onPath=true;
    for(let i=0;i<500;i++){
      const s=model.advance(0.1),g=s.guardian,o=info.outer,hw=p.displayWidth/2,hh=p.displayHeight/2;
      if(!(g.x+hw<=o.left-info.gap+1e-6||g.x-hw>=o.right+info.gap-1e-6||g.y+hh<=o.top-info.gap+1e-6||g.y-hh>=o.bottom+info.gap-1e-6))clear=false;
      if(g.y-hh<L.spec.top-1e-6||g.y+hh>L.spec.height-L.spec.bottom+1e-6)onPath=false;
    }
    const graphics=scene.children.getByName('garden-stone-border');
    return {info,clear,onPath,drawn:graphics.commandBuffer.length>0,tiles:S.rectangles(info).length};
   });
   assert.ok(border.clear&&border.onPath&&border.drawn&&border.tiles>0);
   assert.equal(border.info.gap,5);assert.equal(border.info.thickness,6);
   if(new URLSearchParams(query).get('full')==='1'){
    const full=await page.evaluate(()=>{
      const scene=window.__previewGame.scene.getScene('Game'),c=scene.combatPreview,L=window.GardenGameLayout,g=L.spec.garden;
      const flowers=scene.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:'));
      const counts={};let correct=true;
      for(const o of flowers){
        const i=Number(o.name.split(':').at(-1));
        counts[o.texture.key]=(counts[o.texture.key]||0)+1;
        if(o.x!==g.x+i%g.columns*g.pitch+g.line+g.cell/2||o.y!==g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2||o.displayWidth!==g.cell)correct=false;
      }
      const soil=scene.children.getByName('garden-preview-soil').texture,p=soil.getContext().getImageData(0,0,soil.width,soil.height).data;
      let bad=0;for(let i=0;i<p.length;i+=4)if(p[i]!==22||p[i+1]!==22||p[i+2]!==25||p[i+3]!==255)bad++;
      return {occupied:[...c.model.occupied],count:flowers.length,counts,correct,bad,soil:[soil.width,soil.height],
        progress:scene.children.getByName('hud-progress-value').text,candidates:L.gardenCandidates(c.model.occupied).size};
    });
    assert.deepEqual(full.occupied,Array.from({length:100},(_,i)=>i));
    assert.equal(full.count,100);assert.deepEqual(Object.values(full.counts),[25,25,25,25]);
    assert.ok(full.correct);assert.equal(full.bad,0);assert.deepEqual(full.soil,[462,462]);
    assert.equal(full.progress,'100%');assert.equal(full.candidates,0);
    const png=await page.screenshot({path:join(out,'full-garden-1920.png'),scale:'device'});
    const pixels=await page.evaluate(async({b64,info})=>{
      const im=await createImageBitmap(await(await fetch('data:image/png;base64,'+b64)).blob());
      const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;
      const ctx=cv.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,cv.width,cv.height).data;
      const at=(x,y)=>{const i=(y*cv.width+x)*4;return (p[i]<<16)|(p[i+1]<<8)|p[i+2];};
      const stone=new Set([0x51516b,0x676777,0x3b3b4e]),o=info.outer,g=info.garden;
      let stones=0,gap=0,outside=0,wrong=0;
      for(let x=(g.left+2)*2;x<(g.right-2)*2;x++){
        for(let y=o.top*2;y<(o.top+info.thickness)*2;y++)if(stone.has(at(x,y)))stones++;
        for(let y=(o.top+info.thickness)*2;y<g.top*2;y++){gap++;if(at(x,y)!==0x0d0d0d)wrong++;}
        for(let y=(o.top-info.gap)*2;y<o.top*2;y++){outside++;if(at(x,y)!==0x0d0d0d)wrong++;}
      }
      return {stones,gap,outside,wrong};
    },{b64:png.toString('base64'),info:border.info});
    assert.ok(pixels.stones>1000&&pixels.gap>0&&pixels.outside>0&&pixels.wrong===0,JSON.stringify(pixels));
    full.pixels=pixels;
    const combat=await page.evaluate(()=>{
      const scene=window.__previewGame.scene.getScene('Game'),c=scene.combatPreview;c.advance(25);
      const s=c.state,f=s.drops.find(d=>d.kind==='flower');
      return {kills:s.kills,shots:s.shotsFired,spawned:s.spawned,count:c.model.occupied.size,progress:scene.children.getByName('hud-progress-value').text,
       rejected:f?!c.model.plant(f.id,0):true};
    });
    assert.ok(combat.kills>0&&combat.shots>0&&combat.spawned>0&&combat.rejected);
    assert.equal(combat.count,100);assert.equal(combat.progress,'100%');assert.deepEqual(errors,[]);
    report.push({w,h,query,art,border,full,combat,pass:true});
    console.log('PASS full garden',JSON.stringify({count:full.count,progress:full.progress,kills:combat.kills}));
    continue;
   }
   if(w===1920){
    const png=await page.screenshot({path:join(out,'pink-guardian-1920.png'),scale:'device'});
    const actual=await page.evaluate(async({b64,art})=>{
     const im=await createImageBitmap(await(await fetch('data:image/png;base64,'+b64)).blob());
     const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;
     const ctx=cv.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,cv.width,cv.height).data;
     let left=cv.width,right=-1,top=cv.height,bottom=-1,pink=0;
     for(let y=Math.floor(art.y*2-43);y<=Math.ceil(art.y*2+43);y++)
      for(let x=Math.floor(art.x*2-65);x<=Math.ceil(art.x*2+65);x++){
       const i=(y*cv.width+x)*4,c=(p[i]<<16)|(p[i+1]<<8)|p[i+2];
       if(!art.colors.includes(c))continue;
       if(c===0xf46c7c)pink++;
       left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
     return {w:right-left+1,h:bottom-top+1,pink};
    },{b64:png.toString('base64'),art});
    assert.ok(Math.abs(actual.w-art.w*2)<=1&&actual.h===art.h*2,JSON.stringify(actual));assert.ok(actual.pink>0);
    art.actual=actual;
   }
   const initial=await page.evaluate(()=>{
    const game=window.__previewGame,scene=game.scene.getScene('Game'),c=scene.combatPreview,L=window.GardenGameLayout,g=L.spec.garden;
    const soil=scene.children.getByName('garden-preview-soil').texture;
    const ctx=soil.getContext(),w=soil.width,h=soil.height,p=ctx.getImageData(0,0,w,h).data;
    let opaque=0,bad=0;
    for(let i=0;i<p.length;i+=4)if(p[i+3]){opaque++;if(p[i]!==22||p[i+1]!==22||p[i+2]!==25||p[i+3]!==255)bad++;}
    const center=i=>({x:g.x+i%g.columns*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2});
    const layout=L.bottomLayout(),slot=i=>({x:layout.slots[i].x+layout.slots[i].size/2,y:layout.slots[i].y+layout.slots[i].size/2});
    const initial={occupied:[...c.model.occupied],balls:c.state.ballCount,
      flowers:scene.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:')).length,
      progress:scene.children.getByName('hud-progress-value').text,opaque,bad,corner:p[3],
      empty:center(0),filled:center(44),target:center(34),slots:[slot(0),slot(1),slot(9)],
      pulse:!!scene.children.getByName('combat-preview-pulses'),canvas:[game.canvas.width,game.canvas.height]};
    c.advance(12);
    return initial;
   });
   assert.deepEqual(initial.occupied,[44,45,54,55]);assert.equal(initial.flowers,4);assert.equal(initial.balls,1);
   assert.equal(initial.progress,'4%');assert.equal(initial.corner,0);assert.ok(initial.opaque>0&&initial.bad===0&&!initial.pulse);
   assert.deepEqual(initial.canvas,[w*dpr,h*dpr]);
   const loot=await page.evaluate(()=>{
    const c=window.__previewGame.scene.getScene('Game').combatPreview,s=c.state;
    return {kills:s.kills,shots:s.shotsFired,types:[...new Set(s.drops.map(d=>d.kind))],drops:s.drops.filter(d=>d.kind!=='gem')};
   });
   assert.ok(loot.kills>0&&loot.shots>0,JSON.stringify(loot));
   assert.ok(['card','flower','gem'].every(k=>loot.types.includes(k)),JSON.stringify(loot.types));
   const flower=loot.drops.find(d=>d.kind==='flower'),card=loot.drops.find(d=>d.kind==='card');
   assert.ok(flower&&card);
   await drag(flower,initial.empty);
   await page.waitForTimeout(100);
   assert.ok(await page.evaluate(id=>window.__previewGame.scene.getScene('Game').combatPreview.state.drops.some(d=>d.id===id),flower.id));
   await drag(flower,initial.target);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').combatPreview.model.occupied.has(34));
   const grown=await page.evaluate(()=>{
     const scene=window.__previewGame.scene.getScene('Game'),c=scene.combatPreview,L=window.GardenGameLayout,p=scene.children.getByName('placeholder:guardian:0');
     const info=window.GardenStoneBorderPreview.geometry(L.spec,c.model.occupied,p.displayWidth,p.displayHeight);
     const g=c.state.guardian,o=info.outer,hw=p.displayWidth/2,hh=p.displayHeight/2;
     return {top:info.garden.top,clear:g.x+hw<=o.left-info.gap+1e-6||g.x-hw>=o.right+info.gap-1e-6||g.y+hh<=o.top-info.gap+1e-6||g.y-hh>=o.bottom+info.gap-1e-6};
   });
   assert.ok(grown.clear&&grown.top<border.info.garden.top);
   await drag(card,initial.slots[2]);
   await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.ballCount),1);
   await drag(card,initial.slots[0]);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.ballCount===2);
   const second=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),c=s.combatPreview;c.advance(2);
    return c.state.drops.find(d=>d.kind==='card');
   });
   assert.ok(second);
   await drag(second,initial.slots[0]);
   await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.ballCount),2);
   await drag(second,initial.slots[1]);
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.ballCount===3);
   const state=await page.evaluate(()=>{
    const scene=window.__previewGame.scene.getScene('Game'),c=scene.combatPreview,L=window.GardenGameLayout;
    c.advance(2);
    const volley=c.state.lastVolley.map(b=>Math.atan2(b.vy,b.vx)).sort((a,b)=>a-b);
    const gaps=volley.map((a,i)=>((volley[(i+1)%volley.length]-a+2*Math.PI)%(2*Math.PI)));
    const start={kills:c.state.kills,rate:c.state.rate,elapsed:c.state.elapsed};
    c.advance(45);
    const s=c.state;
    const colors=scene.textures.get('combat:ball').getContext().getImageData(0,0,8,8).data;
    let gold=0,rim=0;
    for(let i=0;i<colors.length;i+=4){if(colors[i+3]===255){const v=(colors[i]<<16)|(colors[i+1]<<8)|colors[i+2];if(v===0xf4b404)gold++;if(v===0x51516b)rim++;}}
    return {gaps,start,end:{kills:s.kills,rate:s.rate,spawned:s.spawned,arrived:s.arrived,live:s.enemies.length,gems:s.gems,shots:s.shotsFired,balls:s.ballCount},
      flowers:scene.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:')).length,
      equipped:[0,1].every(i=>scene.children.getByName('preview-equipped:'+i).visible),
      progress:scene.children.getByName('hud-progress-value').text,
      gemHud:scene.children.getByName('hud-gems-value').text,
      killHud:scene.children.getByName('hud-kills-value').text,
      status:scene.children.getByName('combat-ball-count').text,
      gold,rim,drops:s.drops.length,usedCardGone:!s.drops.some(d=>d.id===0&&c.model.equipped.has(0)&&d.kind==='card')};
   });
   assert.equal(state.gaps.length,3);assert.ok(state.gaps.every(v=>Math.abs(v-2*Math.PI/3)<1e-6),JSON.stringify(state.gaps));
   assert.equal(state.flowers,5);assert.ok(state.equipped);assert.equal(state.progress,'5%');assert.equal(state.end.balls,3);
   assert.ok(state.end.kills>state.start.kills&&state.end.rate>state.start.rate);
   assert.equal(state.end.spawned,state.end.kills+state.end.arrived+state.end.live);
   assert.equal(state.killHud,Lformat(state.end.kills));assert.equal(state.gemHud,Lformat(state.end.gems));
   assert.ok(state.status.includes('3')&&state.gold>0&&state.rim>0&&state.drops<=120);
   if(w===1920){
     await page.evaluate(()=>{
       const c=window.__previewGame.scene.getScene('Game').combatPreview;
       for(let i=0;i<20&&!c.state.bullets.length;i++)c.advance(0.1);
     });
     await page.screenshot({path:join(out,'projectile-loot-1920.png'),scale:'device'});
   }
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   const paused=await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed);
   await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed),paused);
   await page.keyboard.press('Escape');await page.waitForFunction(t=>window.__previewGame.scene.getScene('Game').combatPreview.state.elapsed>t,paused);
   assert.deepEqual(errors,[]);
   report.push({w,h,query,art,border,initial,loot:loot.types,state,pass:true});
   console.log('PASS',w,h,query,JSON.stringify({kills:state.end.kills,gems:state.end.gems,flowers:state.flowers,balls:state.end.balls}));
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'projectile-loot-report.json'),JSON.stringify(report,null,2));}
function Lformat(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
console.log('PASS: '+report.length+' real browser configurations, actual pointer drags and radial projectile combat');
