(function () {
  'use strict';
  // 임시 픽셀 샘플: 데이지/손수레는 제공 SVG, 나머지 꽃은 제공 시트에서 변환.
  // 꽃은 기존 16px 샘플 사용. 12px 축소 샘플은 비교용으로 보존.
  // 손수레 16px와 달팽이 12px는 기존 샘플 유지.
  const samples = {
  "daisy:12": [
    12,
    "00000000 e9d0abff f4c12cff 62ab40ff",
    "000001100000000011111000001111111100001112211100001122221100001122221100001112111100000111110000003331133300003333333300000333333000000003300000"
  ],
  "tulip:12": [
    12,
    "00000000 f16b7dff f26d7eff f26e7fff 579a34ff 559a34ff",
    "000001100000002221231000003223321200002133231000000113331000000011330000000004000000044504044400004554454000000445440000000005000000000004000000"
  ],
  "sunflower:12": [
    12,
    "00000000 f1b303ff f3b302ff f3b403ff 7e4f25ff 539732ff 5d9931ff",
    "000001100000000233333000000314443000003244443310003344443300000344443300003114413100000001100000005506605500005555555500000555555000000005500000"
  ],
  "hydrangea:12": [
    12,
    "00000000 67a3eeff 3e89e2ff 73acf2ff 78aff3ff 519836ff 4e94c2ff",
    "000000110000000221111000002221111200003122112220044322232220044433333220003122131200000022230000005506005500005555055500000555555000000005000000"
  ],
  "tulip:16": [
    16,
    "00000000 f16b7dff f26d7eff f26e7fff 579a34ff 559a34ff",
    "0000000110000000000220111332000000022222221120000003223333212000000212332331000000001133332100000000111223200000000000113300000000000004000000000044000400044000004454040444400000045554455400000000444544400000000000054000000000000005000000000000000400000000"
  ],
  "sunflower:16": [
    16,
    "00000000 f1b303ff f3b302ff f3b403ff 7e4f25ff f5b604ff 539732ff 5d9931ff",
    "0000000110000000000021013032000000002333333300000000314444130000000321444443310000133444444333000003144444433000000031444413300000031314411310000000501111000000000000011000000000666607706666000006666666666000000066666666000000000006600000000000000660000000"
  ],
  "hydrangea:16": [
    16,
    "00000000 67a3eeff 3e89e2ff 73acf2ff 78aff3ff 519836ff 4e94c2ff",
    "0000000011000000000002001110000000002211111100000002222111112200000312221122220000443122233222200444432213312220044443233333220000331222133120000003022223300000000000222000000000555006005555000055550505555000000555555555000000000005500000000000000500000000"
  ],
  "daisy:16": [
    16,
    "00000000 e9d0abff f4c12cff 62ab40ff",
    "0000000110000000000000111100000000011011111110000011111111111000001111222111100000011122221110000001122222111000001111222211110000111112111111000001111111011000000000111100000000333301103333000033333333333300000333333333300000003333333000000000000330000000"
  ],
  "snail:12": [
    12,
    "00000000 a0654351 a86c49f9 a16443a4 a06a4615 cea17569 cfa3751e dfb88e1f cfa47bed ca9d76b4 ba855cfb d9b48b5f dcb78ff6 9e5f3ee3 9b5d3729 ddb78fa5",
    "000000000000000001222340565712222224869622aaaa23bb012a2222227cc92a2a222dbccc2a2a2a23bccca22222de6f0cca22229707fcccc88ccc000000000000000000000000"
  ],
  "wheelbarrow:16": [
    16,
    "00000000 9f7c68ff 715746ff 424141ff",
    "0000000000010000000000000011000000000000011000010000000211000010000002222200011000012222222111000112222222221100112222222211110011122222211121001111222111133300111111111133300033111112103330000001113330000000000003330000000000000333000000000000000000000000"
  ]
};
  const key = (name, size) => 'ui-test:' + name + ':' + size;
  // 공통 원본 픽셀 데이터를 복사해 게임 텍스처와 독립 비교 페이지에서 사용한다.
  function pixelData(name, size) {
    const sample = samples[name + ':' + size];
    if (!sample) throw new Error('Unknown sample: ' + name + ':' + size);
    const [, colors, pixels] = sample;
    const palette = colors.split(' '), data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < pixels.length; i++) {
      const rgba = palette[parseInt(pixels[i], 16)];
      for (let c = 0; c < 4; c++) data[i * 4 + c] = parseInt(rgba.slice(c * 2, c * 2 + 2), 16);
    }
    return data;
  }
  function install(scene) {
    for (const [name, [size]] of Object.entries(samples)) {
      const textureKey = 'ui-test:' + name;
      if (scene.textures.exists(textureKey)) continue;
      const texture = scene.textures.createCanvas(textureKey, size, size);
      const ctx = texture.getContext();
      const image = ctx.createImageData(size, size);
      image.data.set(pixelData(name.split(':')[0], size));
      ctx.putImageData(image, 0, 0);
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
  function sprite(scene, x, y, name, size) {
    return scene.add.image(x, y, key(name, size)).setDisplaySize(size, size);
  }
  function marker(scene, x, y, name, size) {
    const image = sprite(scene, 0, 0, name, size);
    const border = scene.add.rectangle(0, 0, size, size, 0, 0);
    const group = scene.add.container(x, y, [image, border]).setSize(size, size);
    group.setStrokeStyle = (width, color, alpha) => {
      border.setStrokeStyle(width, color, alpha);
      return group;
    };
    return group;
  }
  // 꽃/아이템 공통 카드 24px, 아이콘 16px, 패딩 3px, 프레임 1px.
  // 종류별 외곽색은 고정하고 호버/드래그 활성 상태는 내부 면의 밝기로 구분한다.
  function dropCard(scene, x, y, name, size, iconSize, kind) {
    const P = window.GardenPalette.n;
    const border = scene.add.rectangle(0, 0, size, size, kind === 'flower' ? P.growth : P.paper);
    const face = scene.add.rectangle(0, 0, size - 2, size - 2, P.grid);
    const image = sprite(scene, 0, 0, name, iconSize);
    const group = scene.add.container(x, y, [border, face, image]).setSize(size, size);
    group.setStrokeStyle = (_width, _color, alpha) => {
      face.setFillStyle(alpha ? P.edge : P.grid, 1);
      return group;
    };
    return group;
  }
  function itemCard(scene, x, y, name, size, iconSize) {
    return dropCard(scene, x, y, name, size, iconSize, 'item');
  }
  function flowerCard(scene, x, y, name, size, iconSize) {
    return dropCard(scene, x, y, name, size, iconSize, 'flower');
  }
  window.GardenTestSprites = Object.freeze({ install, sprite, marker, itemCard, flowerCard, pixelData, textureKey: key,
    flowers: Object.freeze(['daisy', 'tulip', 'sunflower', 'hydrangea']) });
}());
