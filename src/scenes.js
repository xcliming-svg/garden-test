(function () {
  'use strict';

  const U = window.GardenUI;
  // 24px 타일 기준 공통 960×540 좌표. 메뉴는 기능에 맞는 간격을 선택하고 주요 행동은 크게 표시한다.
  const menu = Object.freeze({ ...U.menuStyle, row: 40 });
  function centered(scene, x, y, label, size, color, options = {}) {
    return U.text(scene, x, y, label, size, color, { ...options, originX: 0.5, originY: 0.5 });
  }
  const previewMode = new URLSearchParams(window.location.search).get('preview') === '1';

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
      centered(this, 480, 124, 'GARDEN', U.fontSize.menuTitle, U.C.text);
      centered(this, 480, 172, 'TEST', U.fontSize.menuTitle, U.C.text);
      centered(this, 480, 216, 'ROGUELIKE / SCENE STRUCTURE', U.fontSize.menuBase, U.C.muted);

      const x = U.W / 2;
      const w = 200;
      const first = 252;
      const step = menu.navHeight + menu.navGap;
      const nav = { height: menu.navHeight, fontSize: U.fontSize.menuAction };
      U.button(this, x, first, w, '새 게임', () => this.scene.start('Game'), { ...nav, primary: true });
      U.button(this, x, first + step, w, '이어하기 · 미구현', null, { ...nav, disabled: true });
      U.button(this, x, first + step * 2, w, '설정', () => U.openSubscene(this, 'Settings'), nav);
      U.button(this, x, first + step * 3, w, '도감', () => U.openSubscene(this, 'Codex'), nav);
      U.button(this, x, first + step * 4, w, '종료 · 웹 미지원', null, { ...nav, disabled: true });

      // 결과 씬 미리보기는 명시적인 개발용 URL에서만 나타난다.
      if (previewMode) {
        U.text(this, 792, 320, '개발용 결과 화면', U.fontSize.menuBase, U.C.muted, { originX: 0.5 });
        U.button(this, 792, 352, 168, '성공 화면', () => this.scene.start('Victory'), { height: 24, fontSize: U.fontSize.compact });
        U.button(this, 792, 384, 168, '실패 화면', () => this.scene.start('Defeat'), { height: 24, fontSize: U.fontSize.compact });
      }
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
      window.GardenGameLayout.draw(this);
      U.bindEscape(this, () => {
        this.scene.pause('Game');
        this.scene.launch('Pause');
      });
    }
  }

  class PauseScene extends Phaser.Scene {
    constructor() { super('Pause'); }
    create() {
      U.overlay(this);
      U.panel(this, 480, 270, 240, 242, { fill: U.C.panel, stroke: U.C.border });
      U.panelHeader(this, 480, 149, 240, 32);
      centered(this, 480, 166, '일시정지', U.fontSize.menuHeading, U.C.text);
      centered(this, 480, 191, '게임 화면은 중단된 상태입니다.', U.fontSize.menuBase, U.C.muted);
      U.rule(this, 368, 203, 592, 203, U.C.border, 1);
      const first = 220;
      const step = menu.navHeight + menu.navGap;
      const nav = { height: menu.navHeight, fontSize: U.fontSize.menuAction };
      U.button(this, 480, first, 200, '계속하기', () => this.resumeGame(), { ...nav, primary: true });
      U.button(this, 480, first + step, 200, '재시작 · 미구현', null, { ...nav, disabled: true });
      U.button(this, 480, first + step * 2, 200, '설정', () => U.openSubscene(this, 'Settings'), nav);
      U.button(this, 480, first + step * 3, 200, '도감', () => U.openSubscene(this, 'Codex'), nav);
      U.button(this, 480, first + step * 4, 200, '메인 메뉴로', () => {
        this.scene.pause('Pause');
        this.scene.launch('Confirm', { returnTo: 'Pause', action: 'returnToMenu' });
      }, { ...nav, danger: true });
      centered(this, 480, 366, 'ESC  계속하기', U.fontSize.menuBase, U.C.muted);
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
      U.panelHeader(this, 480, 110, 480, 30);
      U.text(this, 250, 125, title, U.fontSize.menuHeading, U.C.text, { originY: 0.5 });
      U.text(this, 250, 150, subtitle, U.fontSize.menuBase, U.C.muted, { originY: 0.5 });
      U.rule(this, 250, 164, 710, 164, U.C.border, 1);
      U.button(this, 650, 408, 110, '돌아가기', () => this.close(), { height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
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
      tabs.forEach((tab, index) => {
        this.tabItems.push(U.button(this, 328 + index * 152, 182, 144, tab.label, () => {
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
        const y = 218 + index * menu.row;
        this.tabItems.push(U.text(this, 254, y, row[0], U.fontSize.menuBase, U.C.text, { originY: 0.5 }));
        this.tabItems.push(U.text(this, 706, y, row[1], U.fontSize.menuBase, U.C.muted, { originX: 1, originY: 0.5 }));
        this.tabItems.push(U.rule(this, 254, y + 18, 706, y + 18, U.C.border, 0.6));
      });
      this.tabItems.push(U.text(this, 250, 408, '설정값 변경·저장 기능 없음', U.fontSize.menuBase, U.C.muted, { originY: 0.5 }));
    }
  }

  class CodexScene extends Subscene {
    constructor() { super('Codex'); }
    create() {
      this.drawShell('도감', '향후 맵 도감이 들어갈 화면입니다.');
      U.panel(this, 480, 270, 448, 160, { fill: U.C.bg });
      centered(this, 480, 264, '맵 도감', U.fontSize.menuHeading, U.C.text);
      centered(this, 480, 304, '맵 도감 콘텐츠 미구현', U.fontSize.menuBase, U.C.muted);
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
      U.panelHeader(this, 480, 195, 300, 30);
      centered(this, 480, 211, '메인 메뉴로 돌아가시겠습니까?', U.fontSize.menuBase, U.C.text);
      centered(this, 480, 260, '진행 상황 저장은 미구현 상태입니다.', U.fontSize.menuBase, U.C.muted);
      U.button(this, 420, 310, 110, '취소', () => this.cancel(), { height: menu.buttonHeight });
      U.button(this, 540, 310, 110, '돌아가기', () => this.confirm(), { height: menu.buttonHeight, danger: true });
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
    create() {
      U.background(this, this.victory ? 'RESULT / VICTORY' : 'RESULT / DEFEAT');
      U.panel(this, 480, 270, 480, 280, { fill: U.C.panel, stroke: U.C.border });
      U.panelHeader(this, 480, 130, 480, 36);
      centered(this, 480, 149, this.victory ? '성공' : '실패', U.fontSize.menuHeading,
        this.victory ? U.C.greenText : U.C.redText);
      centered(this, 480, 183, '런 결과 화면 · UI 미리보기', U.fontSize.menuBase, U.C.muted);
      U.rule(this, 250, 200, 710, 200, U.C.border, 1);

      const labels = ['진행 구역', '플레이 시간', '기록', '획득 항목'];
      labels.forEach((name, index) => {
        const x = index % 2 === 0 ? 256 : 496;
        const y = 222 + Math.floor(index / 2) * 48;
        U.text(this, x, y, name, U.fontSize.menuBase, U.C.muted, { originY: 0.5 });
        U.text(this, x, y + 20, '—', U.fontSize.menuBase, U.C.text, { originY: 0.5 });
      });
      centered(this, 480, 330, '결과 데이터 계산·저장은 미구현 상태입니다.', U.fontSize.menuBase, U.C.muted);
      U.button(this, 370, 362, 200, '새 게임', () => this.scene.start('Game'), { primary: true, height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
      U.button(this, 590, 362, 200, '메인 메뉴', () => this.scene.start('MainMenu'), { height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
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
    PauseScene: PauseScene,
    SettingsScene: SettingsScene,
    CodexScene: CodexScene,
    ConfirmScene: ConfirmScene,
    VictoryScene: VictoryScene,
    DefeatScene: DefeatScene
  });
}());
