import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import * as fontkit from 'fontkit';

const root = process.cwd(), out = resolve('benchmark-results');
mkdirSync(out, {recursive:true});
const require = createRequire(import.meta.url);
const phaserPath = require.resolve('phaser/dist/phaser.min.js');
const originals = Object.fromEntries(['ui.js','game-layout.js','scenes.js','main.js'].map(n=>[n,readFileSync(join(root,'src',n),'utf8').replace(/\r\n/g,'\n')]));
const configs=[{id:'R',name:'screenshot-matched UI',top:32,bottom:44,margin:10,label:12,value:12,timer:12,body:12,menu:12,navFont:14,navHeight:24,navGap:3,blueCell:8,bluePad:5,blueHead:19,slotGap:3,statLabel:8,statValue:8,statCol:70,statGap:5,hudGap:5,bar:12,tipW:158,tipPad:6,tipRow:5,tipLine:4,tipFont:10}];
function replace(s,a,b){if(!s.includes(a))throw Error('missing anchor '+a);return s.replaceAll(a,b);}
const variants={R:originals};
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost'), parts=url.pathname.split('/').filter(Boolean), id=parts.shift();
    const path=parts.join('/')||'index.html';
    if(!variants[id]||path.includes('..')){res.writeHead(404).end();return;}
    let body;
    if(path==='phaser.js')body=readFileSync(phaserPath);
    else if(path.startsWith('src/')&&variants[id][parts[1]]) {
      body=variants[id][parts[1]];
      if(path==='src/main.js')body=replace(body,"  window.addEventListener('resize',", "  window.__benchmarkGame = game;\n  window.addEventListener('resize',");
    }else {
      body=readFileSync(join(root,path));
      if(path==='index.html')body=body.toString().replace('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
    }
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'no-store'}).end(body);
  } catch(e) {res.writeHead(500).end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
// Verify the actual bundled font contains every translated glyph; browser fallback must not hide missing glyphs.
const fontCss=readFileSync(join(root,'assets/fonts/fusion.css'),'utf8');
const font=fontkit.create(Buffer.from(fontCss.match(/base64,([A-Za-z0-9+/=]+)/)[1],'base64'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const viewportSizes=[[640,360],[960,540],[1280,720],[1600,900],[1920,1080]];
const clamp=x=>Math.max(0,Math.min(1,x));
const results=[];
for(const c of configs){
 const errors=[], checks=[], observations=[], page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 const check=(name,pass,detail='')=>checks.push({name,pass:!!pass,detail});
 try{
  // Each candidate runs the actual Phaser app with the bundled font. Stress HUD is intentional.
  await page.goto(origin+'/'+c.id+'/index.html?preview=1&hud=stress',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__benchmarkGame?.scene.isActive('MainMenu'),{},{timeout:20000});
  const scene=async key=>page.evaluate(key=>window.__benchmarkGame.scene.isActive(key),key);
  const button=async (key,label)=>{
    const pos=await page.evaluate(({key,label})=>{const s=window.__benchmarkGame.scene.getScene(key), o=s.children.list.find(o=>o.type==='Container'&&o.list?.[1]?.text===label);if(!o)throw Error('missing '+label);return {x:o.x*s.cameras.main.zoom,y:o.y*s.cameras.main.zoom}}, {key,label});
    const box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+pos.x,box.y+pos.y);
  };
  const menuMetrics=async key=>page.evaluate(key=>{
    const s=window.__benchmarkGame.scene.getScene(key), list=s.children.list;
    const buttons=list.filter(o=>o.type==='Container'&&o.list?.length===2&&o.list[0].type==='Rectangle'&&o.list[1].type==='Text').map(o=>{let [r,t]=o.list;return {text:t.text,x:o.x-r.width/2,y:o.y-r.height/2,w:r.width,h:r.height,px:(r.width-t.width)/2,py:(r.height-t.height)/2,font:parseFloat(t.style.fontSize)}});
    const texts=list.filter(o=>o.type==='Text'&&o.visible).map(o=>({text:o.text,x:o.x-o.displayOriginX,y:o.y-o.displayOriginY,w:o.width,h:o.height}));
    const panels=list.filter(o=>o.type==='Rectangle'&&o.width<960&&o.height>100).map(o=>({x:o.x-o.width/2,y:o.y-o.height/2,w:o.width,h:o.height}));
    return {buttons,texts,panels,zoom:s.cameras.main.zoom};
  },key);
  function inspectMenu(m,key){
    const within=o=>o.x>=-0.5&&o.y>=-0.5&&o.x+o.w<=960.5&&o.y+o.h<=540.5;
    const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.5;
    check(key+' button bounds',m.buttons.every(o=>within(o)&&o.px>=2&&o.py>=2),JSON.stringify(m.buttons.filter(o=>!within(o)||o.px<2||o.py<2)));
    check(key+' text bounds',m.texts.every(within));
    check(key+' button/text nonoverlap',m.buttons.every((b,i)=>m.buttons.every((q,j)=>i===j||!overlap(b,q))&&m.texts.every(t=>!overlap(b,t))),JSON.stringify(m.buttons.flatMap(b=>m.texts.filter(t=>overlap(b,t)).map(t=>[b.text,t.text]))));
    if(key==='Pause'||key==='Settings'||key==='Codex'||key==='Confirm'||key==='Victory'||key==='Defeat'){
      const panel=m.panels[0];check(key+' panel contains buttons',!!panel&&m.buttons.every(b=>b.x>=panel.x&&b.y>=panel.y&&b.x+b.w<=panel.x+panel.w&&b.y+b.h<=panel.y+panel.h));
    }
  }
  let menu=await menuMetrics('MainMenu');inspectMenu(menu,'MainMenu');
  await page.screenshot({path:join(out,c.id+'-menu.png')});
  await button('MainMenu','새 게임');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Game'));
  // Actual Phaser object dimensions / text bounding boxes and Canvas font metrics.
  const gameMetrics=async()=>page.evaluate(()=>{
    const L=window.GardenGameLayout,U=window.GardenUI,s=window.__benchmarkGame.scene.getScene('Game'),bl=L.bottomLayout(), list=s.children.list;
    const textRect=o=>({name:o.name,text:o.text,x:o.x-o.displayOriginX,y:o.y-o.displayOriginY,w:o.width,h:o.height,font:parseFloat(o.style.fontSize),color:o.style.color,resolution:o.style.resolution});
    const visibleText=list.filter(o=>o.type==='Text'&&o.visible&&o.text).map(textRect);
    const hud=visibleText.filter(o=>o.y<L.spec.top&&o.y+o.h>0);
    const clock=hud.find(o=>o.text==='시간'), kills=hud.find(o=>o.text==='처치 수'), gardenLabel=hud.find(o=>o.text==='정원 완성도');
    const gemValue=hud.filter(o=>o.text==='999,999,999,999').sort((a,b)=>a.x-b.x).at(-1);
    const metricWidth=kills.x-clock.x;
    const timeValue=hud.find(o=>o.text==='9999:59:59'), percent=hud.find(o=>o.text==='30%');
    const timeGap=timeValue.x-clock.x-Math.ceil(clock.w);
    const barGap=percent.x+percent.w/2-L.hud.barWidth/2-gardenLabel.x-Math.ceil(gardenLabel.w);
    const hudLayout={metricWidth,timeGap,barGap,leftPadding:clock.x,rightPadding:L.spec.width-(percent.x+percent.w/2+L.hud.barWidth/2),textPadTop:clock.y,textPadBottom:L.spec.top-2-clock.y-clock.h,barHeight:L.hud.barHeight,gemX:gemValue.x-L.hud.padding-L.hud.iconSize-L.hud.gap,progressX:gardenLabel.x-L.hud.padding,centerY:L.hud.centerY,labelColors:[clock.color,kills.color,gardenLabel.color],valueColors:hud.filter(o=>!['시간','처치 수','정원 완성도'].includes(o.text)).map(o=>o.color)};
    const stats=visibleText.filter(o=>o.name?.startsWith('stat-'));
    const cost=visibleText.find(o=>o.text==='999');
    const context=document.createElement('canvas').getContext('2d');
    const ink=(size,text)=>{context.font=size+'px '+U.fontFamily;let m=context.measureText(text);return m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;};
    const blueprint=L.spec.blueprint,slot=bl.slots[9];
    const title=visibleText.find(o=>o.name==='blueprint-title'), toggle=s.children.getByName('blueprint-toggle');
    const hudBottom=L.spec.top-Math.max(clock.y+clock.h,timeValue.y+timeValue.h);
    const blueprintMetrics={topGap:blueprint.y-L.spec.top,hudBottom,roundedHudBottom:Math.round(hudBottom),titlePadX:title.x-blueprint.x,titlePadTop:title.y-blueprint.y,titlePadBottom:blueprint.y+blueprint.header-title.y-title.h,titleHeight:title.h,titleFont:title.font,gridGap:blueprint.gridY-blueprint.y-blueprint.header,gridX:blueprint.gridX,headerX:toggle.x-toggle.width/2,width:toggle.width,height:toggle.height};
    const enemies=list.filter(o=>o.name?.startsWith('placeholder:'));
    return {zoom:s.cameras.main.zoom,canvas:[s.scale.gameSize.width,s.scale.gameSize.height],top:L.spec.top,bottom:L.spec.bottom,field:L.spec.fieldHeight,garden:L.spec.garden,blueprint,blueprintMetrics,slots:bl.slots,slotGap:L.spec.slots.gap,stats,statSpec:L.bottomStats,costSpec:L.slotCost,side:bl.sideWidth,sideLeft:bl.left,sideRight:bl.right,slotLeft:bl.slotLeft,slotWidth:bl.totalWidth,hud,hudLayout,cost,
      fixed:{garden:L.spec.garden.cell,slot:L.spec.slots.cell,slotOuter:L.spec.slots.size,flower:L.assets.flower.size,item:L.assets.item.size,card:L.assets.item.cardSize,line:L.spec.garden.line},
      markerOverflow:enemies.filter(o=>o.visible&&(o.y-(o.height||o.displayHeight)/2<L.spec.top||o.y+(o.height||o.displayHeight)/2>L.spec.top+L.spec.fieldHeight)).map(o=>o.name),
      ink:{label:ink(L.hud.labelSize,'정원 완성도'),value:ink(L.hud.valueSize,'999,999'),timer:ink(L.hud.timeSize,'00:00:00'),statLabel:ink(L.bottomStats.fontSize,'초당 피해량'),statValue:ink(L.bottomStats.valueSize,'100 +24'),tip:ink(L.itemTooltip.fontSize,'획득 범위가 증가합니다.'),menu:ink(U.fontSize.menuAction,'새 게임')},
      fontLoaded:document.fonts.check('10px '+U.fontFamily),tipFont:L.itemTooltip.fontSize
    };
  });
  const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.5;
  const inspectGame=(m,label)=>{
    const eps=0.6;
    check(label+' fixed sizes',JSON.stringify(m.fixed)===JSON.stringify({garden:22,slot:34,slotOuter:36,flower:16,item:16,card:36,line:1}));
    check(label+' HUD bounds',m.hud.length>=6&&m.hud.every(t=>t.x>=-eps&&t.y>=-eps&&t.x+t.w<=960+eps&&t.y+t.h<=m.top+eps),JSON.stringify(m.hud));
    const bp=m.blueprintMetrics;
    check(label+' blueprint alignment and visible HUD spacing',bp.width===91&&bp.gridX===bp.headerX&&bp.headerX===m.hudLayout.leftPadding&&bp.titlePadX===5&&bp.gridGap===-1&&m.blueprint.gap===0&&bp.titleFont===10&&m.blueprint.cell===8&&m.blueprint.line===1&&m.blueprint.width===91&&m.blueprint.height===m.blueprint.header+91-1&&bp.height===19&&bp.topGap===m.hudLayout.textPadTop,JSON.stringify(bp));
    check(label+' HUD nonoverlap',m.hud.every((a,i)=>m.hud.every((b,j)=>i===j||!overlap(a,b))));
    check(label+' equal HUD widths, center and labels',m.top===32&&m.hudLayout.centerY===15&&m.hudLayout.leftPadding===7.5&&m.hudLayout.rightPadding===7.5&&m.hudLayout.textPadTop===7.5&&m.hudLayout.textPadBottom===7.5&&m.hudLayout.barHeight===12&&Math.abs(m.hudLayout.timeGap-5)<0.01&&Math.abs(m.hudLayout.barGap-5)<0.01&&m.hudLayout.metricWidth>0&&m.hudLayout.gemX===2*m.hudLayout.metricWidth&&3*m.hudLayout.metricWidth<=m.hudLayout.progressX&&m.hudLayout.labelColors.every(c=>c.toLowerCase()==='#b0b0b0')&&m.hudLayout.valueColors.every(c=>c.toLowerCase()==='#ffffff'),JSON.stringify(m.hudLayout));
    check(label+' stat bounds',m.stats.length>=12&&m.stats.every(t=>t.font===8&&t.y>=540-m.bottom-eps&&t.y+t.h<=540+eps&&t.x>=-eps&&t.x+t.w<=960+eps),JSON.stringify(m.stats));
    const statGroups=['defense','hp','luck','moveSpeed','pickupRange','dps'].map((key,i)=>{const a=m.stats.find(t=>t.name==='stat-label:'+key), v=m.stats.find(t=>t.name==='stat-value:'+key),d=m.stats.find(t=>t.name==='stat-delta:'+key);const center=(i<3?m.sideLeft:m.sideRight)+(i%3+0.5)*70;const left=Math.min(v.x,d?.x??v.x),right=Math.max(v.x+v.w,d?d.x+d.w:v.x+v.w);return !!a&&!!v&&Math.abs(a.x+a.w/2-center)<0.01&&Math.abs((left+right)/2-center)<0.01&&left>=center-35&&right<=center+35&&a.x>=center-35&&a.x+a.w<=center+35&&Math.abs(v.y-a.y-a.h-5)<0.01&&Math.abs((a.y+v.y+v.h)/2-(540-m.bottom/2))<0.01&&(!d||Math.abs(d.x-v.x-v.w-2)<0.01&&d.y===v.y);});
    check(label+' 70px columns, 5px row gap and centered groups',m.side===210&&m.statSpec.columnWidth===70&&m.statSpec.lineGap===5&&statGroups.every(Boolean),JSON.stringify(m.stats));
    check(label+' stat nonoverlap',m.stats.every((a,i)=>m.stats.every((b,j)=>i===j||!overlap(a,b))));
    check(label+' stats/slots separation',m.stats.every(t=>m.slots.every(b=>!overlap(t,{x:b.x,y:b.y,w:b.size,h:b.size}))));
    let cost=m.cost,b=m.slots[9];check(label+' cost bounds',!!cost&&cost.font===8&&m.costSpec.gap===5&&m.stats.filter(t=>t.name.startsWith('stat-value:')).every(t=>t.y===cost.y&&t.h===cost.h)&&cost.y-5-m.costSpec.iconSize>=b.y+1&&Math.abs(cost.x+cost.w/2-(b.x+b.size/2))<0.01&&cost.x>=b.x+1-eps&&cost.y>=b.y+1-eps&&cost.x+cost.w<=b.x+b.size-1+eps&&cost.y+cost.h<=b.y+b.size-1+eps,JSON.stringify(cost));
    // A dragged item intentionally follows the pointer into the HUD/slot. Only this specific card
    // is exempt during replacement; independently verify its exact target/alpha below.
    const overflow=m.markerOverflow.filter(n=>label!=='replacement stats'||n!=='placeholder:item:3');
    check(label+' field marker bounds',overflow.length===0,JSON.stringify(overflow));
    check(label+' font loaded',m.fontLoaded);
    check(label+' zoom',Math.abs(m.zoom-Math.min(m.canvas[0]/960,m.canvas[1]/540))<1e-6&&m.hud.every(t=>Math.abs(t.resolution-Math.max(1,m.zoom))<1e-6));
  };
  const initial=await gameMetrics();inspectGame(initial,'initial');

  // Read-only sizing probe: proposed translation labels, no game localization changes.
  const proposedStatLabels={
    ko:['방어력','최대 체력','행운','이동 속도','획득 범위','초당 피해량'],
    en:['Defense','Max Health','Luck','Movement Speed','Pickup Range','Damage per Second'],
    ja:['防御力','最大体力','運','移動速度','拾得範囲','毎秒ダメージ'],
    es:['Defensa','Salud máxima','Suerte','Velocidad de movimiento','Alcance de recogida','Daño por segundo'],
    zh:['防御力','最大生命值','幸运','移动速度','拾取范围','每秒伤害']
  };
  const shortStatLabels={
    ko:proposedStatLabels.ko,
    en:['Defense','Max Health','Luck','Move Speed','Pickup Range','DPS'],
    ja:proposedStatLabels.ja,
    es:['Defensa','Salud máx.','Suerte','Vel. movimiento','Rango recogida','DPS'],
    zh:proposedStatLabels.zh
  };
  const statWidthReport=await page.evaluate(({full,short})=>{
    const U=window.GardenUI,L=window.GardenGameLayout,s=window.__benchmarkGame.scene.getScene('Game'),p=U.text(s,0,0,'',10,'#FFFFFF');
    const width=v=>{p.setText(v);return p.width;};
    const measure=labels=>Object.fromEntries(Object.entries(labels).map(([k,arr])=>[k,arr.map(v=>({label:v,width:width(v)}))]));
    const numberRows=[['124','+24'],['100','-24'],['999','+999'],['9,999','+9,999'],['999,999','+999,999'],['999,999,999,999','+999,999,999,999']].map(([value,delta])=>({value,delta,width:width(value)+L.bottomStats.deltaGap+width(delta)}));
    const b=L.bottomLayout(), maxColumnWidth=Math.floor(Math.min(b.slotLeft-b.left,L.spec.width-b.left-(b.slotLeft+b.totalWidth))/L.bottomStats.columns);
    const result={full:measure(full),short:measure(short),numberRows,currentColumnWidth:L.bottomStats.columnWidth,maxColumnWidth,slotCostFont:L.slotCost.fontSize};
    p.destroy();return result;
  },{full:proposedStatLabels,short:shortStatLabels});
  const missingStatGlyphs=[...new Set([...Object.values(proposedStatLabels).flat(),...Object.values(shortStatLabels).flat()].join(''))].filter(c=>!font.hasGlyphForCodePoint(c.codePointAt(0)));
  console.log('STAT_WIDTH_REPORT '+JSON.stringify({...statWidthReport,missingStatGlyphs}));
  const statWidth8=await page.evaluate(({full,short})=>{
    const U=window.GardenUI,L=window.GardenGameLayout,s=window.__benchmarkGame.scene.getScene('Game'),p=U.text(s,0,0,'',8,'#FFFFFF');
    const width=v=>{p.setText(v);return p.width;};
    const measure=labels=>Object.fromEntries(Object.entries(labels).map(([k,arr])=>[k,arr.map(v=>({label:v,width:width(v)}))]));
    const numberRows=[['124','+24'],['999','+999'],['9,999','+9,999'],['999,999','+999,999'],['999,999,999,999','+999,999,999,999']].map(([value,delta])=>({value,delta,width:width(value)+L.bottomStats.deltaGap+width(delta)}));
    const result={full:measure(full),short:measure(short),numberRows,slotCostWidth:width('999')};
    p.destroy();return result;
  },{full:proposedStatLabels,short:shortStatLabels});
  console.log('STAT_WIDTH_8_REPORT '+JSON.stringify(statWidth8));
  check('70px column fits proposed short labels and four-digit value/delta with 5px side allowance',missingStatGlyphs.length===0&&Object.values(statWidth8.short).flat().every(v=>v.width+10<=70)&&statWidth8.numberRows.find(v=>v.value==='9,999').width+10<=70);


  const dropState=()=>page.evaluate(()=>{
    const s=window.__benchmarkGame.scene.getScene('Game');
    return s.children.list.filter(o=>/^placeholder:(item|flower):/.test(o.name||'')).map(o=>({name:o.name,x:o.x,y:o.y,w:o.width,h:o.height,hitW:o.input.hitArea.width,hitH:o.input.hitArea.height,border:o.list[0].visible,borderY:o.list[0].y,borderColor:o.list[0].fillColor,face:o.list[1].visible,faceColor:o.list[1].fillColor,faceW:o.list[1].width,faceH:o.list[1].height,faceY:o.list[1].y,img:o.list[2].y,imgW:o.list[2].displayWidth,shadow:o.list[3].visible,shadowW:o.list[3].width,shadowH:o.list[3].height}));
  });
  const drops=await dropState();
  check('all eight drops have reference 24px frames, 16px icons and matching hit boxes',drops.length===8&&drops.every(o=>o.w===24&&o.h===24&&o.hitW===24&&o.hitH===24&&o.border&&o.face&&o.faceColor===(o.name.includes(':flower:')?0x343446:0x3B3B4E)&&o.borderColor===(o.name.includes(':flower:')?0x6ABA2C:0x51516B)&&o.faceW===22&&o.faceH===22&&o.borderY===o.img&&o.faceY===o.img&&o.imgW===16&&o.shadow&&o.shadowW===12&&o.shadowH===3),JSON.stringify(drops));
  const positions=[];
  for(let i=0;i<7;i++){positions.push(await dropState());await page.waitForTimeout(150);}
  check('float moves square and icon together, integer 0..4 px, stable hitbox',positions.every(p=>p.every((o,i)=>o.x===drops[i].x&&o.y===drops[i].y&&o.borderY===o.img&&o.faceY===o.img&&Number.isInteger(o.img)&&o.img>=-4&&o.img<=0))&&drops.every((_,i)=>new Set(positions.map(p=>p[i].img)).size>=2));
  check('reference palette and opaque tree-node garden',await page.evaluate(()=>{const L=window.GardenGameLayout,s=window.__benchmarkGame.scene.getScene('Game'),g=L.spec.garden,t=s.textures.get('ui-test:garden-soil:'+g.cell),px=t.getContext().getImageData(4*g.pitch+3,4*g.pitch+3,1,1).data;const border=t.getContext().getImageData(4*g.pitch,4*g.pitch,1,1).data;return L.colors.field===0x0D0D0D&&L.colors.hud===0x161619&&L.colors.gardenSoil===0x343446&&L.colors.gardenSoilAlpha===1&&Array.from(px).join(',')==='52,52,70,255'&&Array.from(border).join(',')==='106,186,44,255'&&L.colors.progressTrack===0x545454&&L.colors.progressFill===0x6ABA2C&&L.colors.progressBorder===0x878796&&L.hud.barHeight===12&&L.hud.barWidth===158&&L.spec.top===32;}));

  // Resize the real browser viewport, then capture the actual canvas at 720p and 1080p.
  for(const [w,h] of viewportSizes){
    await page.setViewportSize({width:w,height:h});
    await page.waitForFunction(([w,h])=>{let s=window.__benchmarkGame.scene.getScene('Game');return s.scale.gameSize.width===w&&s.scale.gameSize.height===h&&Math.abs(s.cameras.main.zoom-w/960)<1e-6},[w,h],{timeout:8000});
    const m=await gameMetrics();inspectGame(m,w+'x'+h);observations.push(m);
    if(w===1280||w===1920){
      const png=await page.screenshot({path:join(out,c.id+'-'+w+'.png')});
      if(w===1920){
        const pixels=await page.evaluate(async ({data,hud,bp,stats,cost,slot})=>{
          const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob());
          const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
          const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
          const p=ctx.getImageData(0,0,cv.width,cv.height).data;
          const rgb=(x,y)=>Array.from(p.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3));
          const bounds=(x0,y0,x1,y1,predicate)=>{
            let a=Infinity,b=Infinity,c=-1,d=-1,n=0;
            for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(predicate(rgb(x,y))){
              a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);n++;
            }
            return {left:a,top:b,right:c,bottom:d,width:c-a+1,height:d-b+1,n};
          };
          const exact=(r,g,b)=>v=>v[0]===r&&v[1]===g&&v[2]===b;
          const ink=v=>Math.min(...v)>=145&&Math.max(...v)-Math.min(...v)<=5;
          const box=o=>bounds(Math.floor(o.x*2),Math.max(0,Math.floor(o.y*2)),Math.ceil((o.x+o.w)*2),Math.ceil((o.y+o.h)*2),ink);
          const label=box(hud.find(o=>o.text==='시간'));
          const time=box(hud.find(o=>o.text==='9999:59:59'));
          const title=bounds(bp.x*2,Math.floor(bp.y*2),Math.ceil((bp.x+40)*2),Math.ceil((bp.y+bp.header)*2),ink);
          const header=bounds(bp.x*2,64,(bp.x+bp.width)*2,Math.ceil((bp.y+bp.header)*2),exact(103,103,119));
          const grid=bounds(bp.x*2,Math.floor(bp.gridY*2),(bp.x+bp.width)*2,Math.ceil((bp.gridY+91)*2),exact(103,103,119));
          const seamY=bp.gridY*2, seamX=bp.x*2+8;
          const seam=[-1,0,1,2].map(d=>rgb(seamX,seamY+d));
          const costInk=box(cost), numberInk=stats.filter(t=>t.name.startsWith('stat-value:')).map(t=>({text:t.text,...box(t)}));
          const gemInk=bounds(slot.x*2+2,slot.y*2+2,(slot.x+slot.size)*2-2,Math.floor(cost.y*2),exact(170,170,170));
          const bar=bounds(1500,10,1920,54,exact(135,135,150));
          const dividers=bounds(0,10,1920,50,exact(32,32,32));
          const dividerRuns=[];
          for(let x=0;x<1920;x++){
            if(!exact(32,32,32)(rgb(x,12)))continue;
            let left=x;
            while(x+1<1920&&exact(32,32,32)(rgb(x+1,12)))x++;
            dividerRuns.push([left,x]);
          }
          return {image:[cv.width,cv.height],label,time,title,header,grid,bar,dividerRuns,seam,costInk,numberInk,gemInk,costVisibleGap:costInk.top-gemInk.bottom-1,
            leftPadding:label.left,rightPadding:cv.width-bar.right-1,
            timeGap:time.left-label.right-1,hudBottomGap:64-Math.max(label.bottom,time.bottom)-1,
            headerTopGap:header.top-64,titleLeftGap:title.left-header.left,titleTopGap:title.top-header.top,
            titleBottomGap:header.bottom-title.bottom,gridGap:grid.top-header.bottom-1};
        },{data:png.toString('base64'),hud:m.hud,bp:m.blueprint,stats:m.stats,cost:m.cost,slot:m.slots[9]});
        console.log('PIXEL_REPORT '+JSON.stringify(pixels));
        check('FHD right-aligned gauge and two left dividers',pixels.leftPadding===15&&pixels.rightPadding===pixels.leftPadding&&pixels.bar.width===316&&pixels.bar.height===24&&JSON.stringify(pixels.dividerRuns)===JSON.stringify([[324,327],[648,651]]),JSON.stringify(pixels));
        check('FHD slot cost and stat digits share visible baseline',pixels.costInk.n>0&&pixels.gemInk.n>0&&pixels.numberInk.every(t=>t.n>0&&Math.abs(t.bottom-pixels.costInk.bottom)<=1),JSON.stringify({cost:pixels.costInk,numbers:pixels.numberInk,gem:pixels.gemInk,gap:pixels.costVisibleGap}));
        check('FHD actual screenshot alignment and visible gaps',pixels.header.width===182&&pixels.grid.width===182&&pixels.header.left===pixels.grid.left&&pixels.header.left===pixels.label.left&&pixels.headerTopGap===15&&[pixels.titleLeftGap,pixels.titleTopGap,pixels.titleBottomGap].every(g=>g===10)&&pixels.gridGap===-2&&pixels.grid.height===182&&JSON.stringify(pixels.seam)===JSON.stringify([[68,68,92],[103,103,119],[103,103,119],[48,46,58]]),JSON.stringify(pixels));
      }
    }
  }
  await page.setViewportSize({width:960,height:540});await page.waitForFunction(()=>Math.abs(window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom-1)<1e-6);
  // Exercise the real input path: hover every item, equip, replace, reject locked, plant, toggle, pause/settings.
  const coords=async name=>page.evaluate(name=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName(name);return {x:o.x,y:o.y}},name);
  const move=async(x,y)=>{const b=await page.locator('canvas').boundingBox();await page.mouse.move(b.x+x,b.y+y);};
  const drag=async(name,x,y,release=true)=>{let a=await coords(name);await move(a.x,a.y);await page.mouse.down();const b=await page.locator('canvas').boundingBox();await page.mouse.move(b.x+x,b.y+y,{steps:8});if(release)await page.mouse.up();};
  const tip=async()=>page.evaluate(()=>{const s=window.__benchmarkGame.scene.getScene('Game'),t=s.children.getByName('item-preview-tooltip'),r=t.list[0];if(!t.visible||!r)return null;return {x:t.x,y:t.y,w:r.width,h:r.height,color:r.fillColor,stroke:r.strokeColor,header:t.list.find(o=>o.name==='item-tooltip-header')?.fillColor,rows:t.list.filter(o=>o.type==='Text').map(o=>({x:o.x,y:o.y,w:o.width,h:o.height,text:o.text,font:parseFloat(o.style.fontSize)}))};});
  let tips=[];
  const inspectTip=(t,key)=>{check(key+' tooltip bounds',!!t&&t.x>=c.margin-.5&&t.y>=c.top+c.margin-.5&&t.x+t.w<=960-c.margin+.5&&t.y+t.h<=540-c.bottom-8+.5,JSON.stringify(t));if(t){check(key+' tooltip colors and width',t.w===c.tipW&&t.color===0x313142&&t.stroke===0x676777&&t.header===0x43435B,JSON.stringify(t));check(key+' tooltip rows',t.rows.every((r,i)=>r.x>=c.tipPad-.5&&r.x+r.w<=t.w-c.tipPad+.5&&r.y>=c.tipPad-.5&&r.y+r.h<=t.h-c.tipPad+.5&&(!i||r.y>=t.rows[i-1].y+t.rows[i-1].h-.5)),JSON.stringify(t.rows));check(key+' tooltip all rows 10px',t.rows.length>0&&t.rows.every(r=>r.font===10),JSON.stringify(t.rows));tips.push(t);}};
  for(let i=0;i<5;i++){const a=await coords('placeholder:item:'+i);await move(a.x,a.y);await page.waitForTimeout(70);inspectTip(await tip(),'hover '+i);await move(5,200);}
  const slot=initial.slots[0],last=initial.slots[9];
  await drag('placeholder:item:0',slot.x+18,slot.y+18);
  check('equip',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible));
  await drag('placeholder:item:3',slot.x+18,slot.y+18,false);await page.waitForTimeout(100);inspectTip(await tip(),'replace');
  await page.screenshot({path:join(out,c.id+'-replace.png')});
  const delta=await gameMetrics();inspectGame(delta,'replacement stats');
  check('dragged item follows target',await page.evaluate(({x,y})=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName('placeholder:item:3'),ghost=s.children.getByName('item-preview-ghost');return Math.abs(o.x-x)<1&&Math.abs(o.y-y)<1&&Math.abs(o.alpha-.25)<.001&&ghost.visible&&Math.abs(ghost.x-x)<1&&Math.abs(ghost.y-y)<1;},{x:slot.x+18,y:slot.y+18}));
  check('dragging image centered and shadow hidden',await page.evaluate(()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:3');return o.list[2].y===0&&o.list[1].y===0&&!o.list[3].visible&&o.list[0].visible&&o.list[0].y===0&&o.list[1].visible&&o.list[1].fillColor===0x4F4F69;}));
  await page.mouse.up();
  check('equipped item keeps original slot frame',await page.evaluate(()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0');return o.visible&&o.list.length===3&&o.list[0].visible&&o.list[1].visible&&o.list[2].y===0;}));
  check('replace',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible&&!window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:3').visible));
  await drag('placeholder:item:1',last.x+18,last.y+18);
  check('locked reject',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').visible));
  // Wait for the next actual update frame after dragend, rather than a fixed wall-clock delay.
  const rejectedDropState=()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1');return o.visible&&o.depth===0&&o.list[3].visible&&o.list[0].visible&&o.list[1].visible&&o.list[1].fillColor===0x3B3B4E;};
  const resumed=await page.waitForFunction(rejectedDropState,{}, {timeout:3000}).then(()=>true,()=>false);
  check('rejected drop resumes float',resumed,JSON.stringify(await page.evaluate(()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1');return {visible:o.visible,depth:o.depth,shadow:o.list[3].visible,border:o.list[0].visible,face:o.list[1].visible,fillColor:o.list[1].fillColor};})));
  let g=initial.garden;await drag('placeholder:flower:0',g.x+4*g.pitch+12,g.y+3*g.pitch+12);
  check('plant',await page.evaluate(()=>!!window.__benchmarkGame.scene.getScene('Game').children.getByName('garden-preview-flower:34')));
  let b=initial.blueprint;await move(b.x+b.width/2,b.y+b.header/2);await page.mouse.click(b.x+b.width/2,b.y+b.header/2);
  check('blueprint toggle',await page.evaluate(()=>!window.__benchmarkGame.scene.getScene('Game').children.getByName('blueprint-body').visible));
  await page.mouse.click(b.x+b.width/2,b.y+b.header/2);
  check('blueprint reopens',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('blueprint-body').visible));
  await page.mouse.click(b.x+b.width/2,b.y+b.header/2);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Pause'));
  const frozen=await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').list[2].y);
  await page.waitForTimeout(250);
  check('pause freezes float',await page.evaluate(v=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').list[2].y===v,frozen));
  let pause=await menuMetrics('Pause');inspectMenu(pause,'Pause');
  await button('Pause','설정');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Settings'));inspectMenu(await menuMetrics('Settings'),'Settings');
  await button('Settings','사운드');check('settings audio',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Settings').activeTab==='audio'));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Pause'));
  await button('Pause','도감');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Codex'));inspectMenu(await menuMetrics('Codex'),'Codex');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Pause'));
  await button('Pause','메인 메뉴로');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Confirm'));inspectMenu(await menuMetrics('Confirm'),'Confirm');
  await button('Confirm','돌아가기');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('MainMenu'));
  await button('MainMenu','성공 화면');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Victory'));inspectMenu(await menuMetrics('Victory'),'Victory');
  await button('Victory','메인 메뉴');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('MainMenu'));await button('MainMenu','실패 화면');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Defeat'));inspectMenu(await menuMetrics('Defeat'),'Defeat');
  check('runtime errors',errors.length===0,errors.join('; '));
  check('tooltip gap and palette role contract',await page.evaluate(()=>{let L=window.GardenGameLayout,T=L.itemTooltip,p=L.tooltipPosition({x:400,y:200,size:24},T.width,100,L.spec.top+L.spec.fieldHeight);return T.width===L.hud.barWidth&&T.width===158&&T.gap===8&&p.x===420&&T.padding===6&&T.bottomPadding===14&&T.rowGap===5&&T.lineSpacing===4&&T.strokeWidth===1}));
  const locales=await page.evaluate(()=>window.GardenUI.hudLabels);
  const localeResults=[];
  for(const [lang, labels] of Object.entries(locales)){
    const missing=[...new Set(Object.values(labels).join(''))].filter(ch=>!font.hasGlyphForCodePoint(ch.codePointAt(0)));
    check(lang+' bundled font coverage',missing.length===0,JSON.stringify(missing));
    for(const [w,h] of [[960,540],[1600,900],[1920,1080]]){
      await page.setViewportSize({width:w,height:h});
      await page.goto(origin+'/'+c.id+'/index.html?lang='+lang+'&hud=stress',{waitUntil:'load'});
      await page.waitForFunction(()=>window.__benchmarkGame?.scene.isActive('MainMenu'),{},{timeout:20000});
      await button('MainMenu','새 게임');
      await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Game'));
      const m=await page.evaluate(()=>{
        const U=window.GardenUI,L=window.GardenGameLayout,s=window.__benchmarkGame.scene.getScene('Game');
        const labels=U.hudLabels[U.hudLanguage()], list=s.children.list.filter(o=>o.type==='Text'&&o.visible&&o.y<L.spec.top&&o.text);
        const r=o=>({text:o.text,x:o.x-o.displayOriginX,y:o.y-o.displayOriginY,w:o.width,h:o.height,color:o.style.color});
        const all=list.map(r), get=t=>all.find(o=>o.text===t);
        const clock=get(labels.time), kills=get(labels.kills), garden=get(labels.progress), time=get('9999:59:59'), percent=get('30%');
        const counts=all.filter(o=>o.text==='999,999,999,999').sort((a,b)=>a.x-b.x);
        const metricWidth=kills.x-clock.x, gemX=counts[1].x-L.hud.padding-L.hud.iconSize-L.hud.gap;
        const barX=percent.x+percent.w/2-L.hud.barWidth/2;
        const gaps=[time.x-clock.x-Math.ceil(clock.w),counts[0].x-kills.x-Math.ceil(kills.w),barX-garden.x-Math.ceil(garden.w)];
        return {lang:U.hudLanguage(),metricWidth,gemX,barX,gaps,all,labels,green:L.colors.progressFill===0x6ABA2C,top:L.spec.top};
      });
      const key=lang+' '+w+'x'+h;
      check(key+' labels and bounds',m.lang===lang&&m.all.length===7&&m.all.every(t=>t.x>=0&&t.y>=0&&t.x+t.w<=960.1&&t.y+t.h<=32.1),JSON.stringify(m));
      check(key+' equal widths and fixed gauge',m.metricWidth===initial.hudLayout.metricWidth&&m.gemX===2*m.metricWidth&&m.barX===794.5&&m.green,JSON.stringify(m));
      check(key+' gaps and no overlap',m.gaps.every(g=>Math.abs(g-5)<0.01)&&m.all.every((a,i)=>m.all.every((b,j)=>i===j||!overlap(a,b))),JSON.stringify(m));
      check(key+' reserved column containment',m.all.filter(t=>t.x<3*m.metricWidth).every(t=>t.x+t.w<=Math.ceil(t.x/m.metricWidth)*m.metricWidth-6.5)&&m.all.find(t=>t.text===m.labels.progress).x>=3*m.metricWidth,JSON.stringify(m));
      localeResults.push({lang,viewport:[w,h],width:m.metricWidth,barX:m.barX,gaps:m.gaps,labels:m.labels});
      if(w===1920)await page.screenshot({path:join(out,'hud-'+lang+'-1920.png')});
    }
  }
  const slotVariants=[];
  for(const size of [24,32]){
    await page.setViewportSize({width:960,height:540});
    await page.goto(origin+'/'+c.id+'/index.html?slots='+size+'&preview=1&hud=stress',{waitUntil:'load'});
    await page.waitForFunction(()=>window.__benchmarkGame?.scene.isActive('MainMenu'),{},{timeout:20000});
    await button('MainMenu','새 게임');
    await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Game'));
    const m=await gameMetrics(),slot=m.slots[0],last=m.slots[9],key='slots '+size;
    const detail=await page.evaluate(()=>{
      const L=window.GardenGameLayout,s=window.__benchmarkGame.scene.getScene('Game'),cost=s.children.getByName('slot-cost-value');
      const zones=s.children.list.filter(o=>o.name?.startsWith('preview-slot:')),cards=s.children.list.filter(o=>o.name?.startsWith('preview-equipped:')),ghost=s.children.getByName('item-preview-ghost');
      return {zones:zones.map(o=>[o.width,o.height,o.input.hitArea.width,o.input.hitArea.height]),cards:cards.map(o=>[o.width,o.height,o.list[1].width,o.list[2].displayWidth]),ghost:[ghost.width,ghost.height],costMasked:!!cost.mask,drop:L.assets.item.dropSize,bottom:L.spec.bottom};
    });
    check(key+' equal sizes, center and gap',m.slots.length===10&&m.slots.every((s,i)=>s.size===size&&s.y+s.size/2===518&&(!i||s.x-m.slots[i-1].x===size+3))&&m.slotWidth===10*size+27&&Math.abs(m.slotLeft+m.slotWidth/2-480)<=0.5&&m.side===210&&detail.bottom===44,JSON.stringify(m.slots));
    check(key+' matching hitboxes, cards, ghost and unchanged field drops',detail.zones.length===10&&detail.zones.every(a=>a.every(v=>v===size))&&detail.cards.length===10&&detail.cards.every(a=>a[0]===size&&a[1]===size&&a[2]===size-2&&a[3]===16)&&detail.ghost.every(v=>v===size)&&detail.drop===24,JSON.stringify(detail));
    check(key+' cost aligns with stat row',m.cost.font===8&&m.costSpec.gap===5&&m.stats.filter(t=>t.name.startsWith('stat-value:')).every(t=>t.y===m.cost.y&&t.h===m.cost.h)&&detail.costMasked===(size===24),JSON.stringify(m.cost));
    await page.setViewportSize({width:1920,height:1080});
    await page.waitForFunction(()=>window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===2);
    const screenshot=await page.screenshot({path:join(out,'slots-'+size+'-1920.png')});
    const pixel=await page.evaluate(async ({data,last,cost,stats})=>{
      const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob()), cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
      const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(0,0,cv.width,cv.height).data;
      const rgb=(x,y)=>Array.from(p.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3));
      const ink=v=>Math.min(...v)>=145&&Math.max(...v)-Math.min(...v)<=5;
      const scan=(x0,y0,x1,y1,pred)=>{let top=Infinity,bottom=-1,left=Infinity,right=-1,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pred(rgb(x,y))){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);n++;}return {top,bottom,left,right,n};};
      const number=scan(Math.floor(cost.x*2),Math.floor(cost.y*2),Math.ceil((cost.x+cost.w)*2),Math.ceil((cost.y+cost.h)*2),ink);
      const gem=scan(last.x*2+2,last.y*2+2,(last.x+last.size)*2-2,Math.floor(cost.y*2),v=>v.every(x=>x===170));
      const digitRows=stats.filter(t=>t.name.startsWith('stat-value:')).map(t=>scan(Math.floor(t.x*2),Math.floor(t.y*2),Math.ceil((t.x+t.w)*2),Math.ceil((t.y+t.h)*2),ink));
      const frame=Array.from({length:last.size*2},(_,i)=>rgb(last.x*2+i,(last.y+last.size)*2-1).join(',')).every(v=>v==='81,81,107');
      return {number,gem,digitRows,frame};
    },{data:screenshot.toString('base64'),last,cost:m.cost,stats:m.stats});
    check(key+' actual FHD digits, gem, intact bottom border',pixel.number.n>0&&pixel.gem.n>0&&pixel.digitRows.every(t=>t.top===pixel.number.top&&t.bottom===pixel.number.bottom)&&pixel.number.bottom<(last.y+size)*2-2&&pixel.gem.top>=last.y*2+2&&pixel.gem.bottom<pixel.number.top&&pixel.frame,JSON.stringify(pixel));
    await page.setViewportSize({width:960,height:540});await page.waitForFunction(()=>window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===1);
    await drag('placeholder:item:0',slot.x+size/2,slot.y+size/2);
    check(key+' equip',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible));
    await drag('placeholder:item:3',slot.x+size/2,slot.y+size/2,false);
    check(key+' snap ghost',await page.evaluate(({x,y})=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('item-preview-ghost');return o.visible&&o.x===x&&o.y===y;},{x:slot.x+size/2,y:slot.y+size/2}));
    await page.mouse.up();
    check(key+' replace',await page.evaluate(()=>!window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:3').visible));
    await drag('placeholder:item:1',last.x+size/2,last.y+size/2);
    check(key+' reject locked slot',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').visible));
    slotVariants.push({size,width:m.slotWidth,slot,detail,pixel});
  }
  console.log('SLOT_VARIANTS '+JSON.stringify(slotVariants));
  check('localized runtime errors',errors.length===0,errors.join('; '));
  results.push({id:c.id,name:c.name,localeResults,passed:checks.filter(x=>x.pass).length,total:checks.length,eligible:checks.every(x=>x.pass),fails:checks.filter(x=>!x.pass),ink:initial.ink,blueprintMetrics:initial.blueprintMetrics,hudLayout:initial.hudLayout,renderer:await page.evaluate(()=>window.__benchmarkGame.renderer.type),observations:observations.map(m=>({canvas:m.canvas,zoom:m.zoom}))});
 }catch(e){results.push({id:c.id,name:c.name,config:c,score:null,eligible:false,passed:checks.filter(x=>x.pass).length,total:checks.length,fails:[...checks.filter(x=>!x.pass),{name:'exception',detail:String(e)}],errors});}
 finally{await page.close();console.log('RESULT '+JSON.stringify(results.at(-1)));writeFileSync(join(out,'report.json'),JSON.stringify(results,null,2));}
}
await browser.close();server.close();
if(!results.every(r=>r.eligible))process.exitCode=1;

// Reference screenshot regression: actual browser render, not a human preference score.
