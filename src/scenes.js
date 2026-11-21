(function () {
  'use strict';

  const U = window.GardenUI;
  // 24px 타일 기준 공통 960×540 좌표. 메뉴는 기능에 맞는 간격을 선택하고 주요 행동은 크게 표시한다.
  const menu = Object.freeze({ ...U.menuStyle, row: 40 });
  const { panelPadding: pad, headerHeight, sectionGap } = menu;
  const headerCenter = top => top + menu.strokeWidth + headerHeight / 2;
  const innerLeft = width => (U.W - width) / 2 + pad;
  const innerRight = width => (U.W + width) / 2 - pad;
  const footerCenter = bottom => bottom - pad - menu.buttonHeight / 2;
  const pairOffset = width => (width + menu.gap) / 2;
  function aligned(scene, x, y, label, size, color, align = 'left', background = U.C.panel) {
    return U.text(scene,x,y,label,size,color,{originX:align==='right'?1:align==='center'?0.5:0,originY:0.5,inkAlign:align,inkBackground:background});
  }
  function centered(scene, x, y, label, size, color, options = {}) {
    return U.text(scene, x, y, label, size, color, { ...options, originX: 0.5, originY: 0.5, inkAlign: 'center' });
  }
  const previewMode = new URLSearchParams(window.location.search).get('preview') === '1';

  // Temporary native selector: only the playable main menu owns this element.
  // Keep the existing new-game button coordinates and hide it on overlays.
  function attachBlueprintSelector(scene){
    const R=window.GardenRunRules;
    if(!R?.active||R.survival||window.GardenSimulationConfig?.blueprint||window.GardenSimulationConfig?.initial)return;
    const parent=scene.game.canvas.parentElement;
    const label=document.createElement('label'),select=document.createElement('select');
    label.id='blueprint-select-control';
    label.htmlFor='blueprint-select';
    label.textContent='스테이지 선택';
    Object.assign(label.style,{position:'absolute',left:'65%',top:'43%',width:'29%',zIndex:'5',color:'#ddd',display:'block'});
    select.id='blueprint-select';
    select.setAttribute('aria-label','시작 도안');
    Object.assign(select.style,{display:'block',width:'100%',marginTop:'4px',font:'inherit',background:'#202023',color:'#eee',border:'1px solid #777',padding:'4px'});
    const campaignGroup=document.createElement('optgroup'),legacyGroup=document.createElement('optgroup');
    campaignGroup.label='캠페인 01–50';legacyGroup.label='기존 도안 (비교용)';
    for(const p of R.catalog){
      const option=document.createElement('option');option.value=p.id;option.textContent=p.label+' ('+p.blueprint.length+'칸)';(p.stage?campaignGroup:legacyGroup).append(option);
    }
    if(campaignGroup.children.length)select.append(campaignGroup);select.append(legacyGroup);
    select.value=R.selectedBlueprintId;
    select.addEventListener('change',()=>R.selectBlueprint(select.value));
    label.append(select);parent.append(label);
    const resize=()=>{label.style.fontSize=Math.max(9,14*parent.clientWidth/960)+'px';};
    const hide=()=>{label.hidden=true;label.style.display='none';};
    const show=()=>{label.hidden=false;label.style.display='block';resize();};
    resize();window.addEventListener('resize',resize);
    scene.events.on('pause',hide);scene.events.on('resume',show);
    scene.events.once('shutdown',()=>{
      scene.events.off('pause',hide);scene.events.off('resume',show);
      window.removeEventListener('resize',resize);label.remove();
    });
  }

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
      // 외부 이미지·사운드가 없는 현재 단계에는 가짜 로딩 단계를 두지 않는다.
      this.scene.start('MainMenu');
    }
  }

  class MainMenuScene extends Phaser.Scene {
    constructor() { super('MainMenu'); }
    create() {
      U.background(this, 'MAIN MENU');
      centered(this, 480, 124, 'GARDEN', U.fontSize.menuTitle, U.C.text, { inkBackground: U.C.bg });
      centered(this, 480, 172, 'TEST', U.fontSize.menuTitle, U.C.text, { inkBackground: U.C.bg });
      centered(this, 480, 216, window.GardenRunRules?.active?'ROGUELIKE':'ROGUELIKE / SCENE STRUCTURE', U.fontSize.menuBase, U.C.muted, { inkBackground: U.C.bg });

      const x = U.W / 2;
      const w = 200;
      const first = 252;
      const step = menu.navHeight + menu.navGap;
      const nav = { height: menu.navHeight };
      attachBlueprintSelector(this);
      U.button(this, x, first, w, '새 게임', () => this.scene.start('Game'), { ...nav, primary: true });
      U.button(this, x, first + step, w, '이어하기 · 미구현', null, { ...nav, disabled: true });
      U.button(this, x, first + step * 2, w, '설정', () => U.openSubscene(this, 'Settings'), nav);
      U.button(this, x, first + step * 3, w, '도감', () => U.openSubscene(this, 'Codex'), nav);
      U.button(this, x, first + step * 4, w, '종료 · 웹 미지원', null, { ...nav, disabled: true });

      // 결과 씬 미리보기는 명시적인 개발용 URL에서만 나타난다.
      if (previewMode) {
        U.text(this, 792, 320, '개발용 결과 화면', U.fontSize.menuBase, U.C.muted, { originX: 0.5 });
        U.button(this, 792, 352, 168, '성공 화면', () => this.scene.start('Victory'), { height: 24, fontSize: U.fontSize.compact });
        U.button(this, 792, 352 + menu.buttonHeight + menu.gap, 168, '실패 화면', () => this.scene.start('Defeat'), { height: 24, fontSize: U.fontSize.compact });
      }
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    preload() { window.GardenFlowerGrowth.preload(this); window.GardenFairyPatrol.preload(this); window.GardenEnemyPreview.preload(this); window.GardenItemCards.preload(this); }

    create() {
      window.GardenGameLayout.draw(this);
      U.bindEscape(this, () => {
        this.scene.pause('Game');
        this.scene.launch('Pause');
      });
    }
  }

  class GardenShopScene extends Phaser.Scene {
    constructor(){super('GardenShop');this.selected='rock';}
    init(data){this.selected=data?.selected||'rock';}
    create(){
      const game=this.scene.get('Game'),economy=game?.gardenEconomy;
      if(!economy){this.scene.stop('GardenShop');this.scene.resume('Game');return;}
      U.overlay(this).setName('garden-shop-overlay');
      U.panel(this,480,270,760,450,{fill:U.C.panel,stroke:U.C.border}).setName('garden-shop-panel');
      U.panelHeader(this,480,46,760);
      U.text(this,122,64,'정원 상점',16,U.C.text,{originY:.5}).setName('garden-shop-title');
      U.button(this,812,66,76,'닫기',()=>this.close(),{height:26,fontSize:11}).setName('garden-shop-close');
      const products=window.GardenEconomy.products;
      const C=window.GardenGameLayout.colors;
      const positions=[];
      for(let i=0;i<products.length;i++){
        const x=198+(i%4)*185,y=135+Math.floor(i/4)*59;
        positions.push({x,y});
        const product=products[i];
        const owned=economy.state.owned.has(product.id);
        const selected=this.selected===product.id;
        const surface=U.pixelBox(this,x,y,174,52,selected?U.C.panelAlt:U.C.button,
          {border:selected?U.C.white:U.C.subtle}).setName('garden-shop-item:'+product.id);
        surface.setInteractive(new Phaser.Geom.Rectangle(-87,-26,174,52),Phaser.Geom.Rectangle.Contains);
        surface.input.cursor='pointer';
        surface.on('pointerdown',()=>this.scene.restart({selected:product.id}));
        // All icons use the original item SVG textures already loaded by Game.
        try{
          window.GardenItemCards.weaponImage(this,product.id,x-57,y,28)
            .setDepth(1).setName('garden-shop-icon:'+product.id);
        }catch(_error){
          // Preserve a usable text-based shop if one optional icon fails.
        }
        U.text(this,x-30,y-5,product.name,12,U.C.text,{originY:.5}).setName('garden-shop-label:'+product.id);
        U.text(this,x-30,y+13,!economy.available(product.id)?'꽃밭 '+product.unlock+'×'+product.unlock+' 필요':owned?'보유':'미보유',9,
          owned?U.C.green:U.C.muted,{originY:.5});
      }
      const state=economy.state;
      const expansion=economy.expansionCost();
      const canExpand=economy.affordable(expansion)&&state.plots.every(p=>p.phase==='growing');
      U.text(this,122,299,expansion?
        '꽃밭 일괄 확장  '+state.side*state.side+' → '+(state.side+1)**2+'  ·  꽃 4종 각각 ×'+expansion[0]:
        '꽃밭 최대 크기  25 × 4 = 100송이',11,U.C.text).setName('garden-expand-price');
      U.button(this,755,300,150,expansion?(canExpand?'전체 확장':'확장 대기'):'MAX',()=>{
        if(economy.expand())this.scene.restart({selected:this.selected});
      },{height:28,fontSize:11,disabled:!canExpand,primary:canExpand}).setName('garden-expand');
      U.text(this,122,326,window.GardenEconomy.labels.map((label,i)=>label+' '+state.plots[i].count).join('     '),11,U.C.text)
        .setName('garden-shop-wallet');
      U.rule(this,122,349,838,349,U.C.border,1);
      const product=products.find(p=>p.id===this.selected)||products[0];
      const owned=state.owned.has(product.id);
      U.text(this,122,357,product.name+'  ·  '+(!economy.available(product.id)?'잠금':owned?'강화':'구매'),13,U.C.text)
        .setName('garden-shop-detail-title');
      const formatCost=cost=>cost?cost.map((n,i)=>n?window.GardenEconomy.labels[i]+'×'+n:'').filter(Boolean).join('  '):'최대 강화';
      if(!owned){
        const cost=economy.cost(product.id,'buy');
        U.text(this,122,383,'최초 구매: '+formatCost(cost),11,U.C.text).setName('garden-shop-price');
        const unlocked=economy.available(product.id),valid=unlocked&&economy.affordable(cost);
        U.button(this,735,402,168,!unlocked?'확장 후 해금':valid?'구매':'꽃 부족',()=>{
          if(economy.buy(product.id))this.scene.restart({selected:product.id});
        },{height:32,disabled:!valid,primary:valid,fontSize:12}).setName('garden-shop-buy');
        U.text(this,122,428,'구매한 장비는 자동으로 적용되며 이후 이 자리에서 강화할 수 있습니다.',10,U.C.muted);
      }else{
        const sections=product.weapon?[
          ['power','위력','기본 공격 단계'],
          ['volley','다중 발사','투사체 추가'],
          ['speed','공격 속도','발사 간격 감소']
        ]:[['power',product.id==='shoe'?'이동 속도':'방어력','패시브 강화']];
        sections.forEach(([type,title,desc],i)=>{
          const x=122+i*242;
          const count=state.upgrades[product.id][type];
          const max=type==='power'&&product.weapon?2:3;
          U.text(this,x,380,title+'   '+count+'/'+max,11,U.C.text).setName('garden-shop-upgrade:'+type);
          U.text(this,x,398,desc,9,U.C.muted);
          const cost=economy.cost(product.id,type);
          U.text(this,x,417,formatCost(cost),9,U.C.text);
          const valid=economy.affordable(cost);
          U.button(this,x+78,458,156,cost?(valid?'강화':'꽃 부족'):'MAX',()=>{
            if(economy.upgrade(product.id,type))this.scene.restart({selected:product.id});
          },{height:29,disabled:!valid,fontSize:11,primary:valid});
        });
      }
      U.bindEscape(this,()=>this.close());
    }
    close(){this.scene.stop('GardenShop');this.scene.resume('Game');}
  }

  class PauseScene extends Phaser.Scene {
    constructor() { super('Pause'); }
    create() {
      U.overlay(this);
      U.panel(this, 480, 270, 240, 242, { fill: U.C.panel, stroke: U.C.border });
      U.panelHeader(this, 480, 149, 240);
      centered(this, 480, headerCenter(149), '일시정지', U.fontSize.menuHeading, U.C.text, { inkBackground: U.C.header });
      centered(this, 480, 195, '게임 화면은 중단된 상태입니다.', U.fontSize.menuBase, U.C.muted);
      U.rule(this, innerLeft(240), 208, innerRight(240), 208, U.C.border, 1);
      const first = 208 + pad + menu.buttonHeight / 2;
      const step = menu.navHeight + menu.navGap;
      const nav = { height: menu.navHeight };
      U.button(this, 480, first, 200, '계속하기', () => this.resumeGame(), { ...nav, primary: true });
      if(window.GardenRunRules?.active)U.button(this,480,first+step,200,'재시작',()=>{this.scene.stop('Game');this.scene.start('Game');},nav);
      else U.button(this, 480, first + step, 200, '재시작 · 미구현', null, { ...nav, disabled: true });
      U.button(this, 480, first + step * 2, 200, '설정', () => U.openSubscene(this, 'Settings'), nav);
      U.button(this, 480, first + step * 3, 200, '도감', () => U.openSubscene(this, 'Codex'), nav);
      U.button(this, 480, first + step * 4, 200, '메인 메뉴로', () => {
        this.scene.pause('Pause');
        this.scene.launch('Confirm', { returnTo: 'Pause', action: 'returnToMenu' });
      }, { ...nav, danger: true });
      centered(this, 480, 391 - pad - 6, 'ESC  계속하기', U.fontSize.menuBase, U.C.muted);
      U.bindEscape(this, () => this.resumeGame());
    }
    resumeGame() {
      this.scene.stop('Pause');
      this.scene.resume('Game');
    }
  }

  class Subscene extends Phaser.Scene {
    constructor(key) { super(key); this.returnTo = 'MainMenu'; }
    init(data) {
      this.returnTo = data && data.returnTo === 'Pause' ? 'Pause' : 'MainMenu';
    }
    close() { U.closeSubscene(this, this.returnTo); }
    drawShell(title, subtitle) {
      U.overlay(this);
      U.panel(this, 480, 270, 480, 320, { fill: U.C.panel, stroke: U.C.border });
      U.panelHeader(this, 480, 110, 480);
      aligned(this, innerLeft(480), headerCenter(110), title, U.fontSize.menuHeading, U.C.text, 'left', U.C.header);
      aligned(this, innerLeft(480), 156, subtitle, U.fontSize.menuBase, U.C.muted);
      U.rule(this, innerLeft(480), 170, innerRight(480), 170, U.C.border, 1);
      U.button(this, innerRight(480)-55, footerCenter(430), 110, '돌아가기', () => this.close(), { height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
      U.bindEscape(this, () => this.close());
    }
  }

  class SettingsScene extends Subscene {
    constructor() { super('Settings'); this.activeTab = 'general'; this.tabItems = []; }
    create() {
      this.drawShell('설정', '설정 변경 및 저장은 미구현 상태입니다.');
      this.activeTab = 'general';
      this.tabItems = [];
      this.renderTab();
    }
    renderTab() {
      this.tabItems.forEach(item => item.destroy());
      this.tabItems = [];
      const tabs = [
        { id: 'general', label: '일반' },
        { id: 'audio', label: '사운드' },
        { id: 'video', label: '화면' }
      ];
      const tabWidth = (480 - 2 * pad - (tabs.length - 1) * menu.gap) / tabs.length;
      tabs.forEach((tab, index) => {
        this.tabItems.push(U.button(this, innerLeft(480) + tabWidth/2 + index * (tabWidth + menu.gap), 170 + pad + menu.buttonHeight/2, tabWidth, tab.label, () => {
          this.activeTab = tab.id;
          this.renderTab();
        }, { height: menu.buttonHeight, fontSize: U.fontSize.menuBase, selected: this.activeTab === tab.id }));
      });
      const data = {
        general: [
          ['언어', '현재 UI : 한국어'],
          ['인터페이스', '화면 크기 적응형'],
          ['기타 설정', '게임 로직 이후 정의']
        ],
        audio: [
          ['전체 음량', '제어 기능 미연결'],
          ['배경 음악', '음원 미등록'],
          ['효과음', '음원 미등록']
        ],
        video: [
          ['화면 모드', '브라우저 화면'],
          ['해상도', '16:9 / 창 크기에 맞춤'],
          ['그래픽 옵션', '제어 기능 미연결']
        ]
      }[this.activeTab];
      data.forEach((row, index) => {
        const y = 226 + index * menu.row;
        this.tabItems.push(aligned(this, innerLeft(480), y, row[0], U.fontSize.menuBase, U.C.text));
        this.tabItems.push(aligned(this, innerRight(480), y, row[1], U.fontSize.menuBase, U.C.muted, 'right'));
        this.tabItems.push(U.rule(this, innerLeft(480), y + menu.row/2, innerRight(480), y + menu.row/2, U.C.border, 0.6));
      });
      this.tabItems.push(aligned(this, innerLeft(480), footerCenter(430), '설정값 변경·저장 기능 없음', U.fontSize.menuBase, U.C.muted));
    }
  }

  class CodexScene extends Subscene {
    constructor() { super('Codex'); }
    create() {
      this.drawShell('도감', '향후 맵 도감이 들어갈 화면입니다.');
      U.panel(this, 480, 170 + sectionGap + 80, 480 - 2 * pad, 160, { fill: U.C.bg });
      centered(this, 480, 250, '맵 도감', U.fontSize.menuHeading, U.C.text, { inkBackground: U.C.bg });
      centered(this, 480, 290, '맵 도감 콘텐츠 미구현', U.fontSize.menuBase, U.C.muted, { inkBackground: U.C.bg });
    }
  }

  class ConfirmScene extends Phaser.Scene {
    constructor() { super('Confirm'); }
    init(data) {
      this.returnTo = data && data.returnTo === 'Pause' ? 'Pause' : 'MainMenu';
      this.action = data && data.action === 'returnToMenu' ? 'returnToMenu' : null;
    }
    create() {
      U.overlay(this);
      U.panel(this, 480, 270, 300, 150, { fill: U.C.panel, stroke: U.C.border });
      U.panelHeader(this, 480, 195, 300);
      centered(this, 480, headerCenter(195), '메인 메뉴로 돌아가시겠습니까?', U.fontSize.menuHeading, U.C.text, { inkBackground: U.C.header });
      centered(this, 480, 260, '진행 상황 저장은 미구현 상태입니다.', U.fontSize.menuBase, U.C.muted);
      U.button(this, 480 - pairOffset(110), footerCenter(345), 110, '취소', () => this.cancel(), { height: menu.buttonHeight });
      U.button(this, 480 + pairOffset(110), footerCenter(345), 110, '돌아가기', () => this.confirm(), { height: menu.buttonHeight, danger: true });
      U.bindEscape(this, () => this.cancel());
    }
    cancel() { U.closeSubscene(this, this.returnTo); }
    confirm() {
      if (this.action !== 'returnToMenu') return this.cancel();
      this.scene.stop('Pause');
      this.scene.stop('Game');
      this.scene.start('MainMenu');
    }
  }

  class ResultScene extends Phaser.Scene {
    constructor(key, victory) { super(key); this.victory = victory; }
    init(data){this.runResult=data?.elapsed!==undefined?data:null;}
    create() {
      const live=!!(window.GardenRunRules?.active&&this.runResult);
      if(live){U.fitCamera(this,U.W,U.H);this.scene.bringToTop();}
      else U.background(this, this.victory ? 'RESULT / VICTORY' : 'RESULT / DEFEAT');
      U.panel(this, 480, 270, 480, 280, { fill: U.C.panel, stroke: this.victory ? U.C.green : U.C.red }).setName('run-result-panel');
      U.panelHeader(this, 480, 130, 480);
      centered(this, 480, headerCenter(130), this.victory ? '성공' : '실패', U.fontSize.menuHeading,
        U.C.text, { inkBackground: U.C.header });
      if(!live){centered(this, 480, 176, '런 결과 화면 · UI 미리보기', U.fontSize.menuBase, U.C.muted);U.rule(this, innerLeft(480), 190, innerRight(480), 190, U.C.border, 1);}

      const r=this.runResult;
      const labels = r?(window.GardenRunRules?.survival?['생존 시간','처치 수','획득 보석','만개 꽃밭']:['정원 완성도','플레이 시간','처치 수','남은 보석']):['진행 구역', '플레이 시간', '기록', '획득 항목'];
      const seconds=Math.floor(r?.elapsed||0),values=r?(window.GardenRunRules?.survival?
        [window.GardenGameLayout.formatHudTime(Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60),String(r.kills),String(r.gems),'6×6']:
        [r.progress+'%',window.GardenGameLayout.formatHudTime(Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60),String(r.kills),String(r.gems)]):[];
      labels.forEach((name, index) => {
        const x = index % 2 === 0 ? innerLeft(480) : 480 + pad;
        const y = (live?193:210) + Math.floor(index / 2) * (live?64:48);
        aligned(this, x, y, name, U.fontSize.menuBase, U.C.muted);
        aligned(this, x, y + sectionGap, values[index]??'—', U.fontSize.menuBase, U.C.text);
      });
      if(!live)centered(this, 480, 350, '결과 데이터 계산·저장은 미구현 상태입니다.', U.fontSize.menuBase, U.C.muted);
      const leave=key=>{if(live)this.scene.stop('Game');this.scene.start(key);};
      const R=window.GardenRunRules,stage=live&&!R.survival?R.campaign?.stage:null,next=!!(this.victory&&stage&&stage<50);
      U.button(this, 480 - pairOffset(200), footerCenter(410), 200, next?'다음 스테이지':'새 게임', () => {if(next)R.selectBlueprint('stage-'+(stage+1));leave('Game');}, { primary: true, height: menu.buttonHeight });
      U.button(this, 480 + pairOffset(200), footerCenter(410), 200, '메인 메뉴', () => leave('MainMenu'), { height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
    }
    update(_time,delta){
      if(!window.GardenRunRules?.active||!this.runResult||!this.scene.isPaused('Game'))return;
      this.scene.get('Game').fairyPatrol?.advance(Math.min(.1,Math.max(0,delta/1000)));
    }
  }

  class VictoryScene extends ResultScene {
    constructor() { super('Victory', true); }
  }
  class DefeatScene extends ResultScene {
    constructor() { super('Defeat', false); }
  }

  window.GardenScenes = Object.freeze({
    BootScene: BootScene,
    MainMenuScene: MainMenuScene,
    GameScene: GameScene,
    GardenShopScene: GardenShopScene,
    PauseScene: PauseScene,
    SettingsScene: SettingsScene,
    CodexScene: CodexScene,
    ConfirmScene: ConfirmScene,
    VictoryScene: VictoryScene,
    DefeatScene: DefeatScene
  });
}());
