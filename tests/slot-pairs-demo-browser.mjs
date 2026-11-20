import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const phaser = require.resolve('phaser/dist/phaser.min.js');
const mime = { '.js': 'application/javascript', '.html': 'text/html; charset=utf-8',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer((req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1)) || 'index.html';
    if (path.includes('..')) return res.writeHead(404).end();
    let body = readFileSync(path === 'phaser.js' ? phaser : join(process.cwd(), path));
    if (path === 'index.html') body = body.toString().replace(
      'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js', './phaser.js');
    if (path === 'src/main.js') body = body.toString().replace(
      "  window.addEventListener('resize',",
      "  window.__previewGame = game;\n  window.addEventListener('resize',");
    res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' }).end(body);
  } catch (error) { res.writeHead(500).end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  for (const [width, height] of [[960, 540], [1280, 720]]) {
    for (const [pairs, size] of [[9, 36], [10, 34], [0, 36]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto('http://127.0.0.1:' + server.address().port +
        (pairs ? '/?slotPairs=' + pairs : '/'));
      await page.waitForFunction(() => window.__previewGame?.scene.isActive('MainMenu'));
      const box = await page.locator('canvas').boundingBox();
      await page.mouse.click(box.x + 480 * box.width / 960, box.y + 252 * box.height / 540);
      await page.waitForFunction(() => window.__previewGame?.scene.isActive('Game') &&
        !!window.__previewGame.scene.getScene('Game').runEquipment);
      if (pairs) await page.waitForFunction(() =>
        !!window.__previewGame.scene.getScene('Game').slotPairsPreview);
      const state = await page.evaluate(() => {
        const scene = window.__previewGame.scene.getScene('Game');
        const demo = scene.slotPairsPreview || null;
        return {
          demo, active: window.GardenSlotPairsDemo.active,
          count: scene.children.list.filter(x => x.name?.startsWith('slot-pairs-demo-pair:')).length,
          dividers: scene.children.list.some(x => x.name === 'slot-pairs-demo-dividers'),
          shield: scene.children.list.some(x => x.name === 'slot-pairs-demo-input-shield' && !!x.input),
          rock: scene.children.list.some(x => x.name === 'slot-pairs-demo-rock'),
          runSlotCount: scene.run.state.slotCount
        };
      });
      if (!pairs) {
        assert.equal(state.demo, null);
        assert.equal(state.active, false);
        assert.equal(state.count, 0);
      } else {
        assert.equal(state.demo.pairs, pairs);
        assert.equal(state.demo.size, size);
        assert.equal(state.demo.gap, 3);
        assert.equal(state.demo.left, 10);
        assert.equal(state.demo.right, 740);
        assert.equal(state.demo.width, pairs * 2 * size + (pairs - 1) * 3);
        assert.equal(state.demo.positions[0], 10);
        assert.equal(state.demo.positions.at(-1) + size * 2, 10 + state.demo.width);
        assert.ok(10 + state.demo.width <= 740);
        assert.equal(state.count, pairs);
        assert.ok(state.active && state.dividers && state.shield && state.rock);
        assert.ok(state.runSlotCount <= 10, 'Visual comparison must not unlock new inventory slots');
      }
      assert.deepEqual(errors, [], 'Browser errors ' + JSON.stringify({ width, height, pairs }));
      console.log('Slot pair preview PASS', width, height, pairs || 'normal',
        pairs ? state.demo.width + 'px' : 'no overlay');
      await page.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
