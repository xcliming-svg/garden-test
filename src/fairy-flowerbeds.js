(function(){
  'use strict';
  const enabled=typeof document!=='undefined'&&document.documentElement.dataset.playable==='true'&&!window.GardenSimulationConfig&&!window.__gardenSimHarness&&!window.GardenFlowerCarryDisabled&&!window.GardenFairyFlowerbedsDisabled;
  const recipes=Object.freeze([
    ['rock','돌멩이',{daisy:8}],['boomerang','부메랑',{sunflower:8}],['paper-plane','종이비행기',{tulip:8}],['balloon','물풍선',{hydrangea:8}],['flowerpot','화분',{rose:8}],['broom','빗자루',{lavender:8}],
    ['bouncy-ball','탱탱볼',{tulip:4,hydrangea:4}],['wheel','바퀴',{sunflower:4,rose:4}],['yellow-floor','끈끈이',{sunflower:4,lavender:4}],['sprinkler','스프링클러',{hydrangea:4,lavender:4}]
  ].map(([id,label,needs])=>Object.freeze({id,label,needs:Object.freeze(needs)})));
  const byId=new Map(recipes.map(r=>[r.id,r]));
  const beds=Object.freeze(Array.from({length:9},(_,i)=>{
    const x=i%3*3,y=Math.floor(i/3)*3,center=(y+1)*9+x+1;
    return Object.freeze({id:i,center,ring:Object.freeze(Array.from({length:9},(_,j)=>(y+Math.floor(j/3))*9+x+j%3).filter(c=>c!==center))});
  }));
  const rings=new Set(beds.flatMap(b=>b.ring)),centers=new Set(beds.map(b=>b.center));
  const initial=Object.freeze(beds[4].ring.map(id=>Object.freeze([id,'daisy'])));
  const candidates=occupied=>new Set([...rings].filter(id=>!occupied.has(id)));
  const canPlant=(entries,id,name)=>rings.has(id)&&entries.get(id)?.name!==name;
  function counts(bed,entries,mature=true){
    const c={};for(const id of bed.ring){const f=entries.get(id);if(f&&(!mature||f.stage===3))c[f.name]=(c[f.name]||0)+1;}return c;
  }
  const matching=(recipe,c)=>Object.entries(recipe.needs).reduce((sum,[name,n])=>sum+Math.min(n,c[name]||0),0);
  const resolve=(bed,entries)=>{const c=counts(bed,entries);return recipes.find(r=>matching(r,c)===8)||null;};
  function create(){
    const state=beds.map(b=>({bed:b,weapon:b.id===4?'rock':null,power:0,ready:null}));
    function sync(entries){
      for(const s of state){
        const match=resolve(s.bed,entries);
        if(!s.weapon&&match)s.weapon=match.id;
        s.power=s.weapon?matching(byId.get(s.weapon),counts(s.bed,entries))/8:0;
        s.ready=match&&match.id!==s.weapon?match.id:null;
      }
      return state;
    }
    function confirm(cell,entries){
      sync(entries);const s=state.find(s=>s.bed.center===cell);
      if(!s?.ready)return false;s.weapon=s.ready;sync(entries);return true;
    }
    return {state,sync,confirm};
  }
  function attach(scene,spec){
    if(!enabled)return null;
    const model=create(),g=spec.garden,U=window.GardenUI,F=window.GardenFairyPatrol,I=window.GardenItemCards,R=window.GardenRunRules;
    const color={daisy:0xeee9dc,sunflower:0xe8c04d,tulip:0xe58da2,hydrangea:0x83acd8,rose:0xd96b76,lavender:0xad8cd7};
    const point=id=>({x:g.x+(id%9)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(id/9)*g.pitch+g.line+g.cell/2});
    const frame=scene.add.graphics().setDepth(R.depth.soil+.1).setName('flowerbed-frames');
    const visual=model.state.map(s=>{
      const p=point(s.bed.center),image=scene.add.image(p.x,p.y,F.key('water','normal')).setDisplaySize(g.cell,g.cell).setDepth(R.depth.fairy).setName('flowerbed-fairy:'+s.bed.id).setVisible(false);
      const label=U.text(scene,p.x,p.y+g.cell*.48,'',9,U.C.text,{originX:.5,originY:.5,inkAlign:'center'}).setDepth(R.depth.fairy+.2).setName('flowerbed-power:'+s.bed.id);
      return {image,label,icon:null,weapon:null,p};
    });
    const panel=U.text(scene,12,spec.top+10,'요정 조합 (만개 8송이)\n'+recipes.map(r=>Object.entries(r.needs).map(([n,v])=>({daisy:'데이지',sunflower:'해바라기',tulip:'튤립',hydrangea:'수국',rose:'장미',lavender:'라벤더'}[n])+v).join(' + ')+' → '+r.label).join('\n')+'\n중앙 SPACE : 요정 변경',11,U.C.muted,{originX:0,originY:0,inkAlign:'left'}).setDepth(R.depth.blueprintText).setName('flowerbed-recipes');
    let signature='';
    function refresh(){
      model.sync(scene.flowerGrowth.entries);
      const sig=model.state.map(s=>[s.weapon,s.power,s.ready,JSON.stringify(counts(s.bed,scene.flowerGrowth.entries,false))].join(':')).join('|');
      if(signature===sig)return;signature=sig;frame.clear();
      for(const s of model.state){
        const v=visual[s.bed.id],p=v.p,recipe=byId.get(s.weapon),tint=recipe?color[Object.keys(recipe.needs)[0]]:0x66705e;
        frame.lineStyle(1.5,s.ready?0xffffff:tint,s.weapon?.85:.45).strokeRect(p.x-1.5*g.pitch+1,p.y-1.5*g.pitch+1,3*g.pitch-2,3*g.pitch-2);
        frame.fillStyle(0x303830,.85).fillRect(p.x-g.cell/2,p.y-g.cell/2,g.cell,g.cell);
        if(v.weapon!==s.weapon){
          if(v.icon)I.destroyRelic(v.icon);v.icon=null;v.weapon=s.weapon;
          if(s.weapon)v.icon=I.weaponImage(scene,s.weapon,p.x+g.cell*.35,p.y-g.cell*.35,g.cell*.58).setDepth(R.depth.fairy+.1).setName('flowerbed-weapon:'+s.bed.id);
        }
        v.image.setVisible(!!s.weapon).setAlpha(s.power>0?1:.25);
        v.icon?.setAlpha(s.power>0?1:.25);
        const c=s.bed.ring.filter(id=>scene.flowerGrowth.entries.get(id)?.stage===3).length;
        v.label.setText(s.ready?'SPACE':s.weapon?Math.round(s.power*100)+'%':c+'/8');
      }
    }
    function actors(){
      refresh();return model.state.filter(s=>s.weapon&&s.power>0).map(s=>({index:100+s.bed.id,type:'fixed',center:point(s.bed.center),visibleHeight:g.cell,weapon:s.weapon,power:s.power}));
    }
    function confirm(id){const ok=model.confirm(id,scene.flowerGrowth.entries);if(ok){signature='';refresh();}return ok;}
    scene.fairyFlowerbeds={model,refresh,actors,confirm,point};
    scene.events.on('update',refresh);
    scene.events.once('shutdown',()=>{scene.events.off('update',refresh);delete scene.fairyFlowerbeds;});
    refresh();return scene.fairyFlowerbeds;
  }
  window.GardenFairyFlowerbeds=Object.freeze({enabled,recipes,beds,rings,centers,initial,candidates,canPlant,counts,matching,resolve,create,attach});
}());
