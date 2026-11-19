// Measured geometry search after failed reference gate; live settings untouched.
import {loadModels} from '../models.mjs';
import {evaluate,assess,protocol} from './early-pace-search.mjs';
export const measuredProtocol={
  train:{seed:12101,runs:16,agents:['beginner','normal','expert'],dt:.05,keep:4},
  validate:{seed:14101,runs:24,agents:['beginner','normal','expert'],dt:.05,keep:2},
  fine:{seed:15101,runs:16,agents:['normal'],dt:.025,keep:1}
};
export function candidates(map,p){
  const a=[];
  const add=(interval,cap,batch,flower,item,cooldown)=>a.push({interval,cap,batch,flower,item,cooldown});
  if(map==='classic')for(const flower of [.095,.10,.11])for(const item of [.055,.065,.075])for(const cooldown of [25,35])add(1.5,5,1,flower,item,cooldown);
  if(map==='cross')for(const interval of [2.5,2.75,3])for(const flower of [.09,.10,.11])for(const item of [.05,.07])add(interval,8,2,flower,item,25);
  if(map==='heart')for(const flower of [.085,.09,.095,.10])for(const item of [.045,.055,.065])for(const cooldown of [25,35])add(2,8,2,flower,item,cooldown);
  return [...new Map([p,...a].map(x=>[JSON.stringify(x),x])).values()];
}
const small=({rows,...r})=>r;
export function measuredSearch(sources,geometry,map,phase,previous,initial){
  const w=loadModels(sources),q=measuredProtocol[phase];
  const ps=phase==='train'?candidates(map,initial):previous.selected;
  const opts=agent=>({seed:q.seed,runs:q.runs,dt:q.dt,agent,geometry});
  const bases=q.agents.map(agent=>evaluate(sources,w,map,null,opts(agent)));
  const results=ps.map(p=>{
    const policies=q.agents.map((agent,i)=>{const r=evaluate(sources,w,map,p,opts(agent));return {...small(r),assessment:assess(map,r,bases[i])};});
    const pass=policies.every(r=>r.assessment.pass),score=Math.max(...policies.map(r=>r.assessment.score));
    return {p,pass,score,policies};
  }).sort((a,b)=>a.score-b.score||JSON.stringify(a.p).localeCompare(JSON.stringify(b.p)));
  const selected=(phase==='train'?results:results.filter(x=>x.pass)).slice(0,q.keep).map(x=>x.p);
  return {map,phase,seed:q.seed,runs:q.runs,dt:q.dt,bases:bases.map(small),results,selected,simulations:(ps.length+1)*q.runs*q.agents.length};
}
