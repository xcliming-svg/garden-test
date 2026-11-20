import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const phaser = require.resolve('phaser/dist/phaser.min.js');
const mime = { '.js':'application/javascript', '.html':'text/html; charset=utf-8',
  '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' };
const server = createServer((req,res)=>{
  try {
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1)) || 'index.html';
    if (path.includes('..')) return res.writeHead(404).end();
    let data = readFileSync(path==='phaser.js'?phaser:join(process.cwd(),path));
    if (path==='index.html') data=data.toString().replace(
      'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
    if (path==='src/main.js') data=data.toString().replace(
      "  window.addEventListener('resize',",
      "  window.__slotTestGame = game;\n  window.addEventListener('resize',");
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(data);
  } catch(error){res.writeHead(500).end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:[
    '--no-sandbox','--disable-dev-shm-usage',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  for (const [width,height] of [[960,540],[1280,720]]) {
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__slotTestGame?.scene.isActive('MainMenu'));
    // Stage 2 retains a purchasable left slot (stage 1 already starts at its cap).
    await page.locator('#blueprint-select').selectOption('stage-2');
    const canvas=await page.locator('canvas').boundingBox();
    await page.mouse.click(canvas.x+480*canvas.width/960,canvas.y+252*canvas.height/540);
    await page.waitForFunction(()=>{
      const s=window.__slotTestGame?.scene.getScene('Game');
      return !!s?.runEquipment && !!s.runDrops && !!s.children.getByName('slot-pair-secondary:9');
    });
    const state=await page.evaluate(()=>{
      const L=window.GardenGameLayout, s=window.__slotTestGame.scene.getScene('Game'),b=L.bottomLayout(),
        slots=L.spec.slots,list=s.children.list;
      const pairFrames=list.filter(x=>x.name?.startsWith('slot-pair-secondary:'))
        .sort((a,b)=>Number(a.name.split(':')[1])-Number(b.name.split(':')[1]));
      const inputZones=list.filter(x=>x.name?.startsWith('preview-slot:'))
        .sort((a,b)=>Number(a.name.split(':')[1])-Number(b.name.split(':')[1]));
      const painted = obj => {
        const ink=window.GardenUI.inkBounds(obj,L.colors.hud),z=s.cameras.main.zoom;
        return {left:obj.x-obj.displayOriginX+ink.left/z,right:obj.x-obj.displayOriginX+ink.right/z,
          top:obj.y-obj.displayOriginY+ink.top/z,bottom:obj.y-obj.displayOriginY+ink.bottom/z};
      };
      const stats=['dps','defense','moveSpeed'].map(key=>{
        const label=s.children.getByName('stat-label:'+key),value=s.children.getByName('stat-value:'+key);
        return {key,labelX:label.x,valueX:value.x,labelInk:painted(label),valueInk:painted(value)};
      });
      const item=window.GardenItemCards.createDrop(s,L.spec,L.assets,'item','rock',100,120,'pair-sizing-test',1);
      const fieldCard={width:item.marker.width,height:item.marker.height,frame:item.marker.list[0].width,
        icon:item.marker.list[2].displayWidth};
      window.GardenItemCards.disposeCard(item.marker);
      return {
        spec:{bottom:L.spec.bottom,top:L.spec.top,field:L.spec.fieldHeight,y:slots.y,size:slots.size,
          gap:slots.gap,paired:slots.paired,pairGap:slots.pairGap,itemDrop:L.assets.item.dropSize,
          card:L.assets.item.cardSize},
        layout:{left:b.left,right:b.right,totalWidth:b.totalWidth,centerY:b.centerY,
          slotLeft:b.slotLeft,sideWidth:b.sideWidth,statColumnWidth:b.statColumnWidth,
          slots:b.slots.map(v=>({x:v.x,y:v.y,size:v.size}))},
        frames:pairFrames.map(x=>({x:x.x,y:x.y,width:x.width,height:x.height,interactive:!!x.input})),
        zones:inputZones.map(x=>({x:x.x,y:x.y,width:x.width,height:x.height,interactive:!!x.input?.enabled})),
        stats,fieldCard,
        equipped:s.runEquipment.equipped.map(x=>x?.id??null),runSlotCount:s.run.state.slotCount,
        buyZone:s.children.getByName('run-slot-purchase')?.name,
        flowerbeds:!!window.GardenFairyFlowerbeds?.enabled
      };
    });
    assert.equal(state.spec.bottom,42);
    assert.equal(state.spec.field,466);
    assert.equal(state.spec.y,503);
    assert.equal(state.spec.size,34);
    assert.equal(state.spec.itemDrop,34);
    assert.equal(state.spec.card,34);
    assert.equal(state.spec.gap,3);
    assert.equal(state.spec.pairGap,3);
    assert.equal(state.spec.paired,true);
    assert.equal(state.layout.left,10);
    assert.equal(state.layout.right,720);
    assert.equal(state.layout.sideWidth,240);
    assert.equal(state.layout.statColumnWidth,80);
    assert.equal(state.layout.totalWidth,707);
    assert.equal(state.layout.centerY,520);
    assert.equal(state.layout.slotLeft,10);
    assert.equal(state.layout.slots.length,10);
    assert.equal(state.frames.length,10);
    assert.equal(state.zones.length,10);
    assert.deepEqual(state.fieldCard.width,34);
    assert.deepEqual(state.fieldCard.height,34);
    assert.deepEqual(state.fieldCard.frame,34);
    assert.equal(state.equipped.length,10);
    assert.equal(state.equipped[0],'rock');
    assert.ok(state.runSlotCount<=10);
    assert.equal(state.flowerbeds,false);
    assert.equal(state.buyZone,'run-slot-purchase');
    for(let i=0;i<10;i++){
      const x=10+i*71;
      assert.deepEqual(state.layout.slots[i],{x,y:503,size:34});
      assert.deepEqual(state.frames[i],{x:x+34,y:503,width:34,height:34,interactive:false});
      assert.equal(state.zones[i].x,x+17);
      assert.equal(state.zones[i].y,520);
      assert.equal(state.zones[i].width,34);
      assert.equal(state.zones[i].height,34);
    }
    assert.equal(state.layout.slots[9].x+68,717);
    assert.equal(state.layout.right-717,3,'3px gap between the last paired slot and stats');
    assert.equal(960-(state.layout.right+state.layout.sideWidth),0,
      'the previously unused 10px participates in the three-column calculation');
    assert.equal(state.spec.y-(state.spec.top+state.spec.field+2),3);
    assert.equal(540-(state.spec.y+state.spec.size),3);
    // Divide (230px stats + 10px former tail) equally into 80px columns.
    // The text itself must still be at least 10px from the screen edge.
    for(const [index,row] of state.stats.entries()) {
      const expectedCenter=760+80*index;
      const left=720+80*index,right=720+80*(index+1);
      assert.equal(row.labelX,expectedCenter,'label should sit at the equal-width column center');
      assert.equal(row.valueX,expectedCenter,'value should sit at the equal-width column center');
      assert.ok(row.labelInk.left>=left-1&&row.labelInk.right<=right+1,
        'label should remain within its one-third column: '+JSON.stringify(row));
      assert.ok(row.valueInk.left>=left-1&&row.valueInk.right<=right+1,
        'value should remain within its one-third column: '+JSON.stringify(row));
      assert.ok(row.labelInk.right<=950&&row.valueInk.right<=950,
        'painted text must preserve the original 10px right padding: '+JSON.stringify(row));
      assert.ok(row.labelInk.top>=state.spec.top+state.spec.field,
        'label exceeds HUD top edge: '+JSON.stringify(row));
      assert.ok(row.valueInk.bottom<=540,
        'value exceeds HUD bottom edge: '+JSON.stringify(row));
    }
    assert.deepEqual(state.stats.map(row=>row.labelX),[760,840,920],
      'three stat centers are spaced according to full remaining area');
    await page.evaluate(()=>{
      const s=window.__slotTestGame.scene.getScene('Game');
      s.run.credit(200);
      s.children.getByName('run-slot-purchase').emit('pointerdown');
    });
    const bought=await page.evaluate(()=>{
      const s=window.__slotTestGame.scene.getScene('Game');
      return {count:s.run.state.slotCount,
        first:s.children.getByName('preview-slot:0').x,
        last:s.children.getByName('preview-slot:9').x};
    });
    assert.equal(bought.count,state.runSlotCount+1,'buying must still open one actual left slot');
    assert.equal(bought.first,27,'left slot remains fixed');
    assert.equal(bought.last,666,'last slot remains fixed');
    assert.deepEqual(errors,[],'browser errors at '+width+'x'+height);
    console.log('Paired HUD PASS',width,height,'10 pairs, 34px, gap 3, margins 3');
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
