(async function () {
  'use strict';

  // Phaser만 생성한다. 게임 상태, 전투 루프, 생성 로직 등은 등록하지 않는다.
  const S = window.GardenScenes;
  const P = window.GardenPalette.hex;
  document.documentElement.style.backgroundColor = P.ink;
  document.body.style.backgroundColor = P.ink;
  const parent = document.getElementById('game');

  // 640×360은 게임 좌표 기준일 뿐 실제 렌더링 버퍼 크기가 아니다.
  // 브라우저 가용 영역에 들어가는 최대 16:9 크기를 사용한다.
  // 16×9 단위로 맞추므로 실제 배율은 1.5, 2.125 등 비정수일 수 있다.
  function fitParent() {
    const unit = Math.max(1, Math.floor(Math.min(window.innerWidth / 16, window.innerHeight / 9)));
    const width = unit * 16;
    const height = unit * 9;
    parent.style.width = width + 'px';
    parent.style.height = height + 'px';
    return { width, height };
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
    backgroundColor: P.ink,
    // UI 글자는 부드럽게 렌더링한다. 실제 픽셀아트 PNG는 향후
    // 텍스처별 NEAREST 필터를 지정한다(전체 Canvas를 픽셀화하지 않는다).
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scale: {
      mode: Phaser.Scale.RESIZE,
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
    if (game.isBooted) game.scale.setParentSize(size.width, size.height);
  });
}());
