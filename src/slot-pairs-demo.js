(function () {
  'use strict';

  // Opt-in, visual-only slot-pair comparison. Never changes the run's inventory or controls.
  const profiles = Object.freeze({
    '9': Object.freeze({ pairs: 9, size: 36, gap: 3 }),
    '10': Object.freeze({ pairs: 10, size: 34, gap: 3 })
  });
  const requested = new URLSearchParams(window.location.search).get('slotPairs');
  const profile = Object.prototype.hasOwnProperty.call(profiles, requested) ? profiles[requested] : null;
  const measure = ({ pairs, size, gap }) => pairs * size * 2 + (pairs - 1) * gap;
  const api = Object.freeze({ profiles, requested, active: !!profile, measure });
  window.GardenSlotPairsDemo = api;
  if (!profile) return;

  const original = window.GardenGameLayout;
  const originalDraw = original.draw;

  function drawPreview(scene) {
    const U = window.GardenUI;
    const R = window.GardenPalette.reference.n;
    const spec = original.spec;
    const base = original.bottomLayout();
    const left = base.left;
    const right = base.right; // Start of the three real right-hand stat columns.
    const width = measure(profile);
    if (left + width > right) throw new Error('Slot pair preview overlaps the right-hand HUD');

    const hudTop = spec.top + spec.fieldHeight;
    const centerY = spec.slots.y + spec.slots.size / 2;
    const top = centerY - profile.size / 2;
    const background = U.pixelGraphics(scene).setDepth(90).setName('slot-pairs-demo-background');
    background.fillStyle(R.hud, 1).fillRect(0, hudTop, right, spec.bottom);
    background.fillStyle(R.hudEdge, 1).fillRect(0, hudTop, right, 1);
    background.fillStyle(R.hudLight, 1).fillRect(0, hudTop + 1, right, 1);

    const divider = U.pixelGraphics(scene).setDepth(92).setName('slot-pairs-demo-dividers');
    const xs = [];
    for (let i = 0; i < profile.pairs; i++) {
      const x = left + i * (profile.size * 2 + profile.gap);
      xs.push(x);
      U.pixelBox(scene, x + profile.size, centerY, profile.size * 2, profile.size,
        R.hud, { border: R.tabBorder, strokeWidth: 1 })
        .setDepth(91).setName('slot-pairs-demo-pair:' + i);
      divider.fillStyle(R.tabBorder, 1).fillRect(x + profile.size, top + 1, 1, profile.size - 2);
    }

    // Display the existing stone artwork in the first left cell; other cells are empty.
    const rock = window.GardenItemCards.runItem(scene, 'rock', 1);
    const texture = scene.textures.get(rock.texture).getSourceImage();
    const scale = Math.min(24 / texture.width, 24 / texture.height);
    scene.add.image(left + profile.size / 2, centerY, rock.texture)
      .setDisplaySize(texture.width * scale, texture.height * scale)
      .setDepth(93).setName('slot-pairs-demo-rock');
    U.text(scene, left + profile.size - 2, top + profile.size - 2, 'Lv.1', 8,
      window.GardenPalette.hex.paper, { originX: 1, originY: 1 })
      .setDepth(94).setName('slot-pairs-demo-rock-level');

    // Demo cells do not map to equipment slots. Block clicks on covered live slots.
    scene.add.zone(right / 2, hudTop + spec.bottom / 2, right, spec.bottom)
      .setDepth(95).setInteractive().setName('slot-pairs-demo-input-shield');

    scene.slotPairsPreview = Object.freeze({
      pairs: profile.pairs, size: profile.size, gap: profile.gap, left, right,
      width, top, bottom: top + profile.size, positions: Object.freeze(xs)
    });
    document.title = 'Garden Test | 슬롯 비교 ' + profile.pairs + '쌍 · ' + profile.size + 'px';
  }

  window.GardenGameLayout = Object.freeze({
    ...original,
    draw(scene) {
      const result = originalDraw(scene);
      drawPreview(scene);
      return result;
    }
  });
}());
