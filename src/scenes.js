(function () {
  'use strict';

  const U = window.GardenUI;
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
      U.text(this, 87, 142, 'GARDEN', 76, U.C.text, { bold: true });
      U.text(this, 91, 231, 'TEST', 76, '#e1b875', { bold: true });
      U.text(this, 94, 326, 'ROGUELIKE / SCENE STRUCTURE', 15, U.C.muted);

      const x = 270;
      const w = 358;
      U.button(this, x, 374, w, '새 게임', () => this.scene.start('Game'), { primary: true });
      U.button(this, x, 430, w, '이어하기 · 미구현', null, { disabled: true });
      U.button(this, x, 486, w, '설정', () => U.openSubscene(this, 'Settings'));
      U.button(this, x, 542, w, '조작법', () => U.openSubscene(this, 'Controls'));
      U.button(this, x, 598, w, '종료 · 웹 미지원', null, { disabled: true });

      U.panel(this, 965, 366, 400, 476, { fill: 0x111a25, alpha: 0.96 });
      U.text(this, 798, 167, '프로토타입 안내', 23, U.C.text, { bold: true });
      U.rule(this, 798, 207, 1134, 207, U.C.border, 1);
      U.text(this, 798, 231, '이 버전은 화면 구성만 포함합니다.', 18, U.C.text);
      U.text(this, 798, 274, '게임 진행 / 저장 / 승패 판정은\n구현하지 않았습니다.', 17, U.C.muted, { lineSpacing: 12 });
      U.text(this, 798, 363, '• 마우스로 메뉴 선택\n• 게임 화면에서 ESC 일시정지\n• 설정 / 확인 / 결과 화면', 16, U.C.muted, { lineSpacing: 13 });

      U.button(this, 965, 512, 330, '크레딧', () => U.openSubscene(this, 'Credits'), { height: 46, fontSize: 17 });

      if (previewMode) {
        U.text(this, 799, 549, '개발용 결과 화면 확인 (?preview=1)', 13, '#e1b875');
        U.button(this, 880, 595, 157, '성공 화면', () => this.scene.start('Victory'), { height: 40, fontSize: 15 });
        U.button(this, 1050, 595, 157, '실패 화면', () => this.scene.start('Defeat'), { height: 40, fontSize: 15 });
      } else {
        U.text(this, 800, 577, '실제 게임 로직은 후속 단계에서 별도 구현', 13, U.C.muted);
      }
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
      U.background(this, 'GAME / EMPTY SCENE');
      U.text(this, 53, 100, '게임 화면', 25, U.C.text, { bold: true });
      U.text(this, 1230, 110, 'ESC  일시정지', 16, '#e1b875', { originX: 1 });
      U.panel(this, 510, 397, 916, 500, { fill: 0x101823 });
      U.panel(this, 1081, 397, 254, 500, { fill: 0x151f2b });

      const grid = this.add.graphics();
      grid.lineStyle(1, 0x455464, 0.20);
      for (let x = 96; x < 957; x += 70) grid.lineBetween(x, 163, x, 632);
      for (let y = 188; y < 626; y += 70) grid.lineBetween(78, y, 952, y);

      U.text(this, 510, 327, '플레이 영역', 31, U.C.text, { bold: true, originX: 0.5 });
      U.text(this, 510, 381, '게임플레이 미구현', 20, '#e1b875', { originX: 0.5 });
      U.text(this, 510, 432, '맵 생성 · 이동 · 전투 · 적 · 아이템 로직 없음', 16, U.C.muted, { originX: 0.5 });

      U.text(this, 987, 173, 'HUD / 자리만 배치', 17, U.C.text, { bold: true });
      U.rule(this, 982, 206, 1178, 206, U.C.border, 0.9);
      const rows = ['체력', '진행 구역', '장비 / 소지품', '기록'];
      rows.forEach((name, index) => {
        const y = 236 + index * 79;
        U.text(this, 991, y, name, 15, U.C.muted);
        U.text(this, 1169, y + 27, '—', 20, U.C.text, { originX: 1 });
        U.rule(this, 990, y + 62, 1167, y + 62, U.C.border, 0.54);
      });
      U.text(this, 986, 591, '수치는 연결하지 않았습니다.', 13, '#e1b875');

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
      U.panel(this, 640, 362, 522, 526, { fill: 0x17212d, stroke: U.C.gold, strokeWidth: 2 });
      U.text(this, 640, 140, '일시정지', 39, U.C.text, { bold: true, originX: 0.5 });
      U.text(this, 640, 192, '게임 화면은 중단된 상태입니다.', 16, U.C.muted, { originX: 0.5 });
      U.rule(this, 424, 229, 856, 229, U.C.border, 1);
      U.button(this, 640, 268, 392, '계속하기', () => this.resumeGame(), { primary: true });
      U.button(this, 640, 327, 392, '재시작 · 미구현', null, { disabled: true });
      U.button(this, 640, 386, 392, '설정', () => U.openSubscene(this, 'Settings'));
      U.button(this, 640, 445, 392, '조작법', () => U.openSubscene(this, 'Controls'));
      U.button(this, 640, 504, 392, '메인 메뉴로', () => {
        this.scene.pause('Pause');
        this.scene.launch('Confirm', { returnTo: 'Pause', action: 'returnToMenu' });
      }, { danger: true });
      U.text(this, 640, 575, 'ESC  계속하기', 15, U.C.muted, { originX: 0.5 });
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
      U.panel(this, 640, 366, 932, 552, { fill: 0x17212d, stroke: U.C.border });
      U.text(this, 222, 116, title, 37, U.C.text, { bold: true });
      U.text(this, 222, 168, subtitle, 16, U.C.muted);
      U.rule(this, 218, 208, 1062, 208, U.C.border, 1);
      U.button(this, 961, 591, 180, '돌아가기', () => this.close(), { height: 46, fontSize: 17 });
      U.bindEscape(this, () => this.close());
    }
  }

  class SettingsScene extends Subscene {
    constructor() { super('Settings'); this.activeTab = 'general'; this.tabItems = []; }
    create() {
      this.drawShell('설정', '항목은 화면 구성용입니다. 설정 저장 및 실제 적용은 구현하지 않았습니다.');
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
        this.tabItems.push(U.button(this, 334 + index * 306, 251, 264, tab.label, () => {
          this.activeTab = tab.id;
          this.renderTab();
        }, { height: 47, fontSize: 17, primary: this.activeTab === tab.id }));
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
          ['해상도', '캔버스 1280 × 720 기준'],
          ['그래픽 옵션', '제어 기능 미연결']
        ]
      }[this.activeTab];
      data.forEach((row, index) => {
        const y = 319 + index * 76;
        this.tabItems.push(U.text(this, 253, y, row[0], 21, U.C.text));
        this.tabItems.push(U.text(this, 1013, y + 2, row[1], 17, U.C.muted, { originX: 1 }));
        this.tabItems.push(U.rule(this, 249, y + 51, 1030, y + 51, U.C.border, 0.6));
      });
      this.tabItems.push(U.text(this, 255, 561, '설정값 변경·저장 기능 없음', 14, '#e1b875'));
    }
  }

  class ControlsScene extends Subscene {
    constructor() { super('Controls'); }
    create() {
      this.drawShell('조작법', '현재 구현된 UI 입력만 표기합니다. 게임 캐릭터의 조작은 없습니다.');
      const rows = [
        ['마우스 왼쪽 클릭', '메뉴 버튼 선택'],
        ['ESC · 게임 화면', '일시정지 메뉴 열기'],
        ['ESC · 일시정지', '게임 화면으로 돌아가기'],
        ['ESC · 하위 메뉴', '이전 화면으로 돌아가기']
      ];
      rows.forEach((row, index) => {
        const y = 265 + index * 69;
        U.text(this, 262, y, row[0], 20, U.C.text);
        U.text(this, 1019, y + 2, row[1], 17, U.C.muted, { originX: 1 });
        U.rule(this, 259, y + 46, 1026, y + 46, U.C.border, 0.7);
      });
      U.text(this, 262, 570, '이동·공격·상호작용 단축키는 정의하지 않았습니다.', 14, '#e1b875');
    }
  }

  class CreditsScene extends Subscene {
    constructor() { super('Credits'); }
    create() {
      this.drawShell('크레딧', '프로젝트에서 현재 확인 가능한 정보만 표시합니다.');
      U.text(this, 266, 284, '프로젝트', 17, U.C.muted);
      U.text(this, 488, 284, 'garden-test', 20, U.C.text);
      U.rule(this, 262, 326, 1015, 326, U.C.border, 0.7);
      U.text(this, 266, 363, '게임 엔진', 17, U.C.muted);
      U.text(this, 488, 363, 'Phaser 3.90.0 (MIT License)', 20, U.C.text);
      U.rule(this, 262, 405, 1015, 405, U.C.border, 0.7);
      U.text(this, 266, 443, '제작 크레딧', 17, U.C.muted);
      U.text(this, 488, 443, '아직 지정되지 않음', 20, U.C.text);
      U.text(this, 265, 544, '실제 크레딧은 확인된 정보만 추가합니다.', 14, '#e1b875');
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
      U.panel(this, 640, 365, 604, 344, { fill: 0x1b2532, stroke: U.C.red, strokeWidth: 2 });
      U.text(this, 640, 245, '메인 메뉴로 돌아가시겠습니까?', 27, U.C.text, { bold: true, originX: 0.5 });
      U.text(this, 640, 311, '진행 상황 저장 기능은 구현하지 않았습니다.', 16, U.C.muted, { originX: 0.5 });
      U.button(this, 520, 428, 218, '취소', () => this.cancel());
      U.button(this, 762, 428, 218, '돌아가기', () => this.confirm(), { danger: true });
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
      U.panel(this, 640, 374, 890, 490, { fill: 0x15202b, stroke: accent, strokeWidth: 2 });
      U.text(this, 640, 174, this.victory ? '성공' : '실패', 63,
        this.victory ? '#84d0aa' : '#e18f91', { bold: true, originX: 0.5 });
      U.text(this, 640, 249, '런 결과 화면 · UI 미리보기', 18, U.C.muted, { originX: 0.5 });
      U.rule(this, 289, 290, 992, 290, U.C.border, 1);

      const labels = ['진행 구역', '플레이 시간', '기록', '획득 항목'];
      labels.forEach((name, index) => {
        const x = index % 2 === 0 ? 347 : 718;
        const y = 325 + Math.floor(index / 2) * 93;
        U.text(this, x, y, name, 16, U.C.muted);
        U.text(this, x, y + 27, '—', 25, U.C.text);
      });
      U.text(this, 640, 523, '결과 데이터 계산·저장은 구현하지 않았습니다.', 14, '#e1b875', { originX: 0.5 });
      U.button(this, 489, 578, 263, '새 게임', () => this.scene.start('Game'), { primary: true, height: 46, fontSize: 18 });
      U.button(this, 791, 578, 263, '메인 메뉴', () => this.scene.start('MainMenu'), { height: 46, fontSize: 18 });
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
    ControlsScene: ControlsScene,
    CreditsScene: CreditsScene,
    ConfirmScene: ConfirmScene,
    VictoryScene: VictoryScene,
    DefeatScene: DefeatScene
  });
}());
