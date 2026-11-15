(function(){
  'use strict';
  // Hand-authored botanical operations in the ORIGINAL SVG artboard coordinates.
  // Paths are retained with their original colors and transforms; hide removes
  // a complete original part, cuts remove an attached leaf/petal or split a bud.
  // No SVG derivatives, low-resolution pixels, random erosion, or new artwork.
  const plans={
    daisy:[
      {cuts:['500,794 532,758 563,718 1000,690 1000,850 544,850 518,834']},
      {cuts:['514,757 582,709 646,699 1000,690 1000,870 585,870 523,816']},
      {cuts:['536,700 620,640 1000,550 1000,872 638,870 546,798','455,239 484,295 478,326 506,359 518,300 510,230']},
      {hide:[0,4],severe:{curves:['M0 0 H397 L435 348 Q390 393 358 445 L0 435 Z','M1000 430 H683 Q672 480 679 529 Q679 590 659 615 L1000 668 Z']}}
    ],
    sunflower:[
      {cuts:['503,786 535,730 600,680 1000,660 1000,824 550,815 515,800']},
      {hide:[2]},
      {hide:[2],cuts:['600,363 576,425 590,448 563,495 612,470 657,390']},
      {cuts:['0,80 444,80 455,318 390,350 316,404 240,423 0,383'],severe:{hide:[2],cuts:['1000,120 664,120 650,315 685,360 705,416 1000,460','1000,775 687,756 614,686 564,716 594,900 1000,900']}}
    ],
    tulip:[
      {cuts:['380,500 640,500 613,675 543,654 524,682 493,645 470,660 415,645']},
      {cuts:['0,405 464,405 488,658 446,704 407,750 0,753']},
      {cuts:['532,718 613,645 1000,430 1000,860 660,863 553,793','450,178 529,178 517,298 539,333 502,401 511,330 484,298']},
      {hide:[1],curves:['M0 0 H335 V286 C322 408 310 493 354 598 Q377 698 435 828 L0 940 Z'],severe:{hide:[0],curves:['M1000 0 H676 V286 C689 408 700 493 651 598 Q624 698 565 828 L1000 940 Z']}}
    ],
    hydrangea:[
      {cuts:['0,650 464,650 483,755 492,791 472,810 0,821']},
      {cuts:['505,657 539,590 550,490 1000,490 1000,665 567,689 540,707','516,752 570,718 1000,704 1000,839 574,839 526,805']},
      {hide:[3,5],cuts:['535,740 630,675 1000,640 1000,870 630,870 551,807']},
      {hide:[2],curves:['M0 0 H492 V178 Q461 235 471 286 Q489 338 456 379 Q438 417 389 439 Q352 458 329 495 Q268 467 221 480 Q160 490 129 457 L0 458 Z'],severe:{hide:[4,7],curves:['M1000 0 H641 V153 Q641 243 611 301 Q590 361 625 401 Q566 432 566 483 Q563 542 600 578 Q635 604 680 593 Q701 657 770 664 L1000 676 Z']}}
    ],
    rose:[
      {cuts:['510,762 541,715 1000,650 1000,830 552,825 519,801']},
      {cuts:['0,485 444,485 472,644 448,681 0,679','520,775 571,729 1000,677 1000,850 580,846 531,816']},
      {cuts:['530,788 622,728 1000,665 1000,907 650,903 548,850','352,220 449,220 468,361 452,407 495,470 442,425 429,383']},
      {hide:[0,6],severe:{hide:[2,5]}}
    ],
    lavender:[
      {cuts:['0,620 475,620 487,742 504,785 481,814 0,824']},
      {cuts:['525,739 577,648 634,570 1000,570 1000,850 610,850 541,813']},
      {hide:[4,7,9],cuts:['0,330 365,330 367,595 302,653 0,660','553,772 625,716 1000,655 1000,870 648,867 562,823']},
      {hide:[1,4,6],curves:['M0 250 H350 V520 Q350 600 396 675 Q360 712 338 750 L0 750 Z'],severe:{hide:[2,7,8],curves:['M1000 250 H650 V520 Q650 600 604 675 Q640 712 662 750 L1000 750 Z']}}
    ]
  };
  function parse(source){
    const doc=new DOMParser().parseFromString(source,'image/svg+xml'),root=doc.documentElement;
    if(root.localName!=='svg'||root.getAttribute('viewBox')!=='0 0 1000 1000')throw Error('Invalid original flower SVG');
    // The supplied originals contain only filled paths and nested translate/scale groups.
    const parts=[];
    function walk(node,matrix){
      const m=matrix.translate(0,0);
      const transform=node.getAttribute('transform')||'';
      for(const match of transform.matchAll(/(translate|scale)\(([^)]+)\)/g)){
        const [x,y]=match[2].trim().split(/[ ,]+/).map(Number);
        if(match[1]==='translate')m.translateSelf(x,y??0);
        else m.scaleSelf(x,y??x);
      }
      if(node.localName==='path'){
        parts.push({path:new Path2D(node.getAttribute('d')),fill:node.getAttribute('fill'),matrix:m});
      }else for(const child of node.children)walk(child,m);
    }
    walk(root,new DOMMatrix());
    if(!parts.length)throw Error('Empty original flower SVG');
    return parts;
  }
  function draw(ctx,parts,name,stage,hp,size){
    const plan=plans[name]?.[stage-1];
    if(!plan||!(hp===100||(stage===4?[66,33]:[50]).includes(hp)))throw Error('Invalid flower damage state');
    const light=hp===100?{}:plan, severe=hp===33?plan.severe:null;
    const hide=new Set([...(light.hide||[]),...(severe?.hide||[])]);
    for(const i of hide)if(!parts[i])throw Error('Missing original flower path: '+name+':'+stage+':'+i);
    const scale=size/1000;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,size,size);
    ctx.globalCompositeOperation='source-over';
    parts.forEach(({path,fill,matrix:m},i)=>{
      if(hide.has(i))return;
      ctx.setTransform(scale*m.a,scale*m.b,scale*m.c,scale*m.d,scale*m.e,scale*m.f);
      ctx.fillStyle=fill;ctx.fill(path);
    });
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';
    for(const points of [...(light.cuts||[]),...(severe?.cuts||[])]){
      const polygon=new Path2D();
      points.split(' ').forEach((pair,i)=>{const [x,y]=pair.split(',').map(Number);if(i)polygon.lineTo(x,y);else polygon.moveTo(x,y);});
      polygon.closePath();ctx.fill(polygon);
    }
    for(const d of [...(light.curves||[]),...(severe?.curves||[])])ctx.fill(new Path2D(d));
    ctx.restore();
  }
  window.GardenFlowerDamage=Object.freeze({parse,draw,plans});
}());
