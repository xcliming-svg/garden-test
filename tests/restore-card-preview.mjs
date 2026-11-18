import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const revision='0556bf9000000000000000000000000000000000';
const server=createServer((req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';
  if(path.includes('..'))return res.writeHead(404).end();
  let body=readFileSync(path==='phaser.js'?phaser:join(root,path));
  if(path==='index.html')body=body.toString().replace('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js').replace('./src/svg-palette.js"','./src/svg-palette.js?v='+revision+'"');
  if(path==='src/main.js')body=body.toString().replace("  window.addEventListener('resize',","  window.__previewGame = game;\n  window.addEventListener('resize',");
  res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
 }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const [w,h] of [[960,540],[1280,720]]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[],failed=[],enemyRequests=[],svgRequests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',r=>failed.push(r.url()));
  page.on('request',r=>{const u=new URL(r.url());if(u.pathname.includes('/enemies/'))enemyRequests.push(r.url());if(u.pathname.endsWith('.svg'))svgRequests.push(u);});
  try{
   await page.goto(url+'/index.html');
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const box=await page.locator('canvas').boundingBox();
   const coords=(x,y)=>[box.x+x*box.width/960,box.y+y*box.height/540];
   const click=(x,y)=>page.mouse.click(...coords(x,y));
   const drag=async(a,b,release=true)=>{
    await page.mouse.move(...coords(a.x,a.y));await page.mouse.down();
    await page.mouse.move(...coords(b.x,b.y),{steps:12});
    if(release)await page.mouse.up();
   };
   const snapshot=()=>page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),L=window.GardenGameLayout;
    const obj=n=>s.children.getByName(n),pos=o=>({x:o.x,y:o.y,visible:o.visible,alpha:o.alpha,texture:o.list?.[2]?.texture.key,textureWidth:o.list?.[2]?.frame.width,textureHeight:o.list?.[2]?.frame.height,span:o.list?.[2]?Math.max(o.list[2].displayWidth,o.list[2].displayHeight):undefined,lift:o.floatLift,level:o.levelLabel?.text,children:o.list?.length,levelY:o.levelLabel?.y,levelBaseY:o.levelLabel?.levelBaseY});
    // Drag raises depth and reorders the display list; retain stable card identity.
    const byName=(a,b)=>a.name.localeCompare(b.name);
    const flowers=s.children.list.filter(o=>o.name?.startsWith('placeholder:flower:')).sort(byName).map(pos);
    const items=s.children.list.filter(o=>o.name?.startsWith('placeholder:item:')).sort(byName).map(pos);
    const g=L.spec.garden,cell=i=>({x:g.x+(i%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(i/g.columns)*g.pitch+g.line+g.cell/2});
    const slot=L.bottomLayout().slots[0];
    const ground=s.children.list.filter(o=>o.name?.startsWith('ground-relic:')).map(o=>({name:o.name,texture:o.texture.key,visible:o.visible,span:Math.max(o.displayWidth,o.displayHeight),interactive:!!o.input}));
    return {flowers,items,ground,gearTexture:obj('preview-equipped:0').list[2].texture.key,gearLevel:obj('preview-equipped:0').levelLabel?.text,ghostLevel:obj('item-preview-ghost').levelLabel?.text,ghostTexture:obj('item-preview-ghost').list[2].texture.key,occupied:s.fairyPatrol.occupied,enemy:!!s.enemyPreview,combat:!!s.combatPreview,
     fairy:s.fairyPatrol.actors.length,stage:s.flowerGrowth.entries.size,slot:{x:slot.x+slot.size/2,y:slot.y+slot.size/2},slot2:{x:L.bottomLayout().slots[1].x+slot.size/2,y:slot.y+slot.size/2},candidate:cell(43),invalid:cell(44),
     ghost:obj('garden-preview-ghost').visible,gear:obj('preview-equipped:0').visible,tip:obj('item-preview-tooltip').visible,
     speed:obj('stat-value:moveSpeed').text,defense:obj('stat-value:defense').text,dps:obj('stat-value:dps').text,patrolSpeed:s.fairyPatrol.speed,hudStats:Object.fromEntries(s.children.list.filter(o=>o.name?.startsWith('stat-value:')).map(o=>[o.name,o.text])),hudDeltas:s.children.list.filter(o=>o.name?.startsWith('stat-delta:')&&o.visible).map(o=>[o.name,o.text]),tipRows:obj('item-preview-tooltip').list.filter(o=>typeof o.text==='string').map(o=>o.text),progress:obj('hud-progress-value').text};
   });
   const start=async()=>{await click(480,252);await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').fairyPatrol?.actors.length===11);};
   await start();
   const initial=await snapshot();
   for(const file of ['01_shoe.svg','05_wheel.svg'])assert.ok(svgRequests.some(u=>u.pathname.endsWith('/assets/palette16/items/'+file)&&u.searchParams.get('v')===revision),'versioned SVG request '+file);
   const colors=await page.evaluate(()=>{
    const scene=window.__previewGame.scene.getScene('Game');
    function palette(id){const c=scene.textures.get('item-svg:trim:'+id).getSourceImage(),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data,result={};for(let i=0;i<data.length;i+=4)if(data[i+3]===255){const k=[data[i],data[i+1],data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');result[k]=(result[k]||0)+1;}return result;}
    return {shoe:palette('shoe'),wheel:palette('wheel')};
   });
   assert.ok(colors.shoe.fb575f>100&&colors.shoe.d23840>100,'red shoe rendered');assert.equal(colors.shoe.c3d968,undefined);
   assert.ok(colors.wheel['706975']>100&&colors.wheel['96919b']>100,'grey rim and grey spokes rendered');assert.equal(colors.wheel['4e352e'],undefined);
   assert.equal(initial.flowers.length,6);assert.equal(initial.items.length,12);assert.equal(initial.ground.length,2);
   assert.ok(initial.flowers.every(o=>o.children===3&&!o.level),'no flower badge or ground shadow');
   assert.ok(initial.items.every(o=>o.children===4&&o.level==='Lv.1'),'level text only, no ground shadow');
   const floatCheck=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),items=s.itemCardPreview.cards,flowers=s.itemCardPreview.flowers;
    const labels=items.map(({marker})=>{
      const l=marker.levelLabel,z=l.style.resolution,c=l.canvas,data=l.context.getImageData(0,0,c.width,c.height).data;
      let right=0,bottom=0,white=0,dark=0;
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
       const i=(y*c.width+x)*4;if(!data[i+3])continue;
       right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
       if(data[i]>240&&data[i+1]>240&&data[i+2]>240)white++;
       if(data[i]<32&&data[i+1]<32&&data[i+2]<32)dark++;
      }
      return {right:l.x+right/z,bottom:l.levelBaseY+bottom/z,white,dark,offsetX:l.style.shadowOffsetX,offsetY:l.style.shadowOffsetY,blur:l.style.shadowBlur};
    });
    return {labels,lifts:[...items,...flowers].map(({marker})=>marker.floatLift),synchronized:[...items,...flowers].every(({marker})=>marker.list.slice(0,3).every(o=>o.y===-marker.floatLift)&&(!marker.levelLabel||Math.abs(marker.levelLabel.y-marker.levelLabel.levelBaseY+marker.floatLift)<.001))};
   });
   assert.ok(floatCheck.labels.every(l=>Math.abs(l.right-14)<.01&&Math.abs(l.bottom-14)<.01&&l.white>0&&l.dark>0&&l.offsetX===1&&l.offsetY===1&&l.blur===0),'white text and shadow have 2px outer inset on right and bottom');
   assert.ok(floatCheck.synchronized);assert.ok(floatCheck.lifts.every(v=>v>=0&&v<=4));
   assert.ok(new Set(floatCheck.lifts).size>1,'staggered floating phases');
   await page.waitForFunction(old=>{const s=window.__previewGame.scene.getScene('Game');return s.itemCardPreview.cards.some(({marker},i)=>marker.floatLift!==old[i]);},floatCheck.lifts);
   assert.equal(new Set(initial.flowers.map(o=>o.texture)).size,6);
   assert.equal(new Set(initial.items.map(o=>o.texture)).size,12);
   assert.ok(initial.flowers.every(o=>o.texture.startsWith('item-svg:trim:flower-')&&Math.abs(o.span-18)<.01));
   assert.ok(initial.items.every(o=>o.texture.startsWith('item-svg:trim:')&&Math.abs(o.span-24)<.01));
   assert.ok(initial.items.every(o=>!o.texture.includes('water-splash')));
   assert.ok([...initial.items,...initial.flowers].every(o=>Math.abs(Math.max(o.textureWidth,o.textureHeight)-o.span*w/960)<=1),'native output-sized textures');
   assert.ok(initial.ground.every(o=>o.visible&&!o.interactive&&/^item-svg:trim:(gem|heart):display:/.test(o.texture)));
   assert.ok([...initial.flowers,...initial.items].every(o=>o.visible));
   assert.equal(initial.enemy,false);assert.equal(initial.combat,false);assert.equal(initial.stage,4);
   const expected=[
    ['신발','이동 속도 +10'],['물풍선','초당 피해량 +24'],['부메랑','초당 피해량 +18'],
    ['방패','방어력 +6'],['바퀴','초당 피해량 +22'],['화분','초당 피해량 +26'],
    ['종이비행기','초당 피해량 +20'],['탱탱볼','초당 피해량 +16'],['끈끈이','적 이동 속도 -30%'],
    ['스프링클러','초당 피해량 +18'],['돌멩이','초당 피해량 +12'],['빗자루','초당 피해량 +20']
   ];
   for(let i=0;i<expected.length;i++){
    await page.mouse.move(...coords(initial.items[i].x,initial.items[i].y));
    const state=await snapshot();assert.equal(state.tip,true);
    assert.equal(state.tipRows[0],expected[i][0]);
    assert.ok(state.tipRows.includes(expected[i][1]));
    assert.match(state.tipRows[1],/(합니다|줍니다|갑니다|시킵니다)\.$/);
    assert.equal(state.patrolSpeed,initial.patrolSpeed);
   }
   await page.mouse.move(...coords(10,250));
   const diagonal=await page.evaluate(()=>{
    const W=window.GardenItemCards,s=window.__previewGame.scene.getScene('Game');
    const t=s.textures.get(W.key('broom')).getSourceImage();
    return {angle:Math.atan2(380-572,1183-1097)+W.broomRotation,w:t.width,h:t.height};
   });
   assert.ok(Math.abs(diagonal.angle+Math.PI/4)<1e-10);
   assert.ok(Math.min(diagonal.w,diagonal.h)/Math.max(diagonal.w,diagonal.h)>.75,'diagonal broom retains near-square bounds');
   const art=await page.evaluate(()=>{
    const scene=window.__previewGame.scene.getScene('Game'),wheel=scene.textures.get('item-svg:trim:wheel').getSourceImage(),ctx=wheel.getContext('2d');
    const {data}=ctx.getImageData(0,0,wheel.width,wheel.height);
    let holes=0,white=0;
    for(let y=Math.floor(wheel.height*.25);y<wheel.height*.75;y++)for(let x=Math.floor(wheel.width*.25);x<wheel.width*.75;x++){
     const i=(y*wheel.width+x)*4;if(data[i+3]===0)holes++;if(data[i+3]>240&&data[i]>230&&data[i+1]>230&&data[i+2]>220)white++;
    }
    return {holes,white};
   });
   assert.ok(art.holes>100,'wheel center has transparent gaps');assert.equal(art.white,0);
   await page.screenshot({path:join(out,'cards-'+w+'-initial.png')});
   // Resizing must rebuild output-sized textures without changing logical bounds.
   await page.setViewportSize({width:1920,height:1080});
   await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').children.getByName('placeholder:item:00').list[2].frame.width===48||window.__previewGame.scene.getScene('Game').children.getByName('placeholder:item:00').list[2].frame.height===48);
   const enlarged=await snapshot();assert.ok(enlarged.items.every(o=>Math.abs(Math.max(o.textureWidth,o.textureHeight)-2*o.span)<=1));
   await page.setViewportSize({width:w,height:h});
   await page.waitForFunction(expected=>{const o=window.__previewGame.scene.getScene('Game').children.getByName('placeholder:item:00').list[2];return Math.max(o.frame.width,o.frame.height)===expected;},Math.round(24*w/960));
   // Real pointer drag: invalid occupied cell, then valid adjacent cell with ghost.
   await drag(initial.flowers[0],initial.invalid);let state=await snapshot();
   assert.equal(state.stage,4);assert.equal(state.flowers[0].visible,true);
   await drag(initial.flowers[0],initial.candidate,false);state=await snapshot();
   assert.equal(state.ghost,true);assert.equal(state.flowers[0].alpha,.25);assert.equal(state.flowers[0].lift,0);
   await page.mouse.up();state=await snapshot();
   assert.equal(state.stage,5);assert.ok(state.occupied.includes(43));assert.equal(state.flowers[0].visible,false);assert.equal(state.progress,'5%');assert.equal(state.ghost,false);
   // Hover, equip, then replace using the restored item-card UI.
   await page.mouse.move(...coords(initial.items[0].x,initial.items[0].y));
   assert.equal((await snapshot()).tip,true);
   await drag(initial.items[0],initial.slot,false);state=await snapshot();assert.equal(state.ghostTexture,initial.items[0].texture);assert.equal(state.ghostLevel,'Lv.1');assert.equal(state.items[0].lift,0);assert.equal(state.speed,'110');assert.equal(state.patrolSpeed,initial.patrolSpeed);await page.mouse.up();state=await snapshot();
   assert.equal(state.items[0].visible,false);assert.equal(state.gear,true);assert.equal(state.gearTexture,initial.items[0].texture);assert.equal(state.gearLevel,'Lv.1');assert.equal(state.speed,'110');assert.equal(state.patrolSpeed,initial.patrolSpeed);
   await drag(initial.items[1],initial.slot);state=await snapshot();
   assert.equal(state.items[1].visible,false);assert.equal(state.gear,true);assert.equal(state.gearTexture,initial.items[1].texture);assert.equal(state.speed,'100');assert.equal(state.dps,'44');assert.equal(state.patrolSpeed,initial.patrolSpeed);
   await drag(initial.items[3],initial.slot);state=await snapshot();assert.equal(state.defense,'18');assert.equal(state.dps,'20');assert.equal(state.patrolSpeed,initial.patrolSpeed);
   // Slow is a tooltip-only enemy modifier. Equipping in an empty slot
   // must not change any HUD value or produce a delta.
   const beforeSticky=state;
   await drag(initial.items[8],initial.slot2,false);state=await snapshot();
   assert.deepEqual(state.hudStats,beforeSticky.hudStats);assert.deepEqual(state.hudDeltas,[]);
   await page.mouse.up();state=await snapshot();
   assert.deepEqual(state.hudStats,beforeSticky.hudStats);assert.deepEqual(state.hudDeltas,[]);
   await page.mouse.move(...coords(initial.slot2.x,initial.slot2.y));state=await snapshot();
   assert.ok(state.tipRows.includes('적 이동 속도 -30%'));
   // Replacing slow with a damage item adds only the incoming DPS.
   await drag(initial.items[2],initial.slot2,false);state=await snapshot();
   assert.equal(state.dps,'38');assert.deepEqual(state.hudDeltas,[['stat-delta:dps','+18']]);
   assert.ok(state.tipRows.includes('적 이동 속도 -30% 효과 제거'));
   await page.mouse.up();state=await snapshot();
   assert.equal(state.dps,'38');assert.equal(state.defense,'18');assert.equal(state.speed,'100');assert.deepEqual(state.hudDeltas,[]);
   assert.equal(state.patrolSpeed,initial.patrolSpeed);
   await page.screenshot({path:join(out,'cards-'+w+'-equipped.png')});
   // Pause cancels in-progress drag, then returning to menu resets the preview.
   await drag(initial.flowers[1],initial.candidate,false);
   await page.keyboard.press('Escape');await page.mouse.up();
   await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   state=await snapshot();assert.equal(state.flowers[1].visible,true);assert.equal(state.flowers[1].alpha,1);assert.equal(state.ghost,false);
   await click(480,338);await page.waitForFunction(()=>window.__previewGame.scene.isActive('Confirm'));
   await click(537,323);await page.waitForFunction(()=>window.__previewGame.scene.isActive('MainMenu'));
   await start();state=await snapshot();assert.equal(state.stage,4);assert.equal(state.gear,false);
   assert.ok([...state.flowers,...state.items].every(o=>o.visible));
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(enemyRequests,[]);
   console.log('PASS '+w+'x'+h+': all 20 SVG assets, pointer drag, tooltip, equip/replace, pause, restart, no enemy requests');
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();}
