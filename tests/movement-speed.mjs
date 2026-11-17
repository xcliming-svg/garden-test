import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');
mkdirSync(out,{recursive:true});
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
const report=[];
const baseById={'1_butterfly':28,'2_grasshopper':24,'6_mouse':28,'2_gray_bug':24,'1_cat':30,'3_caterpillar':20,'6_sparrow':32,'6_pigeon':34,'4_beetle':24,'2_frog':28,'6_rabbit':32,'5_bulldog':36};
try{
 for(const [name,w,h,query] of [['default',960,540,''],['fhd',1920,1080,''],['small',640,360,''],['full',960,540,'?full=1'],['hidden',960,540,'?enemies=0'],['combat',960,540,'?combat=1']]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(url+'/index.html'+query);
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const canvas=await page.locator('canvas').boundingBox();
   await page.mouse.click(canvas.x+480*canvas.width/960,canvas.y+252*canvas.height/540);
   await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return !!(s.fairyPatrol||s.combatPreview)});
   if(name==='combat'){assert.equal(await page.locator('#movement-speed-controls').count(),0);report.push({name,pass:true});continue;}
   assert.equal(await page.locator('#fairy-speed option').count(),6);
   assert.equal(await page.locator('#fairy-speed').inputValue(),'0');
   assert.equal(await page.locator('#enemy-speed').count(),name==='hidden'?0:1);
   const fairy=await page.evaluate(()=>{
    const c=window.__previewGame.scene.getScene('Game').fairyPatrol,el=document.getElementById('fairy-speed');
    const set=r=>{el.value=String(r);el.dispatchEvent(new Event('change',{bubbles:true}));};
    const result=[];
    for(let r=0;r<=5;r++){
     const d=c.distance,e=c.elapsed,first=c.actors.map(a=>({...a.center}));
     set(r);const after=c.actors.map(a=>({...a.center}));
     c.advance(1);result.push({rank:c.speedRank,speed:c.speed,moved:(c.distance-d+c.length)%c.length,time:c.elapsed-e,same:JSON.stringify(first)===JSON.stringify(after),spacing:c.spacing});
    }
    set(0);return {result,length:c.length,spacing:c.spacing,speed:c.speed};
   });
   for(let r=0;r<6;r++){const x=fairy.result[r];assert.equal(x.rank,r);assert.equal(x.speed,40+4*r);assert.ok(Math.abs(x.moved-x.speed)<1e-6&&Math.abs(x.time-1)<1e-6&&x.same&&x.spacing===fairy.spacing,JSON.stringify(x));}
   assert.equal(fairy.speed,40);
   let enemies=[];
   if(name!=='hidden'){
    assert.equal(await page.locator('#enemy-speed option').count(),6);
    enemies=await page.evaluate(()=>{
     const s=window.__previewGame.scene.getScene('Game'),c=s.enemyPreview,F=s.fairyPatrol,M=window.GardenEnemyMotion,L=window.GardenGameLayout.spec;
     const choose=(id,v)=>{const el=document.getElementById(id);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));};
     const result=[];
     for(const a of c.entries){
      choose('enemy-character',a.id);choose('enemy-motion-mode','move');
      const route=window.GardenEnemyPreview.route(L,F.boundary,a);
      const rows=[];
      for(let rank=0;rank<=5;rank++){
       choose('enemy-speed',rank);
       const speed=c.speed,travel=M.travelTime(a,route,rank),start=c.pose.x;
       c.advance(travel/2);const mid=c.pose.x;
       c.advance(travel/2);const end=c.pose.x;
       const attackUnchanged=JSON.stringify(M.sample(a,'attack',.3,route,rank))===JSON.stringify(M.sample(a,'attack',.3,route,0));
       let bounded=true;
       for(let i=0;i<=200;i++){
        const p=M.sample(a,'auto',M.duration(a,'auto',route,rank)*i/200,route,rank),rad=p.angle*Math.PI/180,hw=a.width*p.sx/2,hh=a.height*p.sy/2;
        const ex=Math.abs(Math.cos(rad))*hw+Math.abs(Math.sin(rad))*hh,ey=Math.abs(Math.sin(rad))*hw+Math.abs(Math.cos(rad))*hh,y=route.ground-a.height*p.sy/2-p.lift;
        bounded&&=p.x-ex>=F.boundary.border.right+F.boundary.frame/2+9&&p.x+ex<=L.width-8&&y-ey>=L.top&&y+ey<=L.height-L.bottom;
       }
       rows.push({rank:c.speedRank,speed,travel,start,mid,end,expectedStart:route.start,expectedEnd:route.stage,attackUnchanged,bounded,fairySpeed:F.speed});
      }
      result.push({id:a.id,rows});
     }
     choose('enemy-character','3_caterpillar');choose('enemy-speed',0);choose('enemy-motion-mode','auto');
     return result;
    });
    assert.equal(enemies.length,12);
    for(const e of enemies)for(let r=0;r<6;r++){
     const x=e.rows[r],expected=baseById[e.id]*(10+r)/10;assert.equal(x.rank,r);assert.equal(x.speed,expected);
     assert.ok(Math.abs(x.start-x.expectedStart)<1e-6&&Math.abs(x.end-x.expectedEnd)<1e-6&&Math.abs((x.expectedStart-x.expectedEnd)/x.travel-expected)<1e-6&&x.attackUnchanged&&x.bounded&&x.fairySpeed===40,JSON.stringify({id:e.id,...x}));
    }
    await page.selectOption('#enemy-speed','5');assert.equal(await page.locator('#enemy-speed').inputValue(),'5');
   }
   await page.selectOption('#fairy-speed','5');
   assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.speed),60);
   const panel=await page.locator('#movement-speed-controls').boundingBox();
   assert.ok(Math.abs(panel.width/canvas.width*960-226)<2&&Math.abs((panel.x-canvas.x)/canvas.width*960-724)<2);
   if(name==='default'||name==='fhd')await page.screenshot({path:join(out,'movement-speed-'+name+'.png'),scale:'device'});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   assert.equal(await page.locator('#movement-speed-controls').isVisible(),false);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
   assert.equal(await page.locator('#movement-speed-controls').isVisible(),true);
   await page.evaluate(()=>window.__previewGame.scene.stop('Game'));
   await page.waitForFunction(()=>!document.getElementById('movement-speed-controls'));
   assert.deepEqual(errors,[]);report.push({name,fairy,enemies,pass:true});console.log('PASS movement speed',name,'patrol',fairy.length);
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'movement-speed-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' movement speed configurations');
