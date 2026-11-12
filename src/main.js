(function () {
  'use strict';

  // Phaser만 생성한다. 게임 상태, 전투 루프, 생성 로직 등은 등록하지 않는다.
  const S = window.GardenScenes;
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: '#0b1018',
    render: { antialias: true, pixelArt: false },
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
      S.ControlsScene,
      S.CreditsScene,
      S.ConfirmScene,
      S.VictoryScene,
      S.DefeatScene
    ]
  });
}());
