(function () {
  'use strict';

  // Phaser만 생성한다. 게임 상태, 전투 루프, 생성 로직 등은 등록하지 않는다.
  const S = window.GardenScenes;
  const L = window.GardenGameLayout.spec;
  const parent = document.getElementById('game');

  // Canvas는 640×360으로 고정한다. 브라우저의 CSS 픽셀 기준 정수 배율을 우선한다.
  // 640×360보다 작은 창에 한해 잘리지 않도록 비정수 축소를 허용한다.
  function fitParent() {
    const available = Math.min(window.innerWidth / L.width, window.innerHeight / L.height);
    const scale = available >= 1 ? Math.floor(available) : available;
    parent.style.width = Math.max(1, Math.floor(L.width * scale)) + 'px';
    parent.style.height = Math.max(1, Math.floor(L.height * scale)) + 'px';
  }
  fitParent();
  window.addEventListener('resize', fitParent);

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: L.width,
    height: L.height,
    backgroundColor: '#0b1018',
    render: { antialias: false, pixelArt: true, roundPixels: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
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
}());
