// Type 1 only: apply font styling at creation, before pixel alignment and width measurement.
(function(){
  'use strict';
  const t=window.TerrainPreviewTheme;if(!t?.noTextShadow)return;
  const factory=Phaser.GameObjects.GameObjectFactory.prototype;
  const original=factory.text;
  const semantic=c=>c===t.green?t.positiveText:c===t.red?t.negativeText:c;
  factory.text=function(x,y,content,style={}){
    const key=this.scene.sys.settings.key;
    let color=semantic(style.color);
    // Dark menu/codex surfaces need light ink; HUD and all light panels use brown ink.
    if((key==='MainMenu'&&y>31&&y<509&&x!==0)||(key==='Codex'&&(content==='맵 도감'||content==='맵 도감 콘텐츠 미구현')))color=t.darkSurfaceText;
    if(key==='Game'&&content==='테스트 이미지')color=t.fieldText;
    if((key==='Game'&&content==='도안')||(key==='Pause'&&content==='일시정지')||(key==='Settings'&&content==='설정')||(key==='Codex'&&content==='도감')||(key==='Confirm'&&content==='메인 메뉴로 돌아가시겠습니까?')||((key==='Victory'||key==='Defeat')&&(content==='성공'||content==='실패')))color=t.titleText;
    const item=original.call(this,x,y,content,{...style,color,shadow:{offsetX:0,offsetY:0,color:'rgba(0,0,0,0)',blur:0,stroke:false,fill:false}});
    const setColor=item.setColor;
    item.setColor=function(value){return setColor.call(this,semantic(value));};
    return item;
  };
}());
