(function () {
  'use strict';

  const U = window.GardenUI;
  // 기존 메뉴 디자인 좌표는 1280×720. 전장 640×360 기준 간격의 2배를 사용한다.
  const menu = Object.freeze({ gap: 8, buttonHeight: 48, inset: 32, row: 72 });
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
      centered(this, 640, 168, 'GARDEN', U.fontSize.menuTitle, U.C.text);
      centered(this, 640, 248, 'TEST', U.fontSize.menuTitle, '#e1b875');
      centered(this, 640, 304, 'ROGUELIKE / SCENE STRUCTURE', U.fontSize.menuBase, U.C.muted);

      const x = 640;
      const w = 392;
      const first = 360;
      const step = menu.buttonHeight + menu.gap;
      U.button(this, x, first, w, '새 게임', () => this.scene.start('Game'), { height: menu.buttonHeight, primary: true });
      U.button(this, x, first + step, w, '이어하기 · 미구현', null, { height: menu.buttonHeight, disabled: true });
      U.button(this, x, first + step * 2, w, '설정', () => U.openSubscene(this, 'Settings'), { height: menu.buttonHeight });
      U.button(this, x, first + step * 3, w, '도감', () => U.openSubscene(this, 'Codex'), { height: menu.buttonHeight });
      U.button(this, x, first + step * 4, w, '종료 · 웹 미지원', null, { height: menu.buttonHeight, disabled: true });

      // 결과 씬 미리보기는 명시적인 개발용 URL에서만 나타난다.
      if (previewMode) {
        U.text(this, 1060, 441, '개발용 결과 화면', U.fontSize.menuBase, '#e1b875', { originX: 0.5 });
        U.button(this, 1060, 485, 230, '성공 화면', () => this.scene.start('Victory'), { height: 40, fontSize: U.fontSize.menuBase });
        U.button(this, 1060, 537, 230, '실패 화면', () => this.scene.start('Defeat'), { height: 40, fontSize: U.fontSize.menuBase });
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
      U.panel(this, 640, 360, 528, 520, { fill: 0x17212d, stroke: U.C.gold, strokeWidth: 2 });
      centered(this, 640, 152, '일시정지', U.fontSize.menuHeading, U.C.text);
      centered(this, 640, 192, '게임 화면은 중단된 상태입니다.', U.fontSize.menuBase, U.C.muted);
      U.rule(this, 408, 224, 872, 224, U.C.border, 1);
      const first = 264;
      const step = menu.buttonHeight + menu.gap;
      U.button(this, 640, first, 392, '계속하기', () => this.resumeGame(), { height: menu.buttonHeight, primary: true });
      U.button(this, 640, first + step, 392, '재시작 · 미구현', null, { height: menu.buttonHeight, disabled: true });
      U.button(this, 640, first + step * 2, 392, '설정', () => U.openSubscene(this, 'Settings'), { height: menu.buttonHeight });
      U.button(this, 640, first + step * 3, 392, '도감', () => U.openSubscene(this, 'Codex'), { height: menu.buttonHeight });
      U.button(this, 640, first + step * 4, 392, '메인 메뉴로', () => {
        this.scene.pause('Pause');
        this.scene.launch('Confirm', { returnTo: 'Pause', action: 'returnToMenu' });
      }, { height: menu.buttonHeight, danger: true });
      centered(this, 640, 568, 'ESC  계속하기', U.fontSize.menuBase, U.C.muted);
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
      U.panel(this, 640, 360, 928, 544, { fill: 0x17212d, stroke: U.C.border });
      U.text(this, 208, 136, title, U.fontSize.menuHeading, U.C.text, { originY: 0.5 });
      U.text(this, 208, 176, subtitle, U.fontSize.menuBase, U.C.muted, { originY: 0.5 });
      U.rule(this, 208, 208, 1072, 208, U.C.border, 1);
      U.button(this, 976, 584, 192, '돌아가기', () => this.close(), { height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
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
        this.tabItems.push(U.button(this, 352 + index * 288, 248, 272, tab.label, () => {
          this.activeTab = tab.id;
          this.renderTab();
        }, { height: menu.buttonHeight, fontSize: U.fontSize.menuBase, primary: this.activeTab === tab.id }));
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
        const y = 320 + index * menu.row;
        this.tabItems.push(U.text(this, 224, y, row[0], U.fontSize.menuBase, U.C.text, { originY: 0.5 }));
        this.tabItems.push(U.text(this, 1056, y, row[1], U.fontSize.menuBase, U.C.muted, { originX: 1, originY: 0.5 }));
        this.tabItems.push(U.rule(this, 224, y + 36, 1056, y + 36, U.C.border, 0.6));
      });
      this.tabItems.push(U.text(this, 208, 584, '설정값 변경·저장 기능 없음', U.fontSize.menuBase, '#e1b875', { originY: 0.5 }));
    }
  }

  class CodexScene extends Subscene {
    constructor() { super('Codex'); }
    create() {
      this.drawShell('도감', '향후 맵 도감이 들어갈 화면입니다.');
      U.panel(this, 640, 384, 864, 304, { fill: 0x101823 });
      centered(this, 640, 360, '맵 도감', U.fontSize.menuHeading, U.C.text);
      centered(this, 640, 408, '맵 도감 콘텐츠 미구현', U.fontSize.menuBase, U.C.muted);
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
      U.panel(this, 640, 360, 608, 320, { fill: 0x1b2532, stroke: U.C.red, strokeWidth: 2 });
      centered(this, 640, 264, '메인 메뉴로 돌아가시겠습니까?', U.fontSize.menuBase, U.C.text);
      centered(this, 640, 320, '진행 상황 저장은 미구현 상태입니다.', U.fontSize.menuBase, U.C.muted);
      U.button(this, 512, 432, 240, '취소', () => this.cancel(), { height: menu.buttonHeight });
      U.button(this, 768, 432, 240, '돌아가기', () => this.confirm(), { height: menu.buttonHeight, danger: true });
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
      const accent = this.victory ? U.C.green : U.C.red;
      U.panel(this, 640, 360, 896, 496, { fill: 0x15202b, stroke: accent, strokeWidth: 2 });
      centered(this, 640, 184, this.victory ? '성공' : '실패', U.fontSize.menuHeading,
        this.victory ? '#84d0aa' : '#e18f91');
      centered(this, 640, 240, '런 결과 화면 · UI 미리보기', U.fontSize.menuBase, U.C.muted);
      U.rule(this, 224, 272, 1056, 272, U.C.border, 1);

      const labels = ['진행 구역', '플레이 시간', '기록', '획득 항목'];
      labels.forEach((name, index) => {
        const x = index % 2 === 0 ? 240 : 656;
        const y = 312 + Math.floor(index / 2) * 88;
        U.text(this, x, y, name, U.fontSize.menuBase, U.C.muted, { originY: 0.5 });
        U.text(this, x, y + 32, '—', U.fontSize.menuBase, U.C.text, { originY: 0.5 });
      });
      centered(this, 640, 504, '결과 데이터 계산·저장은 미구현 상태입니다.', U.fontSize.menuBase, '#e1b875');
      U.button(this, 496, 560, 272, '새 게임', () => this.scene.start('Game'), { primary: true, height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
      U.button(this, 784, 560, 272, '메인 메뉴', () => this.scene.start('MainMenu'), { height: menu.buttonHeight, fontSize: U.fontSize.menuBase });
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
