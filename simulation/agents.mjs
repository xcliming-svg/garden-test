// Deterministic policies, not calibrated human skill or an enjoyment score.
export const PROFILES=Object.freeze({
  idle:{reaction:1,drag:.4,mistake:0,style:'idle'},
  random:{reaction:1,drag:.5,mistake:1,style:'random'},
  beginner:{reaction:3,drag:.9,mistake:.18,style:'balanced'},
  normal:{reaction:1.5,drag:.55,mistake:.04,style:'balanced'},
  expert:{reaction:.5,drag:.3,mistake:0,style:'expert'},
  'garden-first':{reaction:1,drag:.5,mistake:0,style:'garden'},
  'combat-first':{reaction:1,drag:.5,mistake:0,style:'combat'},
  'economy-first':{reaction:1,drag:.5,mistake:0,style:'economy'},
  'rock-only':{reaction:1,drag:.5,mistake:0,style:'rock'},
  'speed-first':{reaction:1,drag:.5,mistake:0,style:'speed'},
  'diverse':{reaction:1,drag:.5,mistake:0,style:'diverse'}
});
export function makeAgent(profile,random){
  const p=profile;let nextAt=0,pending=null;
  const pick=items=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
  function score(item,obs){
    if(!item)return 0;
    const s=item.stats||{},pressure=obs.flowers.some(f=>f.healthBand<=2);
    const d=s.dps||0,def=s.defense||0,mov=s.moveSpeed||0;
    return d+def*(pressure?2.4:1.1)+mov*.36+(item.id==='yellow-floor'?5:0)+(item.id==='water-fairy'?2:0);
  }
  function plan(o){
    const opts=[],needed=new Map(o.blueprint.map(x=>[x.cell,x.name]));
    const live=new Set(o.flowers.map(x=>x.cell));
    const itemCards=o.cards.filter(c=>c.kind==='item');
    for(const c of o.cards){
      if(c.kind==='flower'){
        const cells=p.style==='random'||random()<p.mistake?c.validCells:c.matchingCells;
        for(const cell of cells){
          let weight=needed.get(cell)===c.name?40:-7;
          if(p.style==='garden')weight+=30;
          if(p.style==='expert'){
            const x=cell%10,y=Math.floor(cell/10);
            for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
              const nx=x+dx,ny=y+dy,n=ny*10+nx;
              if(nx>=0&&nx<10&&ny>=0&&ny<10&&needed.has(n)&&!live.has(n))weight+=4;
            }
          }
          opts.push({start:{type:'DRAG_START',cardId:c.id},end:{type:'DRAG_END',cell},weight:weight+c.age*.08});
        }
      }else{
        if(p.style==='rock'&&c.item.id!=='rock')continue;
        for(let slot=0;slot<o.slotCount;slot++){
          const item=c.slotItems?.[slot]||c.item,old=o.gear[slot];
          let diff=score(item,o)-score(old,o);
          if(p.style==='speed')diff+=(item.id==='shoe'?18:0)-(old?.id==='shoe'?18:0);
          if(p.style==='diverse'&&item.id!==old?.id){const duplicates=o.gear.filter((i,j)=>j!==slot&&i?.id===item.id).length;diff-=duplicates*5;}
          if(item.id===old?.id&&item.level>old?.level)diff+=4;
          const next=o.gear.slice();next[slot]=item;
          if(!next.some(i=>(i?.stats?.dps||0)>0))continue;
          if(p.style!=='random'&&diff<=.15)continue;
          opts.push({start:{type:'DRAG_START',cardId:c.id},end:{type:'DRAG_END',slot},weight:20+diff+(p.style==='combat'?45:0)+(old?0:8)+c.age*.06});
        }
      }
    }
    if(o.price!==null&&o.gems>=o.price){
      const full=o.gear.every(Boolean);
      if(p.style==='random'||p.style==='economy'||full&&itemCards.length)
        opts.push({start:{type:'BUY_SLOT'},weight:p.style==='economy'?100:full?65:3});
    }
    for(const f of o.blueprint)if(f.status==='wrong')opts.push({start:{type:'UPROOT_START',cell:f.cell},weight:45+(p.style==='garden'?20:0)});
    if(!opts.length)return null;
    if(p.style==='random'||random()<p.mistake)return pick(opts);
    opts.sort((a,b)=>b.weight-a.weight||((a.start.cardId??-1)-(b.start.cardId??-1)));
    return opts[0].weight<0?null:opts[0];
  }
  function next(o){
    if(p.style==='idle'||o.finished)return null;
    if(o.time+1e-7<nextAt)return null;
    if(pending){const end=pending;pending=null;nextAt=o.time+p.reaction;return o.drag?end:null;}
    if(o.hold||o.drag){nextAt=o.time+Math.min(p.reaction,.25);return null;}
    const action=plan(o);
    if(!action){nextAt=o.time+p.reaction;return null;}
    if(action.end){pending=action.end;nextAt=o.time+p.drag;}
    else nextAt=o.time+p.reaction;
    return action.start;
  }
  next.ready=time=>p.style!=='idle'&&time+1e-7>=nextAt;
  return next;
}
export function profileFor(name,overrides={}){
  if(!Object.hasOwn(PROFILES,name))throw Error('Unknown agent '+name);
  for(const k of Object.keys(overrides))if(!['reaction','drag','mistake'].includes(k))throw Error('Unknown agent option '+k);
  const p={...PROFILES[name],...overrides};
  for(const k of ['reaction','drag'])if(!Number.isFinite(p[k])||p[k]<=0||p[k]>120)throw Error('Invalid agent '+k);
  if(!Number.isFinite(p.mistake)||p.mistake<0||p.mistake>1)throw Error('Invalid agent mistake');
  return p;
}
export function play(engine,profile){
  const agent=makeAgent(profile,engine.streams.agent);
  while(!engine.finished){
    if(agent.ready(engine.time)){const a=agent(engine.observe());if(a)engine.dispatch(a);}
    engine.step();
  }
  return engine.result();
}
