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
const baseById={'1_butterfly':40,'2_grasshopper':36,'6_mouse':28,'2_gray_bug':24,'1_cat':30,'3_caterpillar':20,'6_sparrow':44,'6_pigeon':48,'4_beetle':24,'2_frog':38,'6_rabbit':44,'5_bulldog':36};
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
   assert.equal(await page.locator('#fairy-speed option').count(),2);
   assert.equal(await page.locator('#garden-size option').count(),2);
   assert.equal(await page.locator('#fairy-speed').inputValue(),'0');
   assert.equal(await page.locator('#garden-size').inputValue(),name==='full'?'100':'4');
   assert.equal(await page.locator('#enemy-speed').count(),name==='hidden'?0:1);
   const matrix=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),F=s.fairyPatrol,c=s.enemyPreview,M=window.GardenEnemyMotion,L=window.GardenGameLayout.spec;
    const choose=(id,v)=>{const e=document.getElementById(id);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));};
    const rows=[];
    for(const gardenSize of [4,100,4]){
     choose('garden-size',gardenSize);
     for(const rank of [0,5]){
      const first=F.actors.map(a=>({...a.center})),d=F.distance,e=F.elapsed;
      choose('fairy-speed',rank);const same=JSON.stringify(first)===JSON.stringify(F.actors.map(a=>({...a.center})));
      F.advance(1);const moved=(F.distance-d+F.length)%F.length;
      const enemies=[];
      if(c)for(const a of c.entries){
       choose('enemy-character',a.id);choose('enemy-motion-mode','move');
       const route=window.GardenEnemyPreview.route(L,F.boundary,a);
       for(const erank of [0,5]){
        choose('enemy-speed',erank);
        const speed=c.speed,travel=M.travelTime(a,route,erank),start=c.pose.x;
        c.advance(travel/2);c.advance(travel/2);const end=c.pose.x;
        const profile=M.profiles[a.id],impact=travel+profile.windup+profile.strike;
        let bounded=true;
        for(let i=0;i<=300;i++){
         const p=M.sample(a,'auto',M.duration(a,'auto',route,erank)*i/300,route,erank),rad=p.angle*Math.PI/180,hw=a.width*p.sx/2,hh=a.height*p.sy/2;
         const ex=Math.abs(Math.cos(rad))*hw+Math.abs(Math.sin(rad))*hh,ey=Math.abs(Math.sin(rad))*hw+Math.abs(Math.cos(rad))*hh,y=route.ground-a.height*p.sy/2-p.lift;
         bounded&&=p.x-ex>=F.boundary.border.right+F.boundary.frame/2+9&&p.x+ex<=L.width-8&&y-ey>=L.top&&y+ey<=L.height-L.bottom;
        }
        enemies.push({id:a.id,rank:erank,speed,travel,start,end,expectedStart:route.start,expectedEnd:route.stage,impact,passes:impact/(F.spacing/F.speed),bounded,attackUnchanged:JSON.stringify(M.sample(a,'attack',.3,route,erank))===JSON.stringify(M.sample(a,'attack',.3,route,0)),fairySpeed:F.speed});
       }
      }
      rows.push({gardenSize,actual:s.flowerGrowth.entries.size,rank,speed:F.speed,moved,time:F.elapsed-e,same,length:F.length,spacing:F.spacing,lap:F.length/F.speed,gap:F.spacing/F.speed,enemies});
     }
    }
    if(c){choose('enemy-character','3_caterpillar');choose('enemy-motion-mode','auto');choose('enemy-speed',0);}
    choose('fairy-speed',0);return rows;
   });
   for(const row of matrix){
    assert.equal(row.actual,row.gardenSize);assert.equal(row.speed,row.rank===0?40:80);
    assert.ok(Math.abs(row.moved-row.speed)<1e-6&&Math.abs(row.time-1)<1e-6&&row.same,JSON.stringify(row));
    assert.ok(row.spacing>=52-1e-6);
    for(const x of row.enemies){
     const expected=baseById[x.id]*(x.rank===0?1:1.5);
     assert.equal(x.speed,expected);assert.equal(x.fairySpeed,row.speed);
     assert.ok(Math.abs(x.start-x.expectedStart)<1e-6&&Math.abs(x.end-x.expectedEnd)<1e-6&&Math.abs((x.expectedStart-x.expectedEnd)/x.travel-expected)<1e-6&&x.attackUnchanged&&x.bounded&&x.passes>=1,JSON.stringify({garden:row.gardenSize,...x}));
    }
   }
   assert.ok(matrix[3].lap<=matrix[0].lap+1e-6);
   assert.ok(Math.abs(matrix[0].length-matrix[4].length)<1e-6);
   await page.selectOption('#fairy-speed','5');await page.selectOption('#garden-size','100');
   assert.equal(await page.locator('#fairy-speed').inputValue(),'5');
   if(name!=='hidden'){await page.selectOption('#enemy-speed','5');await page.selectOption('#garden-size','4');assert.equal(await page.locator('#enemy-speed').inputValue(),'5');}
   const panel=await page.locator('#movement-speed-controls').boundingBox();
   assert.ok(Math.abs(panel.width/canvas.width*960-226)<2&&Math.abs((panel.x-canvas.x)/canvas.width*960-724)<2);
   if(name==='default'||name==='fhd')await page.screenshot({path:join(out,'movement-speed-'+name+'.png'),scale:'device'});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
   assert.equal(await page.locator('#movement-speed-controls').isVisible(),false);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
   assert.equal(await page.locator('#movement-speed-controls').isVisible(),true);
   await page.evaluate(()=>window.__previewGame.scene.stop('Game'));
   await page.waitForFunction(()=>!document.getElementById('movement-speed-controls'));
   assert.deepEqual(errors,[]);report.push({name,matrix,pass:true});console.log('PASS',name, matrix.length);
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'movement-speed-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' movement speed configurations');
