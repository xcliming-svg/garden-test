// Report distributions without equating them with subjective fun.
export function distribution(values){
  const a=values.filter(x=>typeof x==='number'&&Number.isFinite(x)).sort((a,b)=>a-b);
  if(!a.length)return {n:0,mean:null,p10:null,p50:null,p90:null,p95:null,min:null,max:null};
  const q=p=>a[Math.max(0,Math.ceil(a.length*p)-1)];
  return {n:a.length,mean:a.reduce((s,x)=>s+x,0)/a.length,p10:q(.1),p50:q(.5),p90:q(.9),p95:q(.95),min:a[0],max:a.at(-1)};
}
export function wilson(wins,n){
  if(!n)return null;const z=1.959963984540054,p=wins/n,d=1+z*z/n,mid=(p+z*z/(2*n))/d,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
  return [Math.max(0,mid-half),Math.min(1,mid+half)];
}
export function summarize(rows){
  const wins=rows.filter(r=>r.result==='victory'),defeats=rows.filter(r=>r.result==='defeat'),timeouts=rows.filter(r=>r.result==='timeout');
  const metrics={};
  for(const key of ['seconds','progress','kills','actualDps','firstKill','firstUsableFlower','firstItem','maxProgressGap','maxChoiceGap','maxOpportunityGap','lastCellWait','flowersLost','purchases','gems','flowerDamage','flowerHeal','overheal','defensePrevented','peakEnemies','offeredSeconds'])metrics[key]=distribution(rows.map(r=>r[key]));
  return {runs:rows.length,wins:wins.length,defeats:defeats.length,timeouts:timeouts.length,winRate:rows.length?wins.length/rows.length:null,winRate95:wilson(wins.length,rows.length),winTime:distribution(wins.map(r=>r.seconds)),metrics};
}
export function compact(row){const {timeline,events,actions,...r}=row;return r;}
