(function(){
  'use strict';
  // Approved 10 weapons + shoe + shield: 78 unordered two-card combinations.
  // Solo weapons retain the exact existing attack geometry and balance settings.
  const weapons=Object.freeze(['rock','paper-plane','balloon','boomerang','wheel','flowerpot','bouncy-ball','yellow-floor','sprinkler','broom']);
  const supports=Object.freeze(['shoe','shield']);
  const ids=Object.freeze([...weapons,...supports]);
  const key=(a,b)=>[a,b].sort().join('|');
  // [item1,item2,display name,original base weapon,mechanical fusion]
  // Fusion methods use the original weapon's SVG, span and base collision model.
  const rows=[
    ['rock','rock','삼각 투석','rock',{volley:3}],
    ['rock','paper-plane','유도 돌멩이','rock',{homing:true}],
    ['rock','balloon','파열 돌멩이','rock',{impact:'splash'}],
    ['rock','boomerang','중량 부메랑','boomerang',{impact:'stones'}],
    ['rock','wheel','가시 바퀴','wheel',{impact:'stones'}],
    ['rock','flowerpot','자갈 화분','flowerpot',{impact:'stones'}],
    ['rock','bouncy-ball','도약 돌멩이','bouncy-ball',{visual:'rock',impact:'stones'}],
    ['rock','yellow-floor','점착 돌멩이','rock',{impact:'glue'}],
    ['rock','sprinkler','자갈 분사기','sprinkler',{impact:'stones'}],
    ['rock','broom','자갈 쓸기','broom',{impact:'stones'}],
    ['paper-plane','paper-plane','3기 편대','paper-plane',{volley:3}],
    ['paper-plane','balloon','유도 물폭탄','paper-plane',{impact:'splash'}],
    ['paper-plane','boomerang','귀환 비행기','paper-plane',{returning:true}],
    ['paper-plane','wheel','회전날개 비행기','paper-plane',{pierce:true,spin:true}],
    ['paper-plane','flowerpot','폭격 비행기','paper-plane',{impact:'pot'}],
    ['paper-plane','bouncy-ball','연쇄 비행기','paper-plane',{chainMax:3}],
    ['paper-plane','yellow-floor','점착 비행기','paper-plane',{impact:'glue'}],
    ['paper-plane','sprinkler','살수 비행기','paper-plane',{trail:'water'}],
    ['paper-plane','broom','바람 비행기','paper-plane',{impact:'push'}],
    ['balloon','balloon','세 갈래 물폭탄','balloon',{volley:3}],
    ['balloon','boomerang','물보라 부메랑','boomerang',{trail:'water'}],
    ['balloon','wheel','물바퀴','wheel',{trail:'water'}],
    ['balloon','flowerpot','물화분','flowerpot',{impact:'splash'}],
    ['balloon','bouncy-ball','통통 물풍선','bouncy-ball',{impact:'splash'}],
    ['balloon','yellow-floor','점착 웅덩이','balloon',{impact:'glue'}],
    ['balloon','sprinkler','분수 물폭탄','balloon',{impact:'spray'}],
    ['balloon','broom','물걸레 공격','broom',{impact:'splash'}],
    ['boomerang','boomerang','삼중 부메랑','boomerang',{volley:3}],
    ['boomerang','wheel','귀환 바퀴','wheel',{returning:true}],
    ['boomerang','flowerpot','낙하 부메랑','boomerang',{impact:'pot'}],
    ['boomerang','bouncy-ball','반사 부메랑','bouncy-ball',{visual:'boomerang',returning:true}],
    ['boomerang','yellow-floor','점착 부메랑','boomerang',{trail:'glue'}],
    ['boomerang','sprinkler','살수 부메랑','boomerang',{trail:'water',impact:'spray'}],
    ['boomerang','broom','회전 빗자루','boomerang',{visual:'broom',impact:'push'}],
    ['wheel','wheel','교차 바퀴','wheel',{volley:2}],
    ['wheel','flowerpot','굴러가는 화분','wheel',{impact:'pot'}],
    ['wheel','bouncy-ball','도약 바퀴','wheel',{ricochet:true}],
    ['wheel','yellow-floor','점착 바퀴','wheel',{trail:'glue'}],
    ['wheel','sprinkler','이동식 스프링클러','wheel',{trail:'spray'}],
    ['wheel','broom','청소 바퀴','wheel',{impact:'push'}],
    ['flowerpot','flowerpot','삼중 낙하','flowerpot',{volley:3}],
    ['flowerpot','bouncy-ball','도약 화분','bouncy-ball',{visual:'flowerpot',impact:'stones'}],
    ['flowerpot','yellow-floor','점착 화분','flowerpot',{impact:'glue'}],
    ['flowerpot','sprinkler','분수 화분','flowerpot',{impact:'spray'}],
    ['flowerpot','broom','파편 쓸기','flowerpot',{impact:'push',scatter:true}],
    ['bouncy-ball','bouncy-ball','오연쇄 탱탱볼','bouncy-ball',{chainMax:5}],
    ['bouncy-ball','yellow-floor','점착 탱탱볼','bouncy-ball',{impact:'glue'}],
    ['bouncy-ball','sprinkler','물방울 탱탱볼','bouncy-ball',{impact:'splash'}],
    ['bouncy-ball','broom','스매시 탱탱볼','bouncy-ball',{impact:'push',speed:1.3}],
    ['yellow-floor','yellow-floor','넓은 끈끈이','yellow-floor',{sizeScale:1.5,slowBonus:.15}],
    ['yellow-floor','sprinkler','점착 분수','sprinkler',{impact:'glue'}],
    ['yellow-floor','broom','점착 쓸기','broom',{impact:'glue',push:true}],
    ['sprinkler','sprinkler','쌍회전 분수','sprinkler',{volley:2,opposite:true}],
    ['sprinkler','broom','회전 물청소','broom',{impact:'spray'}],
    ['broom','broom','양방향 쓸기','broom',{volley:2,opposite:true}]
  ];
  const lookup=new Map();
  for(const [a,b,name,base,properties] of rows){
    if(!weapons.includes(a)||!weapons.includes(b)||!weapons.includes(base))throw Error('Invalid fusion weapon');
    const k=key(a,b);
    if(lookup.has(k))throw Error('Duplicate fusion '+k);
    lookup.set(k,Object.freeze({key:k,ids:Object.freeze([a,b]),name,base,...properties}));
  }
  for(const weapon of weapons){
    for(const support of supports){
      const k=key(weapon,support);
      if(lookup.has(k))throw Error('Duplicate support fusion');
      lookup.set(k,Object.freeze({key:k,ids:Object.freeze([weapon,support]),
        name:(support==='shoe'?'고속 ':'방어 ')+weapon,base:weapon,
        speedBonus:support==='shoe'?1.35:1,defense:support==='shield'?6:0}));
    }
  }
  for(const [a,b,name] of [
    ['shoe','shoe','고속 순찰'],['shoe','shield','고속 방어 순찰'],['shield','shield','강화 방어']
  ]){
    const k=key(a,b);lookup.set(k,Object.freeze({key:k,ids:Object.freeze([a,b]),name,base:null,
      speedBonus:a==='shoe'&&b==='shoe'?1.8:a==='shoe'||b==='shoe'?1.35:1,
      defense:a==='shield'&&b==='shield'?12:a==='shield'||b==='shield'?6:0}));
  }
  if(lookup.size!==78||rows.length!==55)throw Error('Expected exactly 78 approved fairy pairs');
  function resolve(a,b){
    a=typeof a==='string'?a:a?.id||null;
    b=typeof b==='string'?b:b?.id||null;
    if(!a&&!b)return null;
    if(!a||!b){
      const id=a||b;
      if(!ids.includes(id))return null;
      return Object.freeze({key:id,ids:Object.freeze([id]),name:id,
        base:weapons.includes(id)?id:null,solo:true,speedBonus:1,defense:id==='shield'?6:0});
    }
    return lookup.get(key(a,b))||null;
  }
  window.GardenFairyCombinations=Object.freeze({ids,weapons,supports,key,lookup,resolve,rows:Object.freeze(rows.map(row=>Object.freeze(row)))});
}());
