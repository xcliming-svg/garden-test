(function () {
  'use strict';
  // Original SVGs use a 1000×1000 canvas. Each clip uses ONE fixed square
  // crop of its entire motion envelope, preserving proportions and motion.
  const clips = Object.freeze({
    daisy:      { file:'flower_1__bloom', crop:[148,128,704], size:16, fps:4 },
    tulip:      { file:'flower_2__bloom', crop:[148,128,704], size:16, fps:4 },
    sunflower:  { file:'flower_3__bloom', crop:[148,128,704], size:16, fps:4 },
    hydrangea:  { file:'flower_4__bloom', crop:[148,128,704], size:16, fps:4 },
    person1:    { file:'person_1__walk', crop:[120,116,768], size:24, fps:8 },
    person2:    { file:'person_2__walk', crop:[120,116,768], size:24, fps:8 },
    bird1:      { file:'bird_1__walk_flap', crop:[132,124,752], size:20, fps:8 },
    bird2:      { file:'bird_2__walk_flap', crop:[124,104,788], size:20, fps:8 },
    bug1:       { file:'bug_1__legs', crop:[140,172,724], size:16, fps:8 },
    bug2:       { file:'bug_2__legs', crop:[132,132,736], size:18, fps:8 },
    caterpillar:{ file:'caterpillar__crawl', crop:[128,124,740], size:18, fps:6 },
    grasshopper:{ file:'grasshopper__jump', crop:[132,164,640], size:18, fps:6 },
    moth:       { file:'moth__flap', crop:[112,116,784], size:20, fps:8 },
    rabbit:     { file:'rabbit__hop', crop:[116,72,776], size:24, fps:6 },
    snail:      { file:'snail__feelers', crop:[108,116,768], size:18, fps:4 }
  });
  const enemies = Object.freeze(['bird1','bird2','bug1','bug2','caterpillar','grasshopper','moth','rabbit','snail']);
  const frames = 4, sourceScale = 4;
  const key = (name,i) => 'garden-svg:' + name + ':' + i;
  const animKey = name => 'garden-loop:' + name;
  function preload(scene) {
    for (const [name,clip] of Object.entries(clips)) {
      for (let i=0;i<frames;i++) {
        const url='./assets/animation/'+clip.file+'__'+String(i).padStart(3,'0')+'.svg';
        scene.load.svg(key(name,i),url,{width:250,height:250});
      }
    }
  }
  function install(scene) {
    for (const [name,clip] of Object.entries(clips)) {
      if (scene.anims.exists(animKey(name))) continue;
      const [x,y,side]=clip.crop.map(v=>v/sourceScale);
      for (let i=0;i<frames;i++) {
        if (!scene.textures.exists(key(name,i))) throw Error('Missing SVG frame '+key(name,i));
        const t=scene.textures.get(key(name,i));
        if (!t.has('art')) t.add('art',0,x,y,side,side);
        t.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      scene.anims.create({key:animKey(name),frames:Array.from({length:frames},(_,i)=>({key:key(name,i),frame:'art'})),frameRate:clip.fps,repeat:-1});
    }
  }
  function play(sprite,name,phase=0) {
    const clip=clips[name];
    if (!clip) throw Error('Unknown SVG clip '+name);
    if (sprite.getData('assetClip')!==name || !sprite.anims.isPlaying) {
      sprite.play({key:animKey(name),startFrame:phase%frames});
      sprite.setDisplaySize(clip.size,clip.size).setData('assetClip',name);
    }
    return sprite;
  }
  function sprite(scene,x,y,name,phase=0) {
    return play(scene.add.sprite(x,y,key(name,0),'art'),name,phase);
  }
  // Randomized, balanced assignment over the existing safe field anchors.
  // The first full cycle guarantees all nine species, even after shuffling.
  function enemyOrder(count,random=Math.random) {
    const order=Array.from({length:count},(_,i)=>enemies[i%enemies.length]);
    for (let i=order.length-1;i>0;i--) {
      const j=Math.floor(random()*(i+1));
      [order[i],order[j]]=[order[j],order[i]];
    }
    return order;
  }
  window.GardenAnimatedAssets=Object.freeze({clips,enemies,frames,key,animKey,preload,install,play,sprite,enemyOrder});
}());
