(async function () {
  'use strict';

  // Phaser만 생성한다. 게임 상태, 전투 루프, 생성 로직 등은 등록하지 않는다.
  const S = window.GardenScenes;
  const P = window.GardenPalette.hex;
  const background = window.GardenPalette.background.hex;
  document.documentElement.style.backgroundColor = background;
  document.body.style.backgroundColor = background;
  const parent = document.getElementById('game');

  // 960×540은 게임 좌표 기준일 뿐 실제 렌더링 버퍼 크기가 아니다.
  // 브라우저 가용 영역에 들어가는 최대 16:9 크기를 사용한다.
  // 16×9 단위로 맞추므로 실제 배율은 1.5, 2.125 등 비정수일 수 있다.
  function fitParent() {
    const dpr = window.devicePixelRatio || 1;
    const unit = Math.max(1, Math.floor(Math.min(window.innerWidth * dpr / 16, window.innerHeight * dpr / 9)));
    const width = unit * 16, height = unit * 9;
    parent.style.width = width / dpr + 'px';
    parent.style.height = height / dpr + 'px';
    return { width, height, dpr };
  }
  // Measure UI text only after the bundled fonts have loaded.
  try {
    await window.GardenUI.loadFonts();
  } catch (error) {
    // Never silently render a different UI font on load failure.
    parent.textContent = 'Fusion Pixel UI font loading failed. Check assets/fonts/fusion.css.';
    parent.style.color = P.paper;
    parent.style.fontFamily = 'sans-serif';
    console.error(error);
    return;
  }
  const initial = fitParent();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: initial.width,
    height: initial.height,
    backgroundColor: background,
    // 화면 물리 픽셀 크기의 백버퍼, UI 텍스트는 해당 배율에서 직접 래스터화.
    // 원본 글리프와 스프라이트는 수정하지 않는다.
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: 1 / initial.dpr,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    scene: [
      S.BootScene,
      S.MainMenuScene,
      S.GameScene,
      S.PauseScene,
      S.SettingsScene,
      S.CodexScene,
      S.ConfirmScene,
      S.VictoryScene,
      S.DefeatScene
    ]
  });

  window.addEventListener('resize', () => {
    const size = fitParent();
    if (game.isBooted) {
      if (game.scale.zoom !== 1 / size.dpr) game.scale.setZoom(1 / size.dpr);
      game.scale.resize(size.width, size.height);
    }
  });
}());
