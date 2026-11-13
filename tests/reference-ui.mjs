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
const configs=[{id:'R',name:'screenshot-matched UI',top:32,bottom:40,margin:10,label:12,value:12,timer:12,body:12,menu:12,navFont:14,navHeight:24,navGap:3,blueCell:8,bluePad:5,blueHead:19,slotGap:3,statLabel:8,statValue:8,statCol:70,statGap:3,hudGap:5,bar:12,tipW:158,tipPad:5,tipRow:5,tipLine:4,tipFont:10}];
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
    const s=window.__benchmarkGame.scene.getScene(key), list=s.children.list,U=window.GardenUI,z=s.cameras.main.zoom;
    const buttons=list.filter(o=>o.type==='Container'&&o.list?.length===2&&o.list[0].pixelBox&&o.list[1].type==='Text').map(o=>{let [r,t]=o.list;return {text:t.text,x:o.x-r.width/2,y:o.y-r.height/2,w:r.width,h:r.height,px:(r.width-t.width)/2,py:(r.height-t.height)/2,font:parseFloat(t.style.fontSize),fill:r.fillColor,color:t.style.color,res:t.style.resolution,tx:o.x+t.x-t.displayOriginX,ty:o.y+t.y-t.displayOriginY,tw:t.width,th:t.height}});
    const texts=list.filter(o=>o.type==='Text'&&o.visible).map(o=>({text:o.text,x:o.x-o.displayOriginX,y:o.y-o.displayOriginY,w:o.width,h:o.height,font:parseFloat(o.style.fontSize),res:o.style.resolution,color:o.style.color}));
    const panels=list.filter(o=>o.pixelBox&&o.width<960&&o.height>100).map(o=>({x:o.x-o.width/2,y:o.y-o.height/2,w:o.width,h:o.height,stroke:o.strokeColor}));
    const h=s.children.getByName('menu-panel-header');
    return {buttons,texts,panels,zoom:z,header:h?{x:h.x-h.width/2,y:h.y-h.height/2,w:h.width,h:h.height,fill:h.fillColor}:null};
  },key);
  function inspectMenu(m,key){
    const within=o=>o.x>=-0.5&&o.y>=-0.5&&o.x+o.w<=960.5&&o.y+o.h<=540.5;
    const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>0.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>0.5;
    check(key+' button bounds',m.buttons.every(o=>within(o)&&o.px>=2&&o.py>=2),JSON.stringify(m.buttons.filter(o=>!within(o)||o.px<2||o.py<2)));
    check(key+' text bounds',m.texts.every(within));
    const panelSizes={Pause:[240,242],Settings:[480,320],Codex:[480,320],Confirm:[300,150],Victory:[480,280],Defeat:[480,280]};
    const expectedWidth=b=>key==='MainMenu'?(['성공 화면','실패 화면'].includes(b.text)?168:200):key==='Pause'||key==='Victory'||key==='Defeat'?200:key==='Settings'&&b.text!=='돌아가기'?454/3:110;
    check(key+' documented logical button and panel sizes',m.buttons.every(b=>Math.abs(b.w-expectedWidth(b))<1e-6&&b.h===24)&&(!panelSizes[key]||m.panels.some(p=>p.w===panelSizes[key][0]&&p.h===panelSizes[key][1]))&&(key!=='Codex'||m.panels.some(p=>p.w===460&&p.h===160)),JSON.stringify(m));
    if(key==='MainMenu'||key==='Pause'){
      const nav=m.buttons.filter(b=>b.w===200).sort((a,b)=>a.y-b.y);
      check(key+' 3px navigation gaps',nav.length===5&&nav.every((b,i)=>!i||b.y-nav[i-1].y-nav[i-1].h===3),JSON.stringify(nav));
    }
    check(key+' role font sizes',m.buttons.every(b=>b.font===((b.text==='새 게임'||b.text==='계속하기')?14:12)),JSON.stringify(m.buttons));
    if(m.header){check(key+' common 32px header and 18px title',m.header.h===32&&m.texts.some(t=>t.font===18&&t.y>=m.header.y&&t.y+t.h<=m.header.y+m.header.h+1),JSON.stringify(m));}
    if(key==='Victory'||key==='Defeat')check(key+' readable neutral title and semantic result frame',m.texts.some(t=>t.text===(key==='Victory'?'성공':'실패')&&t.color.toLowerCase()==='#ffffff')&&m.panels[0]?.stroke===(key==='Victory'?0x6ABA2C:0xF46C7C),JSON.stringify(m));
    if(key==='Settings'){const tabs=m.buttons.filter(b=>b.text!=='돌아가기').sort((a,b)=>a.x-b.x);check(key+' full content width and 3px tab gaps',tabs.length===3&&Math.abs(tabs[0].x-250)<1e-6&&Math.abs(tabs[2].x+tabs[2].w-710)<1e-6&&tabs.slice(1).every((t,i)=>Math.abs(t.x-tabs[i].x-tabs[i].w-3)<1e-6),JSON.stringify(tabs));}
    if(['Confirm','Victory','Defeat'].includes(key)){const pair=[...m.buttons].sort((a,b)=>a.x-b.x);check(key+' 3px footer action gap',pair.length===2&&Math.abs(pair[1].x-pair[0].x-pair[0].w-3)<1e-6,JSON.stringify(pair));}
    check(key+' button/text nonoverlap',m.buttons.every((b,i)=>m.buttons.every((q,j)=>i===j||!overlap(b,q))&&m.texts.every(t=>!overlap(b,t))),JSON.stringify(m.buttons.flatMap(b=>m.texts.filter(t=>overlap(b,t)).map(t=>[b.text,t.text]))));
    if(key==='Pause'||key==='Settings'||key==='Codex'||key==='Confirm'||key==='Victory'||key==='Defeat'){
      const panel=m.panels[0];check(key+' panel contains buttons',!!panel&&m.buttons.every(b=>b.x>=panel.x&&b.y>=panel.y&&b.x+b.w<=panel.x+panel.w&&b.y+b.h<=panel.y+panel.h));
    }
  }
  // Actual native-output menu screenshots, not only logical boxes.
  const menuAudit=async(key,suffix=key)=>{
    for(const [w,h] of viewportSizes){
      await page.setViewportSize({width:w,height:h});
      await page.waitForFunction(({key,w})=>Math.abs(window.__benchmarkGame.scene.getScene(key).cameras.main.zoom-w/960)<1e-6,{key,w},{timeout:8000});
      await page.waitForTimeout(80);
      const m=await menuMetrics(key);inspectMenu(m,key);
      const png=await page.screenshot({path:join(out,'menu-'+suffix+'-'+w+'.png')});
      const pixels=await page.evaluate(async ({data,m})=>{
        const img=await createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob()),cv=document.createElement('canvas');
        cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
        const p=ctx.getImageData(0,0,cv.width,cv.height).data,z=m.zoom,R=Math.round;
        const maxColor=c=>Math.max((c>>16)&255,(c>>8)&255,c&255);
        const rgb=(x,y)=>Array.from(p.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3));
        const buttons=m.buttons.map(b=>{
          const left=R(b.x*z),right=R((b.x+b.w)*z),top=R(b.y*z),bottom=R((b.y+b.h)*z);
          const bg=maxColor(b.fill),fg=maxColor(parseInt(b.color.slice(1),16)),threshold=Math.ceil(bg+(fg-bg)*0.25);
          let x0=Infinity,x1=-1,y0=Infinity,y1=-1,n=0;
          for(let y=Math.max(top+1,R(b.ty*z));y<Math.min(bottom-1,R(b.ty*z)+Math.ceil(b.th*z));y++)for(let x=Math.max(left+1,R(b.tx*z));x<Math.min(right-1,R(b.tx*z)+Math.ceil(b.tw*z));x++){
            if(Math.max(...rgb(x,y))<threshold)continue;
            x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);n++;
          }
          return {text:b.text,n,xCenter:(x0+x1+1-left-right)/2,yCenter:(y0+y1+1-top-bottom)/2};
        });
        let header=null;
        if(m.header){const h=m.header,x=R((h.x+3)*z),start=R(h.y*z),end=R((h.y+h.h)*z),color=[(h.fill>>16)&255,(h.fill>>8)&255,h.fill&255].join(',');
          const rows=[];for(let y=start-1;y<=end;y++)if(rgb(x,y).join(',')===color)rows.push(y);
          header={actual:rows.length,expected:end-start};
        }
        return {buttons,header};
      },{data:png.toString('base64'),m});
      check(suffix+' '+w+' menu native text resolution',m.texts.concat(m.buttons).every(t=>Math.abs(t.res-w/960)<1e-6));
      check(suffix+' '+w+' actual centered button glyphs',pixels.buttons.every(b=>b.n>0&&Math.abs(b.xCenter)<=1.5&&Math.abs(b.yCenter)<=1.5),JSON.stringify(pixels));
      if(pixels.header)check(suffix+' '+w+' actual 32px header',pixels.header.actual===pixels.header.expected,JSON.stringify(pixels.header));
      if(w===960)console.log('MENU_CONSISTENCY '+suffix+' '+JSON.stringify({m,pixels}));
    }
    await page.setViewportSize({width:960,height:540});await page.waitForFunction(key=>window.__benchmarkGame.scene.getScene(key).cameras.main.zoom===1,key);
  };
  let menu=await menuMetrics('MainMenu');inspectMenu(menu,'MainMenu');
  await menuAudit('MainMenu');
  await page.screenshot({path:join(out,c.id+'-menu.png')});
  await button('MainMenu','새 게임');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Game'));
  // Actual Phaser object dimensions / text bounding boxes and Canvas font metrics.
  const gameMetrics=async()=>page.evaluate(()=>{
    const L=window.GardenGameLayout,U=window.GardenUI,s=window.__benchmarkGame.scene.getScene('Game'),bl=L.bottomLayout(), list=s.children.list;
    const textRect=o=>({name:o.name,text:o.text,x:o.x-o.displayOriginX,y:o.y-o.displayOriginY,w:o.width,h:o.height,font:parseFloat(o.style.fontSize),color:o.style.color,resolution:o.style.resolution,frame:[o.frame.width,o.frame.height],buffer:[o.canvas.width,o.canvas.height],uv:[o.frame.u1,o.frame.v1]});
    const visibleText=list.filter(o=>o.type==='Text'&&o.visible&&o.text).map(textRect);
    const hud=visibleText.filter(o=>o.y<L.spec.top&&o.y+o.h>0);
    const clock=hud.find(o=>o.text==='시간'), kills=hud.find(o=>o.text==='처치 수'), gardenLabel=hud.find(o=>o.text==='정원 완성도');
    const gemValue=hud.filter(o=>o.text==='999,999,999,999').sort((a,b)=>a.x-b.x).at(-1);
    const metricWidth=kills.x-clock.x;
    const timeValue=hud.find(o=>o.text==='9999:59:59'), percent=hud.find(o=>o.text==='30%');
    const z=s.cameras.main.zoom,glyphEdge=o=>{const t=list.find(t=>t.type==='Text'&&t.text===o.text&&Math.abs(t.x-t.displayOriginX-o.x)<.01);const b=U.inkBounds(t,L.colors.hud),x=Math.round(o.x*z);return {left:x+b.left,right:x+b.right};};
    const timeGap=(glyphEdge(timeValue).left-glyphEdge(clock).right)/z;
    const barGap=(Math.round((percent.x+percent.w/2-L.hud.barWidth/2)*z)-glyphEdge(gardenLabel).right)/z;
    const hudLayout={metricWidth,timeGap,barGap,leftPadding:clock.x,rightPadding:L.spec.width-(percent.x+percent.w/2+L.hud.barWidth/2),textPadTop:clock.y,textPadBottom:L.spec.top-2-clock.y-clock.h,barHeight:L.hud.barHeight,gemX:s.children.getByName('hud-gem-icon').x-L.hud.padding,progressX:gardenLabel.x-L.hud.padding,centerY:L.hud.centerY,labelColors:[clock.color,kills.color,gardenLabel.color],valueColors:hud.filter(o=>!['시간','처치 수','정원 완성도'].includes(o.text)).map(o=>o.color)};
    const stats=visibleText.filter(o=>o.name?.startsWith('stat-'));
    const cost=visibleText.find(o=>o.text==='999');
    const context=document.createElement('canvas').getContext('2d');
    const ink=(size,text)=>{context.font=size+'px '+U.fontFamily;let m=context.measureText(text);return m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;};
    const blueprint=L.spec.blueprint,slot=bl.slots[9];
    const title=visibleText.find(o=>o.name==='blueprint-title'), toggle=s.children.getByName('blueprint-toggle');
    const hudBottom=L.spec.top-Math.max(clock.y+clock.h,timeValue.y+timeValue.h);
    const blueprintMetrics={topGap:blueprint.y-L.spec.top,hudBottom,roundedHudBottom:Math.round(hudBottom),titlePadX:title.x-blueprint.x,titlePadTop:title.y-blueprint.y,titlePadBottom:blueprint.y+blueprint.header-title.y-title.h,titleHeight:title.h,titleFont:title.font,titleColor:title.color,gridGap:blueprint.gridY-blueprint.y-blueprint.header,gridX:blueprint.gridX,headerX:toggle.x-toggle.width/2,width:toggle.width,height:toggle.height};
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
    check(label+' fixed sizes',JSON.stringify(m.fixed)===JSON.stringify({garden:22,slot:30,slotOuter:32,flower:16,item:16,card:32,line:1}));
    check(label+' HUD bounds',m.hud.length>=6&&m.hud.every(t=>t.x>=-eps&&t.y>=-eps&&t.x+t.w<=960+eps&&t.y+t.h<=m.top+eps),JSON.stringify(m.hud));
    const bp=m.blueprintMetrics;
    check(label+' blueprint alignment and visible HUD spacing',bp.width===93&&bp.gridX===bp.headerX&&bp.headerX===m.hudLayout.leftPadding&&bp.titlePadX===5&&bp.gridGap===3&&m.blueprint.gap===3&&bp.titleFont===10&&bp.titleColor.toLowerCase()==='#b0acbd'&&m.blueprint.cell===8&&m.blueprint.line===1&&m.blueprint.width===93&&m.blueprint.height===m.blueprint.header+3+93&&bp.height===19&&bp.topGap===m.hudLayout.textPadTop,JSON.stringify(bp));
    check(label+' HUD nonoverlap',m.hud.every((a,i)=>m.hud.every((b,j)=>i===j||!overlap(a,b))));
    check(label+' equal HUD widths, center and labels',m.top===32&&m.hudLayout.centerY===15&&m.hudLayout.leftPadding===7.5&&m.hudLayout.rightPadding===7.5&&m.hudLayout.textPadTop===7.5&&m.hudLayout.textPadBottom===7.5&&m.hudLayout.barHeight===12&&Math.abs(m.hudLayout.timeGap*m.zoom-Math.round(5*m.zoom))<0.01&&Math.abs(m.hudLayout.barGap*m.zoom-Math.round(5*m.zoom))<0.01&&m.hudLayout.metricWidth>0&&Math.abs(m.hudLayout.gemX-2*m.hudLayout.metricWidth)<=1/m.zoom&&3*m.hudLayout.metricWidth<=m.hudLayout.progressX&&m.hudLayout.labelColors.every(c=>c.toLowerCase()==='#b0acbd')&&m.hudLayout.valueColors.every(c=>c.toLowerCase()==='#ffffff'),JSON.stringify(m.hudLayout));
    check(label+' bottom HUD 40px and equal 3px clear gaps',m.bottom===40&&m.field===468&&m.slotWidth===347&&m.slots.every((s,i)=>s.y-(540-m.bottom+2)===3&&540-(s.y+s.size)===3&&(!i||s.x-m.slots[i-1].x-m.slots[i-1].size===3)),JSON.stringify(m.slots));
    check(label+' stat bounds',m.stats.length>=12&&m.stats.every(t=>t.font===8&&t.y>=540-m.bottom-eps&&t.y+t.h<=540+eps&&t.x>=-eps&&t.x+t.w<=960+eps),JSON.stringify(m.stats));
    const statGroups=['defense','hp','luck','moveSpeed','pickupRange','dps'].map((key,i)=>{const a=m.stats.find(t=>t.name==='stat-label:'+key), v=m.stats.find(t=>t.name==='stat-value:'+key),d=m.stats.find(t=>t.name==='stat-delta:'+key);const center=(i<3?m.sideLeft:m.sideRight)+(i%3+0.5)*70;const left=Math.min(v.x,d?.x??v.x),right=Math.max(v.x+v.w,d?d.x+d.w:v.x+v.w);return !!a&&!!v&&Math.abs(a.x+a.w/2-center)<0.01&&Math.abs((left+right)/2-center)<0.01&&left>=center-35&&right<=center+35&&a.x>=center-35&&a.x+a.w<=center+35&&(!d||Math.abs(d.x-v.x-v.w-2)<0.01);});
    check(label+' 70px columns, 3px visible row gap specification and horizontal centering',m.side===210&&m.statSpec.columnWidth===70&&m.statSpec.lineGap===3&&statGroups.every(Boolean),JSON.stringify(m.stats));
    // Transparent glyph padding may overlap vertically; the actual screenshot verifies visible rows.
    check(label+' stat nonoverlap across columns',m.stats.every((a,i)=>m.stats.every((b,j)=>i===j||a.name.split(':')[1]===b.name.split(':')[1]||!overlap(a,b))));
    check(label+' stats/slots separation',m.stats.every(t=>m.slots.every(b=>!overlap(t,{x:b.x,y:b.y,w:b.size,h:b.size}))));
    let cost=m.cost,b=m.slots[9];check(label+' cost bounds',!!cost&&cost.font===8&&m.costSpec.gap===3&&Math.abs(cost.x+cost.w/2-(b.x+b.size/2))<0.01&&cost.x>=b.x+1-eps&&cost.y>=b.y+1-eps&&cost.x+cost.w<=b.x+b.size-1+eps&&cost.y+cost.h<=b.y+b.size-1+eps,JSON.stringify(cost));
    // A dragged item intentionally follows the pointer into the HUD/slot. Only this specific card
    // is exempt during replacement; independently verify its exact target/alpha below.
    const overflow=m.markerOverflow.filter(n=>label!=='replacement stats'||n!=='placeholder:item:3');
    check(label+' field marker bounds',overflow.length===0,JSON.stringify(overflow));
    check(label+' font loaded',m.fontLoaded);
    check(label+' zoom',Math.abs(m.zoom-Math.min(m.canvas[0]/960,m.canvas[1]/540))<1e-6&&[...m.hud,...m.stats,m.cost].every(t=>Math.abs(t.resolution-m.zoom)<1e-6&&t.frame[0]===t.buffer[0]&&t.frame[1]===t.buffer[1]&&t.uv.every(v=>v===1)));
  };
  const initial=await gameMetrics();inspectGame(initial,'initial');
  const gardenAudit=async()=>page.evaluate(()=>{
    const L=window.GardenGameLayout,g=L.spec.garden,s=window.__benchmarkGame.scene.getScene('Game');
    const occupied=new Set(s.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:')).map(o=>Number(o.name.split(':').at(-1))));
    const visible=new Set([...occupied,...L.gardenCandidates(occupied)]),tex=s.textures.get('ui-test:garden-soil:'+g.cell),ctx=tex.getContext();
    const w=g.columns*g.pitch+g.line,h=g.rows*g.pitch+g.line;
    const pixels=ctx.getImageData(0,0,w,h).data;
    const expected=(set,x,y)=>{
      // Independently classify every cell's cut-corner square.
      let value=0;
      for(const key of set){
        const a=x-key%g.columns*g.pitch,b=y-Math.floor(key/g.columns)*g.pitch;
        if(a>=0&&a<g.outer&&b>=0&&b<g.outer){
          const edgeX=a===0||a===g.outer-1,edgeY=b===0||b===g.outer-1;
          if(!(edgeX&&edgeY))value=Math.max(value,edgeX||edgeY?2:1);
        }
      }
      return value;
    };
    const layouts=[visible,new Set([0]),new Set([0,1,10,11]),new Set([0,11,99]),new Set(Array.from({length:100},(_,i)=>i))];
    const coverage=layouts.map(set=>{
      const counts=new Uint8Array(w*h),kind=new Uint8Array(w*h);
      let outOfBounds=0;
      for(const r of L.gardenGridRects(set))for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
        if(x<0||x>=w||y<0||y>=h){outOfBounds++;continue;}
        counts[y*w+x]++;kind[y*w+x]=r.border?2:1;
      }
      let mismatch=0,overdraw=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(counts[i]>1)overdraw++;if(kind[i]!==expected(set,x,y))mismatch++;}
      return {cells:set.size,mismatch,overdraw,outOfBounds};
    });
    const nativeCoverage=[2/3,1,4/3,5/3,2,25/12].flatMap(z=>layouts.map(set=>{
      const r=L.gardenRaster(set,g,z),counts=new Uint8Array(r.width*r.height);
      let overdraw=0,outOfBounds=0;
      for(const a of r.rects)for(let y=a.y;y<a.y+a.h;y++)for(let x=a.x;x<a.x+a.w;x++){
        if(x<0||x>=r.width||y<0||y>=r.height){outOfBounds++;continue;}
        if(++counts[y*r.width+x]>1)overdraw++;
      }
      let cornerOverdraw=0;
      for(let row=0;row<=g.rows;row++)for(let col=0;col<=g.columns;col++){
        const a=Math.round((g.x+col*g.pitch)*z)-r.x,b=Math.round((g.y+row*g.pitch)*z)-r.y;
        const endX=Math.max(a+1,Math.round((g.x+col*g.pitch+g.line)*z)-r.x),endY=Math.max(b+1,Math.round((g.y+row*g.pitch+g.line)*z)-r.y);
        for(let y=b;y<endY;y++)for(let x=a;x<endX;x++)if(counts[y*r.width+x])cornerOverdraw++;
      }
      return {z,cells:set.size,overdraw,outOfBounds,cornerOverdraw};
    }));
    let textureMismatch=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const type=expected(visible,x,y),i=(y*w+x)*4,v=Array.from(pixels.slice(i,i+4)).join(',');
      if(v!==(type===2?'81,81,107,255':type===1?'59,59,78,255':'0,0,0,0'))textureMismatch++;
    }
    const center=key=>({x:g.x+key%g.columns*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(key/g.columns)*g.pitch+g.line+g.cell/2});
    const centers=[...occupied].every(key=>{const o=s.children.getByName('garden-preview-flower:'+key),p=center(key);return o.x===p.x&&o.y===p.y;});
    const hit=Array.from({length:100},(_,key)=>{const p=center(key);return L.gardenHit(p.x,p.y)===key;}).every(Boolean)
      &&L.gardenHit(g.x+g.pitch,g.y+2)===1&&L.gardenHit(g.x+2,g.y+g.pitch)===10
      &&L.gardenHit(g.x+w-0.5,g.y+h-0.5)===99&&L.gardenHit(g.x+w,g.y+h-0.5)===-1&&L.gardenHit(g.x-0.1,g.y)===-1;
    return {g,texture:[tex.getSourceImage().width,tex.getSourceImage().height],occupied:[...occupied],visible:visible.size,coverage,nativeCoverage,textureMismatch,centers,hit};
  });
  const inspectGarden=async(label,cell=22)=>{
    const a=await gardenAudit(),outer=cell+2,pitch=cell+1,size=10*pitch+1;
    check(label+' garden shared geometry',a.g.cell===cell&&a.g.outer===outer&&a.g.pitch===pitch&&a.g.size===size&&a.g.line===1&&a.texture.every(v=>v===size)&&a.centers&&a.hit,JSON.stringify(a));
    check(label+' garden each pixel drawn once and correct texture',a.coverage.every(v=>v.mismatch===0&&v.overdraw===0&&v.outOfBounds===0)&&a.nativeCoverage.every(v=>v.overdraw===0&&v.outOfBounds===0&&v.cornerOverdraw===0)&&a.textureMismatch===0,JSON.stringify(a));
    console.log('GARDEN_GRID '+label+' '+JSON.stringify(a));
    return a;
  };
  await inspectGarden('initial');
  const captureGardenSeams=async(browserPage,png,g,z)=>browserPage.evaluate(async ({data,g,z})=>{
    const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob()),cv=document.createElement('canvas');
    cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
    const p=ctx.getImageData(0,0,cv.width,cv.height).data,R=Math.round;
    const rgb=(x,y)=>Array.from(p.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3)).join(',');
    const green='106,186,44',face='59,59,78',slate='81,81,107';
    const x=(g.x+5*g.pitch)*z,y=(g.y+5*g.pitch)*z;
    // Scan the shared lines in an unoccupied strip, away from the 16px flower icons.
    const scan=(vertical,at,fixed)=>{
      const lo=Math.floor(at)-3,hi=Math.ceil(at+z)+3,values=[];
      for(let v=lo;v<=hi;v++)values.push(rgb(vertical?v:fixed,vertical?fixed:v));
      const hits=values.map((v,i)=>v===green?i:-1).filter(v=>v>=0),idleHits=values.map((v,i)=>v===slate?i:-1).filter(v=>v>=0);
      const width=hits.length,contiguous=width>0&&hits.at(-1)-hits[0]+1===width;
      return {width,contiguous,idleWidth:idleHits.length,idleContiguous:idleHits.length>0&&idleHits.at(-1)-idleHits[0]+1===idleHits.length,idleFlanks:idleHits.length>0&&values[idleHits[0]-1]===face&&values[idleHits.at(-1)+1]===face,flanks:width>0&&values[hits[0]-1]===face&&values[hits.at(-1)+1]===face,values};
    };
    const corners=[[4,4],[5,4],[6,4],[4,5],[5,5],[6,5],[4,6],[5,6],[6,6]].map(([col,row])=>{
      const px=R((g.x+col*g.pitch)*z),py=R((g.y+row*g.pitch)*z);
      const right=Math.max(px+1,R((g.x+col*g.pitch+g.line)*z)),bottom=Math.max(py+1,R((g.y+row*g.pitch+g.line)*z));
      const values=[];for(let y=py;y<bottom;y++)for(let x=px;x<right;x++)values.push(rgb(x,y));
      return {col,row,w:right-px,h:bottom-py,clear:values.every(v=>v==='13,13,13'),values};
    });
    return {vertical:scan(true,x,R((g.y+4*g.pitch+3)*z)),horizontal:scan(false,y,R((g.x+4*g.pitch+3)*z)),candidateVertical:scan(true,x,R((g.y+3*g.pitch+3)*z)),candidateHorizontal:scan(false,(g.y+4*g.pitch)*z,R((g.x+5*g.pitch+3)*z)),corners,expected:z};
  },{data:png.toString('base64'),g,z});
  const idleSeam=(v,z)=>v.idleContiguous&&v.idleFlanks&&v.idleWidth>=1&&(Number.isInteger(z)?v.idleWidth===z:v.idleWidth<=Math.ceil(z));
  const validSeams=(a,z)=>[a.vertical,a.horizontal,a.candidateVertical,a.candidateHorizontal].every(v=>idleSeam(v,z))&&a.corners.every(v=>v.clear&&v.w>=1&&v.h>=1&&(Number.isInteger(z)?v.w===z&&v.h===z:v.w<=Math.ceil(z)&&v.h<=Math.ceil(z)));
  const activeSeams=(a,z)=>[a.candidateVertical,a.candidateHorizontal].every(v=>v.contiguous&&v.flanks&&v.width>=1&&(Number.isInteger(z)?v.width===z:v.width<=Math.ceil(z)));

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
  check('all eight drops have 24px flower or 32px item frames, 16px icons and matching hit boxes',drops.length===8&&drops.every(o=>o.w===(o.name.includes(':flower:')?24:32)&&o.h===o.w&&o.hitW===o.w&&o.hitH===o.w&&o.border&&o.face&&o.faceColor===0x3B3B4E&&o.borderColor===0x51516B&&o.faceW===o.w-2&&o.faceH===o.h-2&&o.borderY===o.img&&o.faceY===o.img&&o.imgW===16&&o.shadow&&o.shadowW===12&&o.shadowH===3),JSON.stringify(drops));
  const positions=[];
  for(let i=0;i<7;i++){positions.push(await dropState());await page.waitForTimeout(150);}
  check('float moves square and icon together, integer 0..4 px, stable hitbox',positions.every(p=>p.every((o,i)=>o.x===drops[i].x&&o.y===drops[i].y&&o.borderY===o.img&&o.faceY===o.img&&Number.isInteger(o.img)&&o.img>=-4&&o.img<=0))&&drops.every((_,i)=>new Set(positions.map(p=>p[i].img)).size>=2));
  check('Garden 16 exactly 16 shared game colors and semantic roles',await page.evaluate(()=>{
    const P=window.GardenPalette,R=P.reference,L=window.GardenGameLayout,U=window.GardenUI;
    const expected=['#0D0D0D','#161619','#3B3B4E','#44445C','#51516B','#676777','#B0ACBD','#FFFFFF','#7C4C24','#A46444','#E9D0AB','#F4B404','#F46C7C','#6ABA2C','#0C9484','#67A3EE'];
    return Object.values(P.hex).length===16&&new Set(Object.values(P.hex)).size===16&&expected.every(c=>Object.values(P.hex).includes(c))&&R.baseHex===P.hex&&Object.values(R.hex).every(c=>expected.includes(c))&&
      U.C.button===L.colors.normalFill&&U.C.muted===L.colors.hudLabel&&L.colors.label===L.colors.hudLabel&&
      U.C.panelAlt===R.n.selected&&U.C.subtle===U.C.border&&L.colors.progressBorder===U.C.border&&
      L.colors.progressTrack===L.colors.disabledFill&&R.n.hudLight===R.n.gridLine&&L.colors.blueprintLine===R.n.gridLine;
  }));
  check('all displayed sample sprites use Garden 16, preserve source alpha and actual textures',await page.evaluate(()=>{
    const P=window.GardenPalette,S=window.GardenTestSprites,allowed=new Set(Object.values(P.hex).map(c=>c.toLowerCase().slice(1)));
    return [...S.flowers.flatMap(name=>[12,16].map(size=>[name,size])),['snail',12],['snail',16],['wheelbarrow',16]].every(([name,size])=>{
      const original=S.pixelData(name,size,true),current=S.pixelData(name,size,false),display=S.pixelData(name,size);
      if(!display.every((v,i)=>v===current[i]))return false;
      const tex=window.__benchmarkGame.scene.getScene('Game').textures.get(S.textureKey(name,size));
      const cv=document.createElement('canvas');cv.width=size;cv.height=size;const ctx=cv.getContext('2d');
      const im=ctx.createImageData(size,size);im.data.set(current);ctx.putImageData(im,0,0);
      const rendered=tex.getContext().getImageData(0,0,size,size).data,expected=ctx.getImageData(0,0,size,size).data;
      if(!rendered.every((v,i)=>v===expected[i]))return false;
      for(let i=0;i<current.length;i+=4){
        if(current[i+3]!==original[i+3])return false;
        if(current[i+3]&&!allowed.has(Array.from(current.slice(i,i+3)).map(v=>v.toString(16).padStart(2,'0')).join('')))return false;
      }
      return true;
    });
  }));
  check('reference palette and opaque tree-node garden',await page.evaluate(()=>{const L=window.GardenGameLayout,s=window.__benchmarkGame.scene.getScene('Game'),g=L.spec.garden,t=s.textures.get('ui-test:garden-soil:'+g.cell),px=t.getContext().getImageData(4*g.pitch+3,4*g.pitch+3,1,1).data;const border=t.getContext().getImageData(4*g.pitch+3,4*g.pitch,1,1).data;return L.colors.field===0x0D0D0D&&L.colors.hud===0x161619&&L.colors.gardenSoil===0x3B3B4E&&L.colors.gridFill===L.colors.normalFill&&L.colors.normalFill===L.colors.gardenSoil&&L.itemTooltip.background===L.colors.normalFill&&L.colors.gardenSoilAlpha===1&&Array.from(px).join(',')==='59,59,78,255'&&Array.from(border).join(',')==='81,81,107,255'&&L.colors.progressTrack===0x161619&&L.colors.progressFill===0x6ABA2C&&L.colors.progressBorder===0x676777&&L.hud.barHeight===12&&L.hud.barWidth===158&&L.spec.top===32;}));

  const captureHudGaps=async(png,all,z,labels)=>{
    return page.evaluate(async ({data,all,z,labels})=>{
      const img=await createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob()),cv=document.createElement('canvas');
      cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
      const p=ctx.getImageData(0,0,cv.width,cv.height).data,R=Math.round;
      const scan=(x0,y0,x1,y1,pred)=>{let left=Infinity,right=-1,n=0;for(let y=Math.max(0,y0);y<Math.min(cv.height,y1);y++)for(let x=Math.max(0,x0);x<Math.min(cv.width,x1);x++){const i=(y*cv.width+x)*4;if(pred(p[i],p[i+1],p[i+2])){left=Math.min(left,x);right=Math.max(right,x);n++;}}return {left,right,n};};
      const box=o=>{const f=parseInt(o.color.slice(1),16),fg=Math.max((f>>16)&255,(f>>8)&255,f&255),threshold=Math.ceil(25+(fg-25)*.25),x=R(o.x*z),y=R(o.y*z);return scan(x,y,x+Math.ceil(o.w*z),y+Math.ceil(o.h*z),(r,g,b)=>Math.max(r,g,b)>=threshold);};
      const get=t=>all.find(o=>o.text===t),clock=get(labels.time),kills=get(labels.kills),progress=get(labels.progress),time=all.find(o=>o.text.includes(':'));
      const values=all.filter(o=>/^\d[\d,]*$/.test(o.text)).sort((a,b)=>a.x-b.x);
      const gem=scan(R((kills.x-clock.x)*2*z),0,R(((kills.x-clock.x)*2+7.5+14+1)*z),R(30*z),(r,g,b)=>r===176&&g===172&&b===189);
      const edges={clock:box(clock),time:box(time),kills:box(kills),count:box(values[0]),gem,gems:box(values[1]),progress:box(progress)};
      return {edges,gaps:[edges.time.left-edges.clock.right-1,edges.count.left-edges.kills.right-1,edges.gems.left-edges.gem.right-1,R(794.5*z)-edges.progress.right-1]};
    },{data:png.toString('base64'),all,z,labels});
  };
  // Resize the real browser viewport, then capture the actual canvas at 720p and 1080p.
  for(const [w,h] of viewportSizes){
    await page.setViewportSize({width:w,height:h});
    await page.waitForFunction(([w,h])=>{let s=window.__benchmarkGame.scene.getScene('Game');return s.scale.gameSize.width===w&&s.scale.gameSize.height===h&&Math.abs(s.cameras.main.zoom-w/960)<1e-6},[w,h],{timeout:8000});
    const m=await gameMetrics();inspectGame(m,w+'x'+h);observations.push(m);
    // Inspect real output pixels at every viewport, not transparent text object bounds.
    const bottomPng=await page.screenshot({path:join(out,'scale-'+w+'x'+h+'.png')});
    const seams=await captureGardenSeams(page,bottomPng,m.garden,m.zoom);
    check(w+' garden idle slate lines match ordinary slots and cut corners',validSeams(seams,m.zoom),JSON.stringify(seams));
    console.log('GARDEN_SEAMS '+w+' '+JSON.stringify(seams));
    const hudPixels=await captureHudGaps(bottomPng,m.hud,m.zoom,{time:'시간',kills:'처치 수',progress:'정원 완성도'});
    check(w+' actual visible HUD 5px gaps',Object.values(hudPixels.edges).every(e=>e.n>0)&&hudPixels.gaps.every(g=>g===Math.round(5*m.zoom)),JSON.stringify(hudPixels));
    console.log('HUD_VISIBLE '+w+' '+JSON.stringify(hudPixels));
    const bottomPixels=await page.evaluate(async ({data,stats,cost,slot,z})=>{
      const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob()), cv=document.createElement('canvas');
      cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
      const p=ctx.getImageData(0,0,cv.width,cv.height).data;
      const scan=(x0,y0,x1,y1,pred)=>{let top=Infinity,bottom=-1,n=0;for(let y=Math.max(0,Math.floor(y0));y<Math.min(cv.height,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(cv.width,Math.ceil(x1));x++){const i=(y*cv.width+x)*4;if(pred(p[i],p[i+1],p[i+2])){top=Math.min(top,y);bottom=Math.max(bottom,y);n++;}}return {top,bottom,n};};
      const inkFor=(o,bg)=>{const fg=parseInt(o.color.slice(1),16),f=Math.max((fg>>16)&255,(fg>>8)&255,fg&255);const threshold=Math.ceil(bg+(f-bg)*0.25);return (r,g,b)=>Math.max(r,g,b)>=threshold;};
      // Upper and lower text canvases may overlap in their transparent padding.
      // Split the scan at the empty space, not at object rectangle edges.
      const split=Math.round((slot.y+slot.size/2+1.5)*z);
      const box=(o,upper,bg=25)=>scan(o.x*z,upper?o.y*z:Math.max(split,o.y*z),(o.x+o.w)*z,upper?Math.min(split,(o.y+o.h)*z):(o.y+o.h)*z,inkFor(o,bg));
      const number=box(cost,false,25);
      const gemLeft=Math.round((slot.x+(slot.size-8)/2)*z),gemRight=gemLeft+Math.max(1,Math.round(8*z));
      const gem=scan(gemLeft,Math.round((slot.y+1)*z),gemRight,split,(r,g,b)=>r===176&&g===172&&b===189);
      return {number,gem,labels:stats.filter(t=>t.name.startsWith('stat-label:')).map(t=>box(t,true)),values:stats.filter(t=>t.name.startsWith('stat-value:')).map(t=>box(t,false))};
    },{data:bottomPng.toString('base64'),stats:m.stats,cost:m.cost,slot:m.slots[9],z:m.zoom});
    const expectedGap=Math.round(3*m.zoom);
    check(w+'x'+h+' actual visible bottom 3px gaps and alignment',bottomPixels.number.n>0&&bottomPixels.gem.n>0&&bottomPixels.number.top-bottomPixels.gem.bottom-1===expectedGap&&bottomPixels.labels.every(t=>t.n>0&&t.bottom===bottomPixels.gem.bottom)&&bottomPixels.values.every(t=>t.n>0&&t.top===bottomPixels.number.top&&Math.abs(t.bottom-bottomPixels.number.bottom)<=1),JSON.stringify(bottomPixels));
    console.log('BOTTOM_PIXELS '+w+' '+JSON.stringify(bottomPixels));
    // Geometric pixel runs are independent of glyph metrics: exact snapped outer edges,
    // including 10 slots, both blueprint rectangles, HUD strips and progress frame.
    const geometry=await page.evaluate(async ({data,m})=>{
      const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob()), cv=document.createElement('canvas');
      cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
      const p=ctx.getImageData(0,0,cv.width,cv.height).data,z=m.zoom,R=Math.round;
      const rgb=(x,y)=>Array.from(p.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3)).join(',');
      const runs=(start,end,pred)=>{const a=[];let i=start;while(i<end){if(!pred(i)){i++;continue;}const first=i;while(i<end&&pred(i))i++;a.push([first,i]);}return a;};
      const hud='22,22,25',field='13,13,13',bp=m.blueprint,first=m.slots[0],last=m.slots.at(-1);
      const any=(start,end,pred)=>{for(let i=start;i<end;i++)if(pred(i))return true;return false;};
      const slotRuns=runs(R((first.x-2)*z),R((last.x+last.size+2)*z),x=>any(R(first.y*z),R((first.y+first.size)*z),y=>rgb(x,y)!==hud));
      const slotY=runs(R((first.y-2)*z),R((first.y+first.size+2)*z),y=>any(R(first.x*z),R((first.x+first.size)*z),x=>rgb(x,y)!==hud));
      // 도안 외형 높이는 행 전체 투영으로 검사한다.
      const bpY=runs(R((bp.y-2)*z),R((bp.gridY+bp.width+2)*z),y=>any(R(bp.x*z),R((bp.x+bp.width)*z),x=>rgb(x,y)!==field));
      const bpX=[[bp.y,bp.header],[bp.gridY,bp.width]].map(([y,h])=>runs(R((bp.x-2)*z),R((bp.x+bp.width+2)*z),x=>any(R(y*z),R((y+h)*z),py=>rgb(x,py)!==field)));
      const barX=960-7.5-158,barY=15-6;
      const gaugeX=runs(R((barX-1)*z),cv.width,x=>any(R(barY*z),R((barY+12)*z),y=>rgb(x,y)!==hud));
      const gaugeY=runs(R((barY-2)*z),R((barY+14)*z),y=>any(R(barX*z),R((barX+158)*z),x=>rgb(x,y)!==hud));
      const topY=runs(0,R(40*z),y=>rgb(0,y)!==field);
      const bottomY=runs(R(490*z),cv.height,y=>rgb(0,y)!==field);
      const pair=(x,w)=>[R(x*z),R((x+w)*z)];
      const expected={slotRuns:m.slots.map(s=>pair(s.x,s.size)),slotY:[pair(first.y,first.size)],bpY:[pair(bp.y,bp.header),pair(bp.gridY,bp.width)],bpX:[[pair(bp.x,bp.width)],[pair(bp.x,bp.width)]],gaugeX:[pair(barX,158)],gaugeY:[pair(barY,12)],topY:[[0,R(m.top*z)]],bottomY:[[R((540-m.bottom)*z),cv.height]]};
      const actual={slotRuns,slotY,bpY,bpX,gaugeX,gaugeY,topY,bottomY};
      const near=(a,b)=>Array.isArray(a)?Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>near(v,b[i])):Math.abs(a-b)<=1;
      return {actual,expected,checks:Object.fromEntries(Object.keys(expected).map(k=>[k,near(actual[k],expected[k])]))};
    },{data:bottomPng.toString('base64'),m});
    for(const [key,pass] of Object.entries(geometry.checks))check(w+'x'+h+' physical '+key,pass,JSON.stringify({actual:geometry.actual[key],expected:geometry.expected[key]}));
    console.log('GEOMETRY_REPORT '+w+' '+JSON.stringify(geometry));
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
          const ink=v=>Math.max(...v)>=Math.ceil(92+(189-92)*.25);
          const box=o=>{const f=parseInt(o.color.slice(1),16),fg=Math.max((f>>16)&255,(f>>8)&255,f&255),threshold=Math.ceil(25+(fg-25)*.25);return bounds(Math.floor(o.x*2),Math.max(0,Math.floor(o.y*2)),Math.ceil((o.x+o.w)*2),Math.ceil((o.y+o.h)*2),v=>Math.max(...v)>=threshold);};
          const label=box(hud.find(o=>o.text==='시간'));
          const time=box(hud.find(o=>o.text==='9999:59:59'));
          const killsLabel=box(hud.find(o=>o.text==='처치 수'));
          const counters=hud.filter(o=>o.text==='999,999,999,999').sort((a,b)=>a.x-b.x).map(box);
          const gem=bounds(648,0,701,60,v=>v.join(',')==='176,172,189');
          const progressLabel=box(hud.find(o=>o.text==='정원 완성도'));
          const title=bounds(bp.x*2+2,Math.floor(bp.y*2)+2,Math.ceil((bp.x+40)*2),Math.ceil((bp.y+bp.header)*2)-2,ink);
          const header=bounds(bp.x*2,64,(bp.x+bp.width)*2,Math.ceil((bp.y+bp.header)*2),exact(59,59,78));
          const grid=bounds(bp.x*2,Math.floor(bp.gridY*2),(bp.x+bp.width)*2,Math.ceil((bp.gridY+bp.width)*2),exact(59,59,78));
          const seamY=bp.gridY*2, seamX=bp.x*2+8;
          const seam=Array.from({length:10},(_,i)=>rgb(seamX,seamY-8+i));
          const split=Math.round((slot.y+slot.size/2+1.5)*2);
          const statBox=(o,upper,bg=25)=>{const f=parseInt(o.color.slice(1),16),fg=Math.max((f>>16)&255,(f>>8)&255,f&255),threshold=Math.ceil(bg+(fg-bg)*0.25);return bounds(Math.floor(o.x*2),upper?Math.floor(o.y*2):Math.max(split,Math.floor(o.y*2)),Math.ceil((o.x+o.w)*2),upper?Math.min(split,Math.ceil((o.y+o.h)*2)):Math.ceil((o.y+o.h)*2),v=>Math.max(...v)>=threshold);};
          const costInk=statBox(cost,false,25), numberInk=stats.filter(t=>t.name.startsWith('stat-value:')).map(t=>({text:t.text,...statBox(t,false)}));
          const labelInk=stats.filter(t=>t.name.startsWith('stat-label:')).map(t=>({text:t.text,...statBox(t,true)}));
          const gemInk=bounds(slot.x*2+2,slot.y*2+2,(slot.x+slot.size)*2-2,split,exact(176,172,189));
          const bar=bounds(1500,10,1920,54,exact(103,103,119));
          const blueprintCorners=[header,grid].flatMap(o=>[rgb(o.left,o.top),rgb(o.right,o.top),rgb(o.left,o.bottom),rgb(o.right,o.bottom)]);
          const blueprintBorders=[bp.y,bp.gridY].map(y=>Array.from({length:4},(_,i)=>rgb(bp.x*2+20,y*2+i).join(',')));
          const corners={bar:[rgb(bar.left,bar.top),rgb(bar.right,bar.top),rgb(bar.left,bar.bottom),rgb(bar.right,bar.bottom)],slot:[rgb(slot.x*2,slot.y*2),rgb((slot.x+slot.size)*2-1,slot.y*2),rgb(slot.x*2,(slot.y+slot.size)*2-1),rgb((slot.x+slot.size)*2-1,(slot.y+slot.size)*2-1)]};
          const dividers=bounds(0,10,1920,50,exact(13,13,13));
          const dividerRuns=[];
          for(let x=0;x<1920;x++){
            if(!exact(13,13,13)(rgb(x,12)))continue;
            let left=x;
            while(x+1<1920&&exact(13,13,13)(rgb(x+1,12)))x++;
            dividerRuns.push([left,x]);
          }
          return {image:[cv.width,cv.height],label,time,title,header,grid,bar,dividerRuns,seam,blueprintCorners,blueprintBorders,costInk,numberInk,labelInk,gemInk,corners,costVisibleGap:costInk.top-gemInk.bottom-1,
            leftPadding:label.left,rightPadding:cv.width-bar.right-1,visibleHudGaps:{time:time.left-label.right-1,kills:counters[0].left-killsLabel.right-1,gem:gem.n?counters[1].left-gem.right-1:null,progress:bar.left-progressLabel.right-1},
            timeGap:time.left-label.right-1,hudBottomGap:64-Math.max(label.bottom,time.bottom)-1,
            headerTopGap:header.top-64,titleLeftGap:title.left-header.left,titleTopGap:title.top-header.top,
            titleBottomGap:header.bottom-title.bottom,gridGap:grid.top-header.bottom-1};
        },{data:png.toString('base64'),hud:m.hud,bp:m.blueprint,stats:m.stats,cost:m.cost,slot:m.slots[9]});
        console.log('PIXEL_REPORT '+JSON.stringify(pixels));
        check('FHD right-aligned gauge and two left dividers',pixels.leftPadding===15&&pixels.rightPadding===pixels.leftPadding&&pixels.bar.width===316&&pixels.bar.height===24&&JSON.stringify(pixels.dividerRuns)===JSON.stringify([[324,327],[648,651]]),JSON.stringify(pixels));
        check('FHD one logical pixel cut corners on gauge and slot',Object.values(pixels.corners).flat().every(v=>v.join(',')==='22,22,25'),JSON.stringify(pixels.corners));
        check('FHD 3px visible gap and shared stat/cost row edges',pixels.costInk.n>0&&pixels.gemInk.n>0&&pixels.costVisibleGap===6&&pixels.numberInk.every(t=>t.n>0&&t.top===pixels.costInk.top&&t.bottom===pixels.costInk.bottom)&&pixels.labelInk.every(t=>t.n>0&&t.bottom===pixels.gemInk.bottom),JSON.stringify({cost:pixels.costInk,numbers:pixels.numberInk,labels:pixels.labelInk,gem:pixels.gemInk,gap:pixels.costVisibleGap}));
        check('FHD blueprint independent cut corners',pixels.blueprintCorners.every(v=>v.join(',')==='13,13,13'),JSON.stringify(pixels.blueprintCorners));
        check('FHD blueprint matches HUD double border',pixels.blueprintBorders.every(v=>v.join('|')==='59,59,78|59,59,78|81,81,107|81,81,107'),JSON.stringify(pixels.blueprintBorders));
        check('FHD actual screenshot alignment and visible gaps',pixels.header.width===186&&pixels.grid.width===186&&pixels.header.left===pixels.grid.left&&pixels.header.left===pixels.label.left&&pixels.headerTopGap===15&&[pixels.titleLeftGap,pixels.titleTopGap,pixels.titleBottomGap].every(g=>g===10)&&pixels.gridGap===6&&pixels.grid.height===186&&JSON.stringify(pixels.seam)===JSON.stringify([[59,59,78],[59,59,78],...Array(6).fill([13,13,13]),[59,59,78],[59,59,78]]),JSON.stringify(pixels));
      }
    }
  }
  await page.setViewportSize({width:960,height:540});await page.waitForFunction(()=>Math.abs(window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom-1)<1e-6);
  // Exercise the real input path: hover every item, equip, replace, reject locked, plant, toggle, pause/settings.
  const coords=async name=>page.evaluate(name=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName(name);return {x:o.x,y:o.y}},name);
  const move=async(x,y)=>{const b=await page.locator('canvas').boundingBox();await page.mouse.move(b.x+x,b.y+y);};
  const drag=async(name,x,y,release=true)=>{let a=await coords(name);await move(a.x,a.y);await page.mouse.down();const b=await page.locator('canvas').boundingBox();await page.mouse.move(b.x+x,b.y+y,{steps:8});if(release)await page.mouse.up();};
  const tip=async()=>page.evaluate(()=>{const s=window.__benchmarkGame.scene.getScene('Game'),t=s.children.getByName('item-preview-tooltip'),r=t.list[0];if(!t.visible||!r)return null;return {x:t.x,y:t.y,w:r.width,h:r.height,color:r.fillColor,stroke:r.strokeColor,header:t.list.find(o=>o.name==='item-tooltip-header')?.fillColor,headerHeight:t.list.find(o=>o.name==='item-tooltip-header')?.height+1,zoom:s.cameras.main.zoom,divider:!!t.getByName('item-tooltip-divider'),rows:t.list.filter(o=>o.type==='Text').map(o=>({x:o.x,y:o.y,w:o.width,h:o.height,text:o.text,color:o.style.color,font:parseFloat(o.style.fontSize)}))};});
  let tips=[];
  const inspectTip=(t,key,isSlot=false)=>{check(key+' tooltip bounds',!!t&&t.x>=c.margin-.5&&t.y>=c.top+c.margin-.5&&t.x+t.w<=960-c.margin+.5&&t.y+t.h<=540-c.bottom-(isSlot?0:8)+.5,JSON.stringify(t));if(t){check(key+' tooltip colors and width',t.w===c.tipW&&t.color===0x3B3B4E&&t.stroke===0x51516B&&t.header===0x44445C&&!t.divider&&t.rows[1]?.color.toLowerCase()==='#b0acbd',JSON.stringify(t));check(key+' tooltip rows',t.rows.every((r,i)=>r.x>=1&&r.x+r.w<=t.w+1&&r.y>=1&&r.y+r.h<=t.h+1&&(!i||r.y>t.rows[i-1].y)),JSON.stringify(t.rows));check(key+' tooltip all rows 10px',t.rows.length>0&&t.rows.every(r=>r.font===10),JSON.stringify(t.rows));tips.push(t);}};
  const captureTipPixels=async(t,png)=>page.evaluate(async ({data,t})=>{
    const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob()),cv=document.createElement('canvas');
    cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
    const px=ctx.getImageData(0,0,cv.width,cv.height).data,z=t.zoom,R=Math.round;
    const x0=R(t.x*z),y0=R(t.y*z),x1=R((t.x+t.w)*z),y1=R((t.y+t.h)*z),headerEnd=R((t.y+t.headerHeight)*z);
    const rgb=(x,y)=>Array.from(px.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3));
    const edges=t.rows.map((r,i)=>{
      const bg=i===0?92:78,fg=parseInt(r.color.slice(1),16),f=Math.max((fg>>16)&255,(fg>>8)&255,fg&255),threshold=Math.ceil(bg+(f-bg)*0.25);
      let left=Infinity,right=-1,top=Infinity,bottom=-1,n=0,exact=0;
      const startX=R((t.x+r.x)*z),startY=R((t.y+r.y)*z);
      for(let y=Math.max(startY,y0+1);y<Math.min(y1-1,startY+Math.ceil(r.h*z));y++)for(let x=Math.max(startX,x0+1);x<Math.min(x1-1,startX+Math.ceil(r.w*z));x++){
        const v=rgb(x,y);if(Math.max(...v)<threshold)continue;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);n++;
        if(v.join(',')==='176,172,189')exact++;
      }
      return {text:r.text,left:left-x0,right:x1-right-1,top:top-y0,bottom:y1-bottom-1,n,exact,inkBottom:bottom-y0};
    });
    let divider=0;for(let x=x0+R(6*z);x<x1-R(6*z);x++)if(rgb(x,y1-R(9*z)).join(',')==='75,75,80')divider++;
    return {edges,divider,headerHeight:headerEnd-y0,headerColor:rgb(x1-R(3*z),y0+R(3*z)),bodyColor:rgb(x1-R(3*z),y1-R(3*z))};
  },{data:png.toString('base64'),t});
  // Measure the rendered outermost card/tooltip pixels, not just object positions.
  const captureTipGap=async(browserPage,png,t,a,side,size=32)=>browserPage.evaluate(async ({data,t,a,side,size})=>{
    const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob());
    const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
    const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
    const px=ctx.getImageData(0,0,cv.width,cv.height).data,z=t.zoom,R=Math.round;
    const vertical=side==='above',fixed=R((vertical?a.x:a.y)*z);
    const rgb=v=>{const x=vertical?fixed:v,y=vertical?v:fixed,i=(y*cv.width+x)*4;return (px[i]<<16)|(px[i+1]<<8)|px[i+2];};
    const cardColors=[0x67A3EE,0x3B3B4E],tipColors=[0x51516B,0x44445C,0x3B3B4E];
    const edge=(expected,colors,high,limit=Infinity)=>{
      // Prefer the border itself; when a subpixel border vanishes, use its fill.
      // In the vertical case exclude the separate HUD boundary, which shares the panel fill.
      const hits=[];for(let v=expected-1;v<=expected+1&&v<=limit;v++)if(colors.includes(rgb(v)))hits.push(v);
      const borders=hits.filter(v=>rgb(v)===colors[0]),matches=borders.length?borders:hits;
      return matches.length?(high?Math.max(...matches):Math.min(...matches)):null;
    };
    let start,end;
    if(side==='right'){
      start=edge(R((a.x+size/2)*z)-1,cardColors,true);
      end=edge(R(t.x*z),tipColors,false);
    }else if(side==='left'){
      start=edge(R((t.x+t.w)*z)-1,tipColors,true);
      end=edge(R((a.x-size/2)*z),cardColors,false);
    }else{
      const fieldBottom=window.GardenGameLayout.spec.top+window.GardenGameLayout.spec.fieldHeight;
      start=edge(R((t.y+t.h)*z)-1,tipColors,true,R(fieldBottom*z)-1);
      end=edge(R((a.y-size/2)*z),cardColors,false);
    }
    const logical=side==='right'?t.x-a.x-size/2:side==='left'?a.x-size/2-t.x-t.w:a.y-size/2-t.y-t.h;
    return {side,start,end,gap:start===null||end===null?null:end-start-1,logical,expected:R(5*z),tolerance:Number.isInteger(z)?0:1};
  },{data:png.toString('base64'),t,a,side,size});
  const validTipGap=p=>!!p&&p.gap!==null&&Math.abs(p.logical-5)<1e-6&&Math.abs(p.gap-p.expected)<=p.tolerance;
  const exactTipPadding=(p,z)=>{
    const gap=Math.round(5*z),tol=Number.isInteger(z)?0:1,near=(a,b)=>Math.abs(a-b)<=tol;
    return p.edges.every(e=>e.n>0&&near(e.left,gap)&&e.right>=gap-tol)&&near(p.edges[0].top,gap)&&near(p.edges.at(-1).bottom,gap)&&near(p.headerHeight-p.edges[0].inkBottom-1,gap)&&near(p.edges[1].top-p.headerHeight,gap)&&p.edges.slice(2).every((e,i)=>near(e.top-p.edges[i+1].inkBottom-1,gap));
  };
  for(let i=0;i<5;i++){
    const a=await coords('placeholder:item:'+i);await move(a.x,a.y);await page.waitForTimeout(70);
    const t=await tip();inspectTip(t,'hover '+i);
    const png=await page.screenshot({path:join(out,'tooltip-hover-'+i+'.png')});
    const gap=t?await captureTipGap(page,png,t,a,t.x>a.x?'right':'left'):null;
    check('hover '+i+' actual 5px border gap',validTipGap(gap),JSON.stringify(gap));
    await move(5,200);
  }
  for(const [w,h] of viewportSizes){
    await page.setViewportSize({width:w,height:h});await page.waitForFunction(w=>Math.abs(window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom-w/960)<1e-6,w);
    const a=await coords('placeholder:item:0'),z=w/960;
    await move(5*z,200*z);await move(a.x*z,a.y*z);await page.waitForTimeout(90);
    const t=await tip();const png=await page.screenshot({path:join(out,'tooltip-scale-'+w+'.png')});
    const p=t?await captureTipPixels(t,png):null;
    check(w+' tooltip visible 5px scaled padding and row gaps',!!p&&exactTipPadding(p,z),JSON.stringify(p));
    const right=t?await captureTipGap(page,png,t,a,'right'):null;
    check(w+' drop right actual 5px border gap',validTipGap(right),JSON.stringify(right));
    await move(5*z,200*z);
    const leftAnchor=await coords('placeholder:item:4');
    await move(leftAnchor.x*z,leftAnchor.y*z);await page.waitForTimeout(90);
    const leftTip=await tip(),leftPng=await page.screenshot({path:join(out,'tooltip-left-'+w+'.png')});
    const left=leftTip?await captureTipGap(page,leftPng,leftTip,leftAnchor,'left'):null;
    check(w+' drop left actual 5px border gap',validTipGap(left),JSON.stringify(left));
    console.log('TOOLTIP_SCALE '+w+' '+JSON.stringify({padding:p,right,left}));
    await move(5*z,200*z);
  }
  await page.setViewportSize({width:960,height:540});await page.waitForFunction(()=>window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===1);
  const slot=initial.slots[0],last=initial.slots[9];
  const cardState=async name=>page.evaluate(name=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName(name);return {border:o.list[0].fillColor,face:o.list[1].fillColor,alpha:o.alpha};},name);
  const slotState=async()=>page.evaluate(()=>{const s=window.__benchmarkGame.scene.getScene('Game');return Array.from({length:10},(_,i)=>{const b=s.children.getByName('slot-frame:'+i),o=s.children.getByName('preview-equipped:'+i);return {border:o?.visible?o.list[0].fillColor:b.strokeColor,face:o?.visible?o.list[1].fillColor:b.fillColor,single:!(o?.visible&&b.visible)};});});
  const sky=0x67A3EE,slate=0x51516B,panel=0x3B3B4E;
  const slotHighlights=async(target)=>slotState().then(a=>a.every((v,i)=>v.single&&v.border===(i<9&&(target===-1||target===i)?sky:slate)));
  const a=await coords('placeholder:item:0');await move(a.x,a.y);
  check('item hover sky border only',JSON.stringify(await cardState('placeholder:item:0'))===JSON.stringify({border:sky,face:panel,alpha:1}));
  await drag('placeholder:item:0',10,200,false);
  check('item drag sky on all nine usable slots, locked neutral',await slotState().then(a=>a.every((v,i)=>v.single&&v.border===(i===9?slate:sky)&&v.face===(i===9?0x161619:panel))));
  await page.screenshot({path:join(out,'item-drag-borders.png')});
  await move(slot.x+3,slot.y+3);
  check('item target sky with one slot border and ghost icon',await page.evaluate(()=>{const s=window.__benchmarkGame.scene.getScene('Game'),g=s.children.getByName('item-preview-ghost');return g.visible&&!g.list[0].visible&&!g.list[1].visible&&s.children.getByName('slot-frame:0').strokeColor===0x67A3EE&&!s.children.getByName('preview-slot-highlight');}));
  check('item off-center pointer retains translucent cursor card and centered ghost',await page.evaluate(({x,y,size})=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName('placeholder:item:0'),f=s.children.getByName('slot-frame:0'),g=s.children.getByName('item-preview-ghost');return o.width===size&&o.height===size&&f.width===size&&f.height===size&&o.x===x+3&&o.y===y+3&&g.x===x+size/2&&g.y===y+size/2&&o.alpha===0.25&&g.list[2].displayWidth===16;},slot));
  check('item valid target alone highlighted',await slotHighlights(0));
  await page.screenshot({path:join(out,'item-target-only.png')});
  await move(slot.x+35+16,slot.y+16);
  check('item direct target switch',await slotHighlights(1));
  await move(last.x+last.size/2,last.y+last.size/2);
  check('item locked target restores all usable candidates',await slotHighlights(-1));
  await move(10,200);
  check('item exits target restores all candidates',await slotHighlights(-1));
  check('item leaves target restores card',await cardState('placeholder:item:0').then(v=>v.alpha===1&&v.border===sky));
  await move(slot.x+3,slot.y+3);
  await page.mouse.up();
  check('item placed returns to slate, single frame',await slotState().then(a=>a.every(v=>v.single&&v.border===slate)));
  check('equip',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible));
  for(const [w,h] of viewportSizes){
    await page.setViewportSize({width:w,height:h});await page.waitForFunction(w=>Math.abs(window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom-w/960)<1e-6,w);
    const z=w/960,a={x:slot.x+slot.size/2,y:slot.y+slot.size/2};
    await move(5*z,200*z);await move(a.x*z,a.y*z);await page.waitForTimeout(90);
    const t=await tip(),png=await page.screenshot({path:join(out,'tooltip-slot-'+w+'.png')});
    const above=t?await captureTipGap(page,png,t,a,'above',slot.size):null;
    check(w+' equipped actual 5px border gap',validTipGap(above),JSON.stringify(above));
    console.log('TOOLTIP_SLOT '+w+' '+JSON.stringify(above));
    await move(5*z,200*z);
  }
  await page.setViewportSize({width:960,height:540});await page.waitForFunction(()=>window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===1);
  await drag('placeholder:item:3',slot.x+slot.size/2,slot.y+slot.size/2,false);await page.waitForTimeout(100);inspectTip(await tip(),'replace',true);
  check('item occupied target alone highlighted during replacement',await slotHighlights(0));
  const replacement=await tip();
  check('replacement 5px above slot',!!replacement&&Math.abs(slot.y-replacement.y-replacement.h-5)<1e-6,JSON.stringify(replacement));
  const replacementPng=await page.screenshot({path:join(out,c.id+'-replace.png')});
  const tipPixels=await captureTipPixels(replacement,replacementPng);
  check('replacement actual gray description and no bottom divider',tipPixels.edges[1].exact>0&&tipPixels.divider===0&&tipPixels.headerColor.join(',')==='68,68,92'&&tipPixels.bodyColor.join(',')==='59,59,78',JSON.stringify(tipPixels));
  check('replacement visible 5px padding and rows',exactTipPadding(tipPixels,1),JSON.stringify(tipPixels));
  console.log('TOOLTIP_PADDING_REPORT '+JSON.stringify(tipPixels));
  const delta=await gameMetrics();inspectGame(delta,'replacement stats');
  check('dragged item follows target',await page.evaluate(({x,y})=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName('placeholder:item:3'),ghost=s.children.getByName('item-preview-ghost');return Math.abs(o.x-x)<1&&Math.abs(o.y-y)<1&&o.alpha===0.25&&ghost.visible&&Math.abs(ghost.x-x)<1&&Math.abs(ghost.y-y)<1;},{x:slot.x+slot.size/2,y:slot.y+slot.size/2}));
  check('dragging image centered and shadow hidden',await page.evaluate(()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:3');return o.list[2].y===0&&o.list[1].y===0&&!o.list[3].visible&&o.list[0].visible&&o.list[0].y===0&&o.list[1].visible&&o.list[1].fillColor===0x3B3B4E&&o.list[0].fillColor===0x67A3EE;}));
  await page.mouse.up();
  check('equipped item keeps original slot frame',await page.evaluate(()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0');return o.visible&&o.list.length===3&&o.list[0].visible&&o.list[1].visible&&o.list[2].y===0;}));
  check('replace',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('preview-equipped:0').visible&&!window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:3').visible));
  await drag('placeholder:item:1',last.x+last.size/2,last.y+last.size/2);
  check('locked reject',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').visible));
  // Wait for the next actual update frame after dragend, rather than a fixed wall-clock delay.
  const rejectedDropState=()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1');return o.visible&&o.depth===0&&o.list[3].visible&&o.list[0].visible&&o.list[1].visible&&o.list[1].fillColor===0x3B3B4E;};
  const resumed=await page.waitForFunction(rejectedDropState,{}, {timeout:3000}).then(()=>true,()=>false);
  check('rejected drop resumes float',resumed,JSON.stringify(await page.evaluate(()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1');return {visible:o.visible,depth:o.depth,shadow:o.list[3].visible,border:o.list[0].visible,face:o.list[1].visible,fillColor:o.list[1].fillColor};})));
  let g=initial.garden;
  const targetFlower={x:g.x+4*g.pitch+g.line+g.cell/2,y:g.y+3*g.pitch+g.line+g.cell/2};
  const flowerPos=await coords('placeholder:flower:0');await move(flowerPos.x,flowerPos.y);
  check('flower hover green border only',JSON.stringify(await cardState('placeholder:flower:0'))===JSON.stringify({border:0x6ABA2C,face:panel,alpha:1}));
  const flowerGridState=async(target=-1)=>page.evaluate(target=>{
    const L=window.GardenGameLayout,g=L.spec.garden,s=window.__benchmarkGame.scene.getScene('Game'),occupied=new Set([44,45,54,55]),candidates=L.gardenCandidates(occupied),visible=new Set([...occupied,...candidates]),t=s.textures.get('ui-test:garden-soil:'+g.cell),ctx=t.getContext();
    const pixels=ctx.getImageData(0,0,g.size,g.size).data;
    let mismatch=0,green=0,expectedGreen=0;
    for(let y=0;y<g.size;y++)for(let x=0;x<g.size;x++){
      let type=0;
      for(const k of visible){
        const a=x-k%g.columns*g.pitch,b=y-Math.floor(k/g.columns)*g.pitch;
        if(a<0||a>=g.outer||b<0||b>=g.outer)continue;
        const ex=a===0||a===g.outer-1,ey=b===0||b===g.outer-1;
        if(ex&&ey)continue;
        type=Math.max(type,ex||ey?(candidates.has(k)&&(target===-1||target===k)?3:2):1);
      }
      const i=(y*g.size+x)*4,v=Array.from(pixels.slice(i,i+4)).join(',');
      if(type===3)expectedGreen++;
      if(v==='106,186,44,255')green++;
      if(v!==(type===3?'106,186,44,255':type===2?'81,81,107,255':type===1?'59,59,78,255':'0,0,0,0'))mismatch++;
    }
    return {mismatch,green,expectedGreen,noOverlay:!s.children.getByName('garden-preview-highlight')};
  },target);
  await drag('placeholder:flower:0',10,200,false);
  check('flower drag candidate borders only, no overlay',await flowerGridState().then(a=>a.mismatch===0&&a.green===a.expectedGreen&&a.green>0&&a.noOverlay));
  check('flower drag card green border and neutral face',JSON.stringify(await cardState('placeholder:flower:0'))===JSON.stringify({border:0x6ABA2C,face:panel,alpha:1}));
  const activeGardenPng=await page.screenshot({path:join(out,'flower-drag-borders.png')});
  const activeGardenSeams=await captureGardenSeams(page,activeGardenPng,g,1);
  check('flower drag visible single green candidate borders',activeSeams(activeGardenSeams,1)&&idleSeam(activeGardenSeams.vertical,1)&&idleSeam(activeGardenSeams.horizontal,1),JSON.stringify(activeGardenSeams));
  await move(targetFlower.x-5,targetFlower.y-5);
  check('flower target alone highlighted, four 22px sides, no pluses',await flowerGridState(34).then(a=>a.mismatch===0&&a.green===88&&a.noOverlay));
  await move(targetFlower.x+g.pitch,targetFlower.y);
  check('flower direct target switch highlights new cell only',await flowerGridState(35).then(a=>a.mismatch===0&&a.green===88));
  await move(targetFlower.x,targetFlower.y+g.pitch);
  check('flower occupied target restores all candidates',await flowerGridState().then(a=>a.mismatch===0&&a.green===a.expectedGreen&&a.green>88));
  await move(10,200);
  check('flower exits target restores all candidates',await flowerGridState().then(a=>a.mismatch===0&&a.green===a.expectedGreen&&a.green>88));
  await move(targetFlower.x-5,targetFlower.y-5);
  check('flower reentry highlights target alone',await flowerGridState(34).then(a=>a.mismatch===0&&a.green===88));
  await page.screenshot({path:join(out,'flower-target-only.png')});
  const gardenDragPng=await page.screenshot({path:join(out,'garden-drag-cut-corners.png')});
  const gardenDragSeams=await captureGardenSeams(page,gardenDragPng,g,1);
  check('flower target leaves unaffected grid corners clear during drag',gardenDragSeams.corners.filter(v=>v.row>=5).every(v=>v.clear),JSON.stringify(gardenDragSeams.corners));
  check('flower ghost centered on shared grid',await page.evaluate(p=>{const s=window.__benchmarkGame.scene.getScene('Game'),o=s.children.getByName('garden-preview-ghost');return o.visible&&o.x===p.x&&o.y===p.y&&o.displayWidth===16&&s.children.getByName('placeholder:flower:0').alpha===0.25&&s.children.getByName('placeholder:flower:0').x===p.x-5&&s.children.getByName('placeholder:flower:0').y===p.y-5&&s.children.getByName('placeholder:flower:0').width===window.GardenGameLayout.spec.garden.outer;},targetFlower));
  await page.mouse.up();
  check('plant',await page.evaluate(()=>!!window.__benchmarkGame.scene.getScene('Game').children.getByName('garden-preview-flower:34')));
  const afterPlant=await inspectGarden('after plant');
  check('plant extends only adjacent candidates',afterPlant.occupied.length===5&&afterPlant.visible===14,JSON.stringify(afterPlant));
  let b=initial.blueprint;await move(b.x+b.width/2,b.y+b.header/2);await page.mouse.click(b.x+b.width/2,b.y+b.header/2);
  check('blueprint toggle',await page.evaluate(()=>!window.__benchmarkGame.scene.getScene('Game').children.getByName('blueprint-body').visible));
  await page.mouse.click(b.x+b.width/2,b.y+b.header/2);
  check('blueprint reopens',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('blueprint-body').visible));
  await page.mouse.click(b.x+b.width/2,b.y+b.header/2);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Pause'));
  const frozen=await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').list[2].y);
  await page.waitForTimeout(250);
  check('pause freezes float',await page.evaluate(v=>window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:1').list[2].y===v,frozen));
  let pause=await menuMetrics('Pause');inspectMenu(pause,'Pause');await menuAudit('Pause');
  await button('Pause','설정');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Settings'));inspectMenu(await menuMetrics('Settings'),'Settings');await menuAudit('Settings');
  await button('Settings','사운드');check('settings audio',await page.evaluate(()=>window.__benchmarkGame.scene.getScene('Settings').activeTab==='audio'));await menuAudit('Settings','SettingsAudio');
  await button('Settings','화면');await menuAudit('Settings','SettingsVideo');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Pause'));
  await button('Pause','도감');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Codex'));inspectMenu(await menuMetrics('Codex'),'Codex');await menuAudit('Codex');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Pause'));
  await button('Pause','메인 메뉴로');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Confirm'));inspectMenu(await menuMetrics('Confirm'),'Confirm');await menuAudit('Confirm');
  await button('Confirm','돌아가기');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('MainMenu'));
  await button('MainMenu','성공 화면');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Victory'));inspectMenu(await menuMetrics('Victory'),'Victory');await menuAudit('Victory');
  await button('Victory','메인 메뉴');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('MainMenu'));await button('MainMenu','실패 화면');await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Defeat'));inspectMenu(await menuMetrics('Defeat'),'Defeat');await menuAudit('Defeat');
  check('runtime errors',errors.length===0,errors.join('; '));
  check('tooltip gap and palette role contract',await page.evaluate(()=>{let L=window.GardenGameLayout,T=L.itemTooltip,p=L.tooltipPosition({x:400,y:200,size:24},T.width,100,L.spec.top+L.spec.fieldHeight);return T.width===L.hud.barWidth&&T.width===158&&T.gap===T.padding&&p.x===417&&T.padding===5&&T.padding===L.spec.blueprint.padding&&T.bottomPadding===T.padding&&T.rowGap===5&&T.lineSpacing===4&&T.strokeWidth===1&&T.background===L.colors.normalFill&&T.header===window.GardenPalette.reference.n.header&&T.description===L.colors.hudLabel&&!('divider' in T)}));
  const locales=await page.evaluate(()=>window.GardenUI.hudLabels);
  const localeResults=[];
  for(const [lang, labels] of Object.entries(locales)){
    const missing=[...new Set(Object.values(labels).join(''))].filter(ch=>!font.hasGlyphForCodePoint(ch.codePointAt(0)));
    check(lang+' bundled font coverage',missing.length===0,JSON.stringify(missing));
    for(const [w,h] of viewportSizes){
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
        const metricWidth=kills.x-clock.x, gemX=s.children.getByName('hud-gem-icon').x-L.hud.padding;
        const barX=percent.x+percent.w/2-L.hud.barWidth/2;
        const gaps=[time.x-clock.x-Math.ceil(clock.w),counts[0].x-kills.x-Math.ceil(kills.w),barX-garden.x-Math.ceil(garden.w)];
        return {lang:U.hudLanguage(),metricWidth,gemX,barX,gaps,all,labels,green:L.colors.progressFill===0x6ABA2C,top:L.spec.top};
      });
      const key=lang+' '+w+'x'+h;
      check(key+' labels and bounds',m.lang===lang&&m.all.length===7&&m.all.every(t=>t.x>=0&&t.y>=0&&t.x+t.w<=960.1&&t.y+t.h<=32.1),JSON.stringify(m));
      check(key+' equal widths and fixed gauge',m.metricWidth===initial.hudLayout.metricWidth&&Math.abs(m.gemX-2*m.metricWidth)<=960/w&&m.barX===794.5&&m.green,JSON.stringify(m));
      const png=await page.screenshot({path:join(out,'hud-'+lang+'-'+w+'.png')});
      const actual=await captureHudGaps(png,m.all,w/960,m.labels);
      check(key+' actual 5px gaps and no overlap',Object.values(actual.edges).every(e=>e.n>0)&&actual.gaps.every(g=>g===Math.round(5*w/960))&&m.all.every((a,i)=>m.all.every((b,j)=>i===j||!overlap(a,b))),JSON.stringify({m,actual}));
      m.gaps=actual.gaps;
      console.log('HUD_LOCALE '+key+' '+JSON.stringify(actual));
      check(key+' reserved column containment',m.all.filter(t=>t.x<3*m.metricWidth).every(t=>t.x+t.w<=Math.ceil(t.x/m.metricWidth)*m.metricWidth-6.5)&&m.all.find(t=>t.text===m.labels.progress).x>=3*m.metricWidth,JSON.stringify(m));
      localeResults.push({lang,viewport:[w,h],width:m.metricWidth,barX:m.barX,gaps:m.gaps,labels:m.labels});

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
    check(key+' browser title identifies selected slot size',await page.title()==='Garden Test | 슬롯 '+size+'px');
    check(key+' equal sizes, center and gap',m.slots.length===10&&m.slots.every((s,i)=>s.size===size&&s.y-(540-m.bottom+2)===3&&540-(s.y+s.size)===3&&(!i||s.x-m.slots[i-1].x===size+3))&&m.slotWidth===10*size+27&&Math.abs(m.slotLeft+m.slotWidth/2-480)<=0.5&&m.side===210&&detail.bottom===size+8,JSON.stringify(m.slots));
    check(key+' matching hitboxes, cards, ghost and 32px field items',detail.zones.length===9&&detail.zones.every(a=>a.every(v=>v===size))&&detail.cards.length===9&&detail.cards.every(a=>a[0]===size&&a[1]===size&&a[2]===size-2&&a[3]===16)&&detail.ghost.every(v=>v===size)&&detail.drop===32,JSON.stringify(detail));
    check(key+' cost shares visible row gap specification',m.cost.font===8&&m.costSpec.gap===3&&m.statSpec.lineGap===3&&detail.costMasked===(size===24),JSON.stringify(m.cost));
    await page.setViewportSize({width:1920,height:1080});
    await page.waitForFunction(()=>window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===2);
    const screenshot=await page.screenshot({path:join(out,'slots-'+size+'-1920.png')});
    const pixel=await page.evaluate(async ({data,last,cost,stats})=>{
      const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob()), cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
      const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(0,0,cv.width,cv.height).data;
      const rgb=(x,y)=>Array.from(p.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3));
      const ink=v=>Math.min(...v)>=145&&Math.max(...v)-Math.min(...v)<=5;
      const scan=(x0,y0,x1,y1,pred)=>{let top=Infinity,bottom=-1,left=Infinity,right=-1,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pred(rgb(x,y))){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);n++;}return {top,bottom,left,right,n};};
      const split=Math.round((last.y+last.size/2+1.5)*2);
      const number=scan(Math.floor(cost.x*2),Math.max(split,Math.floor(cost.y*2)),Math.ceil((cost.x+cost.w)*2),Math.ceil((cost.y+cost.h)*2),v=>Math.max(...v)>=66);
      const gem=scan(last.x*2+2,last.y*2+2,(last.x+last.size)*2-2,split,v=>v.join(',')==='176,172,189');
      const digitRows=stats.filter(t=>t.name.startsWith('stat-value:')).map(t=>scan(Math.floor(t.x*2),Math.max(split,Math.floor(t.y*2)),Math.ceil((t.x+t.w)*2),Math.ceil((t.y+t.h)*2),v=>Math.max(...v)>=83));
      const frame=Array.from({length:last.size*2},(_,i)=>rgb(last.x*2+i,(last.y+last.size)*2-1).join(',')).every((v,i)=>v===(i<2||i>=last.size*2-2?'22,22,25':'81,81,107'));
      return {number,gem,digitRows,frame};
    },{data:screenshot.toString('base64'),last,cost:m.cost,stats:m.stats});
    check(key+' actual FHD digits, gem, intact bottom border',pixel.number.n>0&&pixel.gem.n>0&&pixel.digitRows.every(t=>t.top===pixel.number.top&&t.bottom===pixel.number.bottom)&&pixel.number.bottom<(last.y+size)*2-2&&pixel.gem.top>=last.y*2+2&&pixel.number.top-pixel.gem.bottom-1===6&&pixel.frame,JSON.stringify(pixel));
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
  for(const mode of [32,36]){
    await page.goto(origin+'/'+c.id+'/index.html?garden='+mode+'&preview=1',{waitUntil:'load'});
    await page.waitForFunction(()=>window.__benchmarkGame?.scene.isActive('MainMenu'),{},{timeout:20000});
    await button('MainMenu','새 게임');
    await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Game'));
    const a=await inspectGarden('garden '+mode,32);
    const p={x:a.g.x+4*a.g.pitch+a.g.line+a.g.cell/2,y:a.g.y+3*a.g.pitch+a.g.line+a.g.cell/2};
    await drag('placeholder:flower:0',p.x,p.y);
    const planted=await inspectGarden('garden '+mode+' planted',32);
    check('garden '+mode+' plant in same cell',planted.occupied.includes(34)&&planted.occupied.length===5);
  }
  // URL-only soil variants: verify the exact palette color, transparent cut corners,
  // unchanged non-garden UI, and real placement/resize rendering.
  const soilVariants=[['default',0x3B3B4E],['1',0x7C4C24],['2',0xA46444],['3',0x0C9484],['invalid',0x3B3B4E]];
  const inspectSoilTexture=async(expected,dragging=false,target=-1)=>page.evaluate(({expected,dragging,target})=>{
    const L=window.GardenGameLayout,g=L.spec.garden,s=window.__benchmarkGame.scene.getScene('Game');
    const occupied=new Set(s.children.list.filter(o=>o.name?.startsWith('garden-preview-flower:')).map(o=>Number(o.name.split(':').at(-1))));
    const candidates=L.gardenCandidates(occupied),visible=new Set([...occupied,...candidates]);
    const t=s.textures.get('ui-test:garden-soil:'+g.cell),w=g.size,p=t.getContext().getImageData(0,0,w,w).data;
    let mismatch=0,activeCount=0,faceCount=0;
    for(let y=0;y<w;y++)for(let x=0;x<w;x++){
      let type=0;
      for(const k of visible){
        const u=x-k%g.columns*g.pitch,v=y-Math.floor(k/g.columns)*g.pitch;
        if(u<0||v<0||u>=g.outer||v>=g.outer)continue;
        const ex=u===0||u===g.outer-1,ey=v===0||v===g.outer-1;
        if(ex&&ey)continue;
        type=Math.max(type,ex||ey?(dragging&&candidates.has(k)&&(target===-1||target===k)?3:2):1);
      }
      const color=type===3?0x6ABA2C:type===2?0x51516B:expected,i=(y*w+x)*4;
      const actual=(p[i]<<16)|(p[i+1]<<8)|p[i+2];
      if(type===3)activeCount++;if(type===1)faceCount++;
      if(type===0?(p[i+3]!==0):(p[i+3]!==255||actual!==color))mismatch++;
    }
    return {mismatch,activeCount,faceCount,occupied:occupied.size,candidates:candidates.size,
      roles:L.colors.gardenSoil===expected&&L.colors.gardenBorder===L.colors.normalBorder&&L.colors.normalBorder===0x51516B&&L.colors.normalFill===0x3B3B4E&&L.colors.gridFill===0x3B3B4E&&L.colors.flowerBorder===0x6ABA2C&&L.colors.itemBorder===0x67A3EE&&L.itemTooltip.accent===0x51516B};
  },{expected,dragging,target});
  const inspectSoilPixels=async(png,expected,z)=>page.evaluate(async ({data,expected,z})=>{
    const L=window.GardenGameLayout,g=L.spec.garden,b=L.spec.blueprint;
    const img=await createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob()),cv=document.createElement('canvas');
    cv.width=img.width;cv.height=img.height;const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
    const p=ctx.getImageData(0,0,cv.width,cv.height).data,R=Math.round;
    const rgb=(x,y)=>{const i=(y*cv.width+x)*4;return(p[i]<<16)|(p[i+1]<<8)|p[i+2];};
    let intersections=0,wrong=0;
    for(let row=1;row<b.rows;row++)for(let col=1;col<b.columns;col++){
      const x=b.gridX+b.frame+col*b.pitch,y=b.gridY+b.frame+row*b.pitch;
      for(let py=R(y*z);py<R((y+b.line)*z);py++)for(let px=R(x*z);px<R((x+b.line)*z);px++){
        intersections++;if(rgb(px,py)!==0x51516B)wrong++;
      }
    }
    const points=[[4,4,3,3],[4,3,3,3],[5,3,3,3],[5,5,3,3],[5,4,0,3]];
    const soil=points.map(([col,row,dx,dy])=>rgb(R((g.x+col*g.pitch+dx)*z),R((g.y+row*g.pitch+dy)*z)));
    const cell=rgb(R((b.gridX+4)*z),R((b.gridY+4)*z));
    const line=rgb(R((b.gridX+b.frame+b.pitch)*z),R((b.gridY+b.frame+b.line+3)*z));
    const outer=rgb(R((b.gridX+4)*z),R(b.gridY*z));
    const inner=rgb(R((b.gridX+4)*z),R((b.gridY+1)*z));
    return {intersections,wrong,soil,pass:soil.slice(0,-1).every(v=>v===expected)&&soil.at(-1)===0x51516B&&cell===0x3B3B4E&&line===0x51516B&&outer===0x3B3B4E&&inner===0x51516B};
  },{data:png.toString('base64'),expected,z});
  for(const [mode,color] of soilVariants){
    await page.setViewportSize({width:960,height:540});
    await page.goto(origin+'/'+c.id+'/index.html?preview=1'+(mode==='default'?'':'&type='+mode),{waitUntil:'load'});
    await page.waitForFunction(()=>window.__benchmarkGame?.scene.isActive('MainMenu'),{},{timeout:20000});
    await button('MainMenu','새 게임');
    await page.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Game'));
    const a=await inspectSoilTexture(color);
    check('soil type '+mode+' initial occupied and candidate fills, unchanged UI palette',a.mismatch===0&&a.activeCount===0&&a.occupied===4&&a.candidates===8&&a.roles,JSON.stringify(a));
    for(const [w,h] of [[960,540],[1920,1080]]){
      await page.setViewportSize({width:w,height:h});
      await page.waitForFunction(w=>window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===w/960,w);
      const png=await page.screenshot({path:join(out,'soil-type-'+mode+'-'+w+'.png')});
      const v=await inspectSoilPixels(png,color,w/960);
      check('soil type '+mode+' '+w+' actual soil and 81 solid slate blueprint intersections',v.pass&&v.wrong===0&&v.intersections===81*(w/960)**2,JSON.stringify(v));
    }
    await page.setViewportSize({width:960,height:540});
    await page.waitForFunction(()=>window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===1);
    const g=await page.evaluate(()=>window.GardenGameLayout.spec.garden);
    await drag('placeholder:flower:0',10,200,false);
    const active=await inspectSoilTexture(color,true);
    check('soil type '+mode+' active borders use growth and retain soil color',active.mismatch===0&&active.activeCount>0&&active.roles,JSON.stringify(active));
    await page.screenshot({path:join(out,'soil-type-'+mode+'-drag.png')});
    await move(g.x+4*g.pitch+g.outer/2-5,g.y+3*g.pitch+g.outer/2-5);
    const focused=await inspectSoilTexture(color,true,34);
    check('soil type '+mode+' target alone highlighted',focused.mismatch===0&&focused.activeCount===88&&focused.roles,JSON.stringify(focused));
    await page.mouse.up();
    const planted=await inspectSoilTexture(color);
    check('soil type '+mode+' plant expands with same color and resets borders',planted.mismatch===0&&planted.occupied===5&&planted.activeCount===0&&planted.roles,JSON.stringify(planted));
  }
    // The displayed CSS size and the native backing store must differ at DPR 2.
  const hi=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:2});
  const nativeErrors=[];hi.on('pageerror',e=>nativeErrors.push(String(e)));
  try {
    await hi.goto(origin+'/'+c.id+'/index.html?hud=stress',{waitUntil:'load'});
    await hi.waitForFunction(()=>window.__benchmarkGame?.scene.isActive('MainMenu'),{},{timeout:20000});
    const nativeMetrics=()=>hi.evaluate(()=>{
      const game=window.__benchmarkGame,cv=game.canvas,r=cv.getBoundingClientRect();
      return {buffer:[cv.width,cv.height],css:[r.width,r.height],dpr:devicePixelRatio,scale:[game.scale.displayScale.x,game.scale.displayScale.y],game:[game.scale.gameSize.width,game.scale.gameSize.height]};
    });
    const before=await nativeMetrics();
    check('DPR 2 native backing buffer and input scale',JSON.stringify(before.buffer)==='[1920,1080]'&&JSON.stringify(before.css)==='[960,540]'&&before.dpr===2&&before.scale.every(v=>v===2)&&JSON.stringify(before.game)===JSON.stringify(before.buffer),JSON.stringify(before));
    // CSS-coordinate click at DPR 2: verifies ScaleManager input mapping.
    await hi.mouse.click(480,252);
    await hi.waitForFunction(()=>window.__benchmarkGame.scene.isActive('Game'),{},{timeout:5000});
    const nativeReport=await hi.evaluate(()=>{
      const s=window.__benchmarkGame.scene.getScene('Game'),z=s.cameras.main.zoom;
      const texts=s.children.list.filter(o=>o.type==='Text'&&o.visible);
      return {zoom:z,texts:texts.length,native:texts.every(t=>t.style.resolution===z&&t.frame.width===t.canvas.width&&t.frame.height===t.canvas.height&&t.frame.u1===1&&t.frame.v1===1)};
    });
    check('DPR 2 text texture maps 1:1 to device pixels',nativeReport.zoom===2&&nativeReport.texts>=20&&nativeReport.native,JSON.stringify(nativeReport));
    await hi.screenshot({path:join(out,'native-dpr2-1920.png'),scale:'device'});
    await hi.setViewportSize({width:800,height:450});
    await hi.waitForFunction(()=>window.__benchmarkGame.canvas.width===1600&&window.__benchmarkGame.scene.getScene('Game').cameras.main.zoom===1600/960);
    const after=await nativeMetrics();
    check('DPR 2 resize retains native backing buffer and CSS input mapping',JSON.stringify(after.buffer)==='[1600,900]'&&JSON.stringify(after.css)==='[800,450]'&&after.scale.every(v=>v===2),JSON.stringify(after));
    const marker=await hi.evaluate(()=>{const o=window.__benchmarkGame.scene.getScene('Game').children.getByName('placeholder:item:0');return {x:o.x,y:o.y};});
    await hi.mouse.move(marker.x*800/960,marker.y*450/540);
    await hi.waitForFunction(()=>window.__benchmarkGame.scene.getScene('Game').children.getByName('item-preview-tooltip').visible,{},{timeout:5000});
    const png=await hi.screenshot({path:join(out,'native-dpr2-fractional-tooltip.png'),scale:'device'});
    const nativePixels=await hi.evaluate(async ({data})=>{
      const game=window.__benchmarkGame,s=game.scene.getScene('Game'),z=s.cameras.main.zoom;
      const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+data)).blob());
      const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
      const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,cv.width,cv.height).data;
      const rgb=(x,y)=>Array.from(pixels.slice((y*cv.width+x)*4,(y*cv.width+x)*4+3)).join(',');
      const corners=(x,y,w,h)=>{const l=Math.round(x*z),t=Math.round(y*z),r=Math.round((x+w)*z)-1,b=Math.round((y+h)*z)-1;return [rgb(l,t),rgb(r,t),rgb(l,b),rgb(r,b)];};
      const tip=s.children.getByName('item-preview-tooltip'),bg=tip.getByName('item-tooltip-background');
      const slot=window.GardenGameLayout.bottomLayout().slots[9];
      const textObjects=[...s.children.list.filter(o=>o.type==='Text'&&o.visible),...tip.list.filter(o=>o.type==='Text')];
      return {buffer:[cv.width,cv.height],slot:corners(slot.x,slot.y,slot.size,slot.size),tooltip:corners(tip.x,tip.y,bg.width,bg.height),nativeText:textObjects.every(t=>t.style.resolution===z&&t.frame.width===t.canvas.width&&t.frame.height===t.canvas.height&&t.frame.u1===1&&t.frame.v1===1)};
    },{data:png.toString('base64')});
    const nativeTip=await hi.evaluate(()=>{const s=window.__benchmarkGame.scene.getScene('Game'),t=s.children.getByName('item-preview-tooltip'),b=t.list[0];return {x:t.x,y:t.y,w:b.width,h:b.height,zoom:s.cameras.main.zoom};});
    const nativeGap=await captureTipGap(hi,png,nativeTip,marker,'right');
    const nativeGarden=await hi.evaluate(()=>window.GardenGameLayout.spec.garden);
    const nativeSeams=await captureGardenSeams(hi,png,nativeGarden,nativeTip.zoom);
    check('DPR2 fractional garden slate grid and corners',validSeams(nativeSeams,nativeTip.zoom),JSON.stringify(nativeSeams));
    check('DPR 2 fractional actual 5px border gap',validTipGap(nativeGap),JSON.stringify(nativeGap));
    check('fractional native output slot/tooltip cuts and exact text frames',nativePixels.slot.every(v=>v==='22,22,25')&&nativePixels.tooltip.every(v=>v==='13,13,13')&&nativePixels.nativeText,JSON.stringify(nativePixels));
    console.log('NATIVE_REPORT '+JSON.stringify({before,after,nativeReport,nativePixels}));
    // A non-16:9 browser must preserve the same logical layout, centered with letterbox.
    await hi.setViewportSize({width:1000,height:700});
    await hi.waitForFunction(()=>window.__benchmarkGame.canvas.width===2000&&window.__benchmarkGame.canvas.height===1125);
    const letterbox=await hi.evaluate(()=>{
      const game=window.__benchmarkGame,r=game.canvas.getBoundingClientRect(),s=game.scene.getScene('Game');
      return {buffer:[game.canvas.width,game.canvas.height],rect:[r.x,r.y,r.width,r.height],zoom:s.cameras.main.zoom,viewport:[innerWidth,innerHeight],slots:window.GardenGameLayout.bottomLayout().slots.map(a=>[a.x,a.y,a.size])};
    });
    check('DPR 2 non-16:9 letterbox preserves 960x540 logical coordinates',letterbox.buffer.join(',')==='2000,1125'&&Math.abs(letterbox.rect[0])<=1&&Math.abs(letterbox.rect[1]-(700-562.5)/2)<=1&&letterbox.rect[2]===1000&&Math.abs(letterbox.rect[3]-562.5)<=1&&Math.abs(letterbox.zoom-2000/960)<1e-6&&letterbox.slots.every((v,i)=>v[0]===306+i*35&&v[1]===505&&v[2]===32),JSON.stringify(letterbox));
    check('native DPR runtime errors',nativeErrors.length===0,nativeErrors.join('; '));
  } finally { await hi.close(); }
  check('localized runtime errors',errors.length===0,errors.join('; '));
  results.push({id:c.id,name:c.name,localeResults,passed:checks.filter(x=>x.pass).length,total:checks.length,eligible:checks.every(x=>x.pass),fails:checks.filter(x=>!x.pass),ink:initial.ink,blueprintMetrics:initial.blueprintMetrics,hudLayout:initial.hudLayout,renderer:await page.evaluate(()=>window.__benchmarkGame.renderer.type),observations:observations.map(m=>({canvas:m.canvas,zoom:m.zoom}))});
 }catch(e){results.push({id:c.id,name:c.name,config:c,score:null,eligible:false,passed:checks.filter(x=>x.pass).length,total:checks.length,fails:[...checks.filter(x=>!x.pass),{name:'exception',detail:String(e)}],errors});}
 finally{await page.close();console.log('RESULT '+JSON.stringify(results.at(-1)));writeFileSync(join(out,'report.json'),JSON.stringify(results,null,2));}
}
await browser.close();server.close();
if(!results.every(r=>r.eligible))process.exitCode=1;

// Reference screenshot regression: actual browser render, not a human preference score.
