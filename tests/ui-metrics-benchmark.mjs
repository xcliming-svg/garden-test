import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const root = process.cwd(), out = resolve('benchmark-results');
mkdirSync(out, {recursive:true});
const require = createRequire(import.meta.url);
const phaserPath = require.resolve('phaser/dist/phaser.min.js');
const originals = Object.fromEntries(['ui.js','game-layout.js','scenes.js','main.js'].map(n=>[n,readFileSync(join(root,'src',n),'utf8').replace(/\r\n/g,'\n')]));
const base = {id:'A',name:'current',top:32,bottom:48,margin:12,label:10,value:10,timer:20,body:10,menu:10,navFont:20,navHeight:40,navGap:6,blueCell:8,bluePad:4,blueHead:24,slotGap:4,statLabel:10,statValue:10,statCol:72,statGap:4,hudGap:6,bar:12,tipW:192,tipPad:10,tipRow:4,tipLine:2,tipFont:10};
const candidate = (id,name,v) => ({...base,id,name,...v});
const configs = [
  base,
  candidate('B','compact/native',{top:30,bottom:42,margin:10,timer:20,navFont:16,navHeight:36,navGap:6,bluePad:4,blueHead:20,slotGap:3,statGap:3,hudGap:4,bar:12,tipW:176,tipPad:8,tipRow:3,tipLine:2}),
  candidate('C','balanced 12/14',{top:36,bottom:52,margin:12,label:10,value:14,timer:20,body:12,menu:12,navFont:18,navHeight:40,navGap:6,blueCell:10,bluePad:5,blueHead:24,slotGap:4,statLabel:10,statValue:14,statCol:76,statGap:4,hudGap:6,bar:14,tipW:208,tipPad:10,tipRow:4,tipLine:3,tipFont:12}),
  candidate('D','readable 12/16',{top:40,bottom:56,margin:14,label:12,value:16,timer:20,body:12,menu:14,navFont:20,navHeight:42,navGap:6,blueCell:10,bluePad:6,blueHead:26,slotGap:6,statLabel:12,statValue:16,statCol:76,statGap:4,hudGap:6,bar:16,tipW:224,tipPad:12,tipRow:5,tipLine:3,tipFont:12}),
  candidate('E','native hierarchy',{top:36,bottom:56,margin:12,label:10,value:10,timer:20,body:10,menu:10,navFont:20,navHeight:40,navGap:6,blueCell:10,bluePad:4,blueHead:24,slotGap:4,statLabel:10,statValue:20,statCol:82,statGap:3,hudGap:6,bar:14,tipW:208,tipPad:10,tipRow:4,tipLine:2,tipFont:10}),
  candidate('F','large text',{top:44,bottom:60,margin:16,label:14,value:16,timer:24,body:14,menu:14,navFont:20,navHeight:42,navGap:6,blueCell:12,bluePad:6,blueHead:28,slotGap:6,statLabel:12,statValue:16,statCol:80,statGap:5,hudGap:8,bar:18,tipW:240,tipPad:12,tipRow:6,tipLine:4,tipFont:14}),
  candidate('G','readable compact',{top:36,bottom:48,margin:12,label:12,value:16,timer:24,body:12,menu:12,navFont:20,navHeight:40,navGap:6,blueCell:8,bluePad:4,blueHead:24,slotGap:4,statLabel:12,statValue:16,statCol:76,statGap:4,hudGap:6,bar:16,tipW:208,tipPad:10,tipRow:4,tipLine:2,tipFont:12}),
  candidate('H','compact 12/14',{top:34,bottom:46,margin:12,label:12,value:14,timer:22,body:12,menu:12,navFont:20,navHeight:38,navGap:6,blueCell:8,bluePad:4,blueHead:22,slotGap:4,statLabel:12,statValue:16,statCol:74,statGap:3,hudGap:5,bar:14,tipW:208,tipPad:10,tipRow:4,tipLine:2,tipFont:12}),
  candidate('I','compact tooltip',{top:36,bottom:48,margin:10,label:12,value:14,timer:24,body:12,menu:12,navFont:18,navHeight:38,navGap:6,blueCell:8,bluePad:4,blueHead:22,slotGap:4,statLabel:12,statValue:16,statCol:74,statGap:3,hudGap:5,bar:14,tipW:192,tipPad:8,tipRow:3,tipLine:2,tipFont:12}),
  candidate('J','maximum field',{top:34,bottom:44,margin:10,label:12,value:14,timer:22,body:12,menu:12,navFont:20,navHeight:38,navGap:6,blueCell:8,bluePad:4,blueHead:22,slotGap:4,statLabel:12,statValue:16,statCol:74,statGap:3,hudGap:5,bar:14,tipW:192,tipPad:10,tipRow:4,tipLine:2,tipFont:12})
];
function replace(s,a,b) { if(!s.includes(a)) throw Error('missing source anchor: '+a); return s.replaceAll(a,b); }
// Shared transformation: used both by the experiment and --apply winner. Only size/spacing values.
function transform(c) {
  let u=originals['ui.js'], g=originals['game-layout.js'];
  const sub=(a,b)=>{u=replace(u,a,b)}, game=(a,b)=>{g=replace(g,a,b)};
  sub('base: 10, compact: 10, heading: 20, title: 40, timer: 20, menuBase: 10, menuAction: 20', `base: ${c.body}, compact: ${c.label}, heading: 20, title: 40, timer: ${c.timer}, menuBase: ${c.menu}, menuAction: ${c.navFont}`);
  sub('navHeight: 40, navGap: spacing.compact',`navHeight: ${c.navHeight}, navGap: ${c.navGap}`);
  game('const blueprintCell = unit, blueprintLine',`const blueprintCell = ${c.blueCell}, blueprintLine`);
  game('const blueprintPadding = spacing.small;',`const blueprintPadding = ${c.bluePad};`);
  game('const blueprintHeader = tile;',`const blueprintHeader = ${c.blueHead};`);
  game('const topHudHeight = tile + spacing.base;',`const topHudHeight = ${c.top};`);
  game('const bottomHudHeight = tile * 2;',`const bottomHudHeight = ${c.bottom};`);
  // Keep 24/16 and color definitions untouched.
  game('line: cellLine, gap: spacing.small, initial: 4',`line: cellLine, gap: ${c.slotGap}, initial: 4`);
  game('spacing.medium',String(c.margin));
  game('padding: '+c.margin+', gap: spacing.compact, labelSize: U.fontSize.compact, valueSize: U.fontSize.base, timeSize: U.fontSize.timer',`padding: ${c.margin}, gap: ${c.hudGap}, labelSize: ${c.label}, valueSize: ${c.value}, timeSize: ${c.timer}`);
  game('barHeight: 12, // 얇은 게이지, 외형 12px / 내부 10px',`barHeight: ${c.bar}, // 게이지 외형 높이 (내부는 2px 제외)`);
  game('fontSize: U.fontSize.compact, maxDigits: 3','fontSize: 10, maxDigits: 3');
  game('fontSize: U.fontSize.compact, valueSize: U.fontSize.base, columnWidth: tile * 3, columns: 3, lineGap: spacing.small',`fontSize: ${c.statLabel}, valueSize: ${c.statValue}, columnWidth: ${c.statCol}, columns: 3, lineGap: ${c.statGap}`);
  game('width: tile * 8, padding: spacing.inset, fontSize: U.fontSize.base,\n    rowGap: spacing.small, lineSpacing: spacing.micro',`width: ${c.tipW}, padding: ${c.tipPad}, fontSize: ${c.tipFont},\n    rowGap: ${c.tipRow}, lineSpacing: ${c.tipLine}`);
  game('// 32px HUD 안에서 상하 8px 여백을 두는 1×16px 구분선.', '// HUD 구분선: 1px 두께, 상하 8px 여백.');
  game('// 시간은 20px로 강조하고 다른 레이블/수치는 10px. 같은 행에서 중앙 정렬.', '// 시간은 강조 크기, 일반 레이블과 수치는 역할별 크기. 같은 행에서 중앙 정렬.');
  game('// 양쪽 바깥 12px부터 동일한 72px 열 3개.', '// 양쪽 바깥 여백에서 동일 폭 열 3개.');
  game('// 라벨과 값 행의 실제 바운딩 크기를 기준으로 4px 행 간격,','// 라벨과 값 행의 실제 바운딩 크기를 기준으로 지정 행 간격,');
  sub('// Fusion Pixel 10px 원본의 정수 배수만 일반 UI에 사용한다.','// Fusion Pixel 원본을 유지하고 가독성 비교 결과에 따라 역할별 크기를 지정한다.');
  return {'ui.js':u,'game-layout.js':g,'scenes.js':originals['scenes.js'],'main.js':originals['main.js']};
}
if(process.argv[2]==='--apply') {
  const c=configs.find(x=>x.id===process.argv[3]); if(!c)throw Error('unknown candidate');
  const files=transform(c);
  for(const n of ['ui.js','game-layout.js'])writeFileSync(join(root,'src',n),files[n]);
  console.log('Applied '+c.id);process.exit(0);
}
const variants=Object.fromEntries(configs.map(c=>[c.id,transform(c)]));
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
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const viewportSizes=[[640,360],[960,540],[1280,720],[1920,1080]];
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
    const textRect=o=>({name:o.name,text:o.text,x:o.x-o.displayOriginX,y:o.y-o.displayOriginY,w:o.width,h:o.height,font:parseFloat(o.style.fontSize),resolution:o.style.resolution});
    const visibleText=list.filter(o=>o.type==='Text'&&o.visible&&o.text).map(textRect);
    const hud=visibleText.filter(o=>o.y<L.spec.top&&o.y+o.h>0);
    const stats=visibleText.filter(o=>o.name?.startsWith('stat-'));
    const cost=visibleText.find(o=>o.text==='999');
    const context=document.createElement('canvas').getContext('2d');
    const ink=(size,text)=>{context.font=size+'px '+U.fontFamily;let m=context.measureText(text);return m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;};
    const blueprint=L.spec.blueprint,slot=bl.slots[9];
    const enemies=list.filter(o=>o.name?.startsWith('placeholder:'));
    return {zoom:s.cameras.main.zoom,canvas:[s.scale.gameSize.width,s.scale.gameSize.height],top:L.spec.top,bottom:L.spec.bottom,field:L.spec.fieldHeight,garden:L.spec.garden,blueprint,slots:bl.slots,slotGap:L.spec.slots.gap,stats,side:bl.sideWidth,sideLeft:bl.left,sideRight:bl.right,slotLeft:bl.slotLeft,slotWidth:bl.totalWidth,hud,cost,
      fixed:{garden:L.spec.garden.cell,slot:L.spec.slots.cell,slotOuter:L.spec.slots.size,flower:L.assets.flower.size,item:L.assets.item.size,card:L.assets.item.cardSize,line:L.spec.garden.line},
      markerOverflow:enemies.filter(o=>o.visible&&(o.y-(o.height||o.displayHeight)/2<L.spec.top||o.y+(o.height||o.displayHeight)/2>L.spec.top+L.spec.fieldHeight)).map(o=>o.name),
      ink:{label:ink(L.hud.labelSize,'정원 완성도'),value:ink(L.hud.valueSize,'999,999'),timer:ink(L.hud.timeSize,'00:00:00'),statLabel:ink(L.bottomStats.fontSize,'초당 피해량'),statValue:ink(L.bottomStats.valueSize,'100 +24'),tip:ink(L.itemTooltip.fontSize,'획득 범위가 증가합니다.'),menu:ink(U.fontSize.menuAction,'새 게임')},
      fontLoaded:document.fonts.check('10px '+U.fontFamily),tipFont:L.itemTooltip.fontSize
    };
  });
  const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.5;
  const inspectGame=(m,label)=>{
    const eps=0.6;
    check(label+' fixed sizes',JSON.stringify(m.fixed)===JSON.stringify({garden:24,slot:24,slotOuter:26,flower:16,item:16,card:26,line:1}));
    check(label+' HUD bounds',m.hud.length>=6&&m.hud.every(t=>t.x>=-eps&&t.y>=-eps&&t.x+t.w<=960+eps&&t.y+t.h<=m.top+eps),JSON.stringify(m.hud));
    check(label+' HUD nonoverlap',m.hud.every((a,i)=>m.hud.every((b,j)=>i===j||!overlap(a,b))));
    check(label+' stat bounds',m.stats.length>=12&&m.stats.every(t=>t.y>=540-m.bottom-eps&&t.y+t.h<=540+eps&&t.x>=-eps&&t.x+t.w<=960+eps),JSON.stringify(m.stats));
    check(label+' stat nonoverlap',m.stats.every((a,i)=>m.stats.every((b,j)=>i===j||!overlap(a,b))));
    check(label+' stats/slots separation',m.stats.every(t=>m.slots.every(b=>!overlap(t,{x:b.x,y:b.y,w:b.size,h:b.size}))));
    let cost=m.cost,b=m.slots[9];check(label+' cost bounds',!!cost&&cost.x>=b.x+1-eps&&cost.y>=b.y+1-eps&&cost.x+cost.w<=b.x+25+eps&&cost.y+cost.h<=b.y+25+eps,JSON.stringify(cost));
    // A dragged item intentionally follows the pointer into the HUD/slot. Only this specific card
    // is exempt during replacement; independently verify its exact target/alpha below.
    const overflow=m.markerOverflow.filter(n=>label!=='replacement stats'||n!=='placeholder:item:3');
    check(label+' field marker bounds',overflow.length===0,JSON.stringify(overflow));
    check(label+' font loaded',m.fontLoaded);
    check(label+' zoom',Math.abs(m.zoom-Math.min(m.canvas[0]/960,m.canvas[1]/540))<1e-6&&m.hud.every(t=>Math.abs(t.resolution-Math.max(1,m.zoom))<1e-6));
  };
  const initial=await gameMetrics();inspectGame(initial,'initial');
  // Resize the real browser viewport, then capture the actual canvas at 720p and 1080p.
  for(const [w,h] of viewportSizes){
    await page.setViewportSize({width:w,height:h});
    await page.waitForFunction(([w,h])=>{let s=window.__benchmarkGame.scene.getScene('Game');return s.scale.gameSize.width===w&&s.scale.gameSize.height===h&&Math.abs(s.cameras.main.zoom-w/960)<1e-6},[w,h],{timeout:8000});
    const m=await gameMetrics();inspectGame(m,w+'x'+h);observations.push(m);
    if(w===1280||w===1920)await page.screenshot({path:join(out,c.id+'-'+w+'.png')});
  }
  await page.setViewportSize({width:960,height:540});await page.waitForFunction(()=>Math.abs(window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom-1)<1e-6);
  // Exercise the real input path: hover every item, equip, replace, reject locked, plant, toggle, pause/settings.
  const coords=async name=>page.evaluate(name=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName(name);return {x:o.x,y:o.y}},name);
  const move=async(x,y)=>{const b=await page.locator('canvas').boundingBox();await page.mouse.move(b.x+x,b.y+y);};
  const drag=async(name,x,y,release=true)=>{let a=await coords(name);await move(a.x,a.y);await page.mouse.down();const b=await page.locator('canvas').boundingBox();await page.mouse.move(b.x+x,b.y+y,{steps:8});if(release)await page.mouse.up();};
  const tip=async()=>page.evaluate(()=>{const s=window.__benchmarkGame.scene.getScene('Game'),t=s.children.getByName('item-preview-tooltip'),r=t.list[0];if(!t.visible||!r)return null;return {x:t.x,y:t.y,w:r.width,h:r.height,rows:t.list.filter(o=>o.type==='Text').map(o=>({x:o.x,y:o.y,w:o.width,h:o.height,text:o.text}))};});
  let tips=[];
  const inspectTip=(t,key)=>{check(key+' tooltip bounds',!!t&&t.x>=c.margin-.5&&t.y>=c.top+c.margin-.5&&t.x+t.w<=960-c.margin+.5&&t.y+t.h<=540-c.bottom-8+.5,JSON.stringify(t));if(t){check(key+' tooltip rows',t.rows.every((r,i)=>r.x>=c.tipPad-.5&&r.x+r.w<=t.w-c.tipPad+.5&&r.y>=c.tipPad-.5&&r.y+r.h<=t.h-c.tipPad+.5&&(!i||r.y>=t.rows[i-1].y+t.rows[i-1].h-.5)),JSON.stringify(t.rows));tips.push(t);}};
  for(let i=0;i<5;i++){const a=await coords('placeholder:item:'+i);await move(a.x,a.y);await page.waitForTimeout(70);inspectTip(await tip(),'hover '+i);await move(5,200);}
  const slot=initial.slots[0],last=initial.slots[9];
  await drag('placeholder:item:0',slot.x+13,slot.y+13);
  check('equip',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible));
  await drag('placeholder:item:3',slot.x+13,slot.y+13,false);await page.waitForTimeout(100);inspectTip(await tip(),'replace');
  await page.screenshot({path:join(out,c.id+'-replace.png')});
  const delta=await gameMetrics();inspectGame(delta,'replacement stats');
  check('dragged item follows target',await page.evaluate(({x,y})=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName('placeholder:item:3'),ghost=s.children.getByName('item-preview-ghost');return Math.abs(o.x-x)<1&&Math.abs(o.y-y)<1&&Math.abs(o.alpha-.25)<.001&&ghost.visible&&Math.abs(ghost.x-x)<1&&Math.abs(ghost.y-y)<1;},{x:slot.x+13,y:slot.y+13}));
  await page.mouse.up();
  check('replace',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible&&!window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:3').visible));
  await drag('placeholder:item:1',last.x+13,last.y+13);
  check('locked reject',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').visible));
  let g=initial.garden;await drag('placeholder:flower:0',g.x+4*g.pitch+13,g.y+3*g.pitch+13);
  check('plant',await page.evaluate(()=>!!window.__benchmarkGame.scene.getScene('Game').children.getByName('garden-preview-flower:34')));
  let b=initial.blueprint;await move(b.x+b.width/2,b.y+b.header/2);await page.mouse.click(b.x+b.width/2,b.y+b.header/2);
  check('blueprint toggle',await page.evaluate(()=>!window.__benchmarkGame.scene.getScene('Game').children.getByName('blueprint-body').visible));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Pause'));
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
  // Scoring is explicitly heuristic, not a human preference survey.
  // Readability: actual ink heights on 1280x720, soft target 16 physical px.
  const readability=40*Object.entries({label:.15,value:.15,timer:.1,statLabel:.15,statValue:.15,tip:.2,menu:.1}).reduce((a,[k,w])=>a+w*clamp((initial.ink[k]*4/3-7)/9),0);
  // Space: retain central field, account for actual overlay area of largest tooltip.
  const fieldRatio=(960*initial.field-initial.blueprint.width*initial.blueprint.height)/(960*540);
  const tipRatio=Math.max(0,...tips.map(t=>t.w*t.h))/(960*540);
  const space=25*(.75*clamp((fieldRatio-.68)/.18)+.25*clamp((.22-tipRatio)/.18));
  // Spacing: sufficient but not excessive gap; measured menu internal height and stats/slot separation.
  const menuPadding=Math.min(...menu.buttons.filter(b=>b.h===c.navHeight).map(b=>b.py),...pause.buttons.map(b=>b.py));
  const statClear=initial.slotLeft-(initial.sideLeft+initial.side);
  const slotClear=(c.bottom-26)/2;
  const fit=(v,min,max)=>v<min?clamp(v/min):v>max?clamp(max/v):1;
  const spacing=20*(.20*fit(c.slotGap,3,6)+.20*fit(menuPadding,5,12)+.20*fit(c.tipPad,8,12)+.15*fit(c.tipRow,3,6)+.15*fit(slotClear,6,14)+.10*fit(statClear,20,100));
  const hierarchy=10*(.55*fit(initial.ink.timer/Math.max(1,initial.ink.label),1.5,2.5)+.45*fit(initial.ink.menu/Math.max(1,initial.ink.tip),1.3,2.2));
  // For measured edges only (not a claim of pixel-perfect rasterization). Equal weight each resolution.
  const dims=[c.top,c.bottom,c.margin,c.slotGap,c.blueCell,c.bluePad,c.blueHead,c.bar,c.tipW,c.tipPad,c.tipRow,c.navHeight,c.navGap,...initial.slots.flatMap(s=>[s.x,s.y,s.x+s.size,s.y+s.size])];
  const scale=5*observations.reduce((a,m)=>a+dims.filter(v=>Math.abs(v*m.zoom-Math.round(v*m.zoom))<1e-6).length/dims.length,0)/observations.length;
  const components={readability,space,spacing,hierarchy,scale};
  const score=Object.values(components).reduce((a,b)=>a+b,0);
  results.push({id:c.id,name:c.name,config:c,score,components,passed:checks.filter(x=>x.pass).length,total:checks.length,eligible:checks.every(x=>x.pass),fails:checks.filter(x=>!x.pass),ink:initial.ink,fieldRatio,tipRatio,menuPadding,statClear,renderer:await page.evaluate(()=>window.__benchmarkGame.renderer.type),observations:observations.map(m=>({canvas:m.canvas,zoom:m.zoom}))});
 }catch(e){results.push({id:c.id,name:c.name,config:c,score:null,eligible:false,passed:checks.filter(x=>x.pass).length,total:checks.length,fails:[...checks.filter(x=>!x.pass),{name:'exception',detail:String(e)}],errors});}
 finally{await page.close();console.log('RESULT '+JSON.stringify(results.at(-1)));writeFileSync(join(out,'report.json'),JSON.stringify(results,null,2));}
}
await browser.close();server.close();
const ranked=results.filter(r=>r.eligible).sort((a,b)=>b.score-a.score);
console.log('RANKING '+JSON.stringify(ranked.map(r=>({id:r.id,score:r.score}))));
if(!ranked.length)process.exitCode=1;
