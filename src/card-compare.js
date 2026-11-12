(function () {
  'use strict';
  const R = window.GardenPalette.reference.hex;
  const P = { grid: R.tab, paper: R.hover, growth: R.green }, sprites = window.GardenTestSprites;
  const paddings = [1, 2, 3, 4], iconSize = 16, line = 1;
  const sizeFor = padding => iconSize + 2 * (padding + line);
  function frame(ctx, x, y, size, color, method) {
    if (method === 'edges') {
      ctx.fillStyle = P.grid;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, 1);
      ctx.fillRect(x, y + size - 1, size, 1);
      ctx.fillRect(x, y + 1, 1, size - 2);
      ctx.fillRect(x + size - 1, y + 1, 1, size - 2);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = P.grid;
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    }
  }
  const icons = Object.fromEntries(['wheelbarrow', 'daisy'].map(name => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = iconSize;
    const ctx = canvas.getContext('2d'), image = ctx.createImageData(iconSize, iconSize);
    image.data.set(sprites.pixelData(name, iconSize));
    ctx.putImageData(image, 0, 0);
    return [name, canvas];
  }));
  const samples = document.getElementById('samples'), scale = document.getElementById('scale');
  function show() {
    samples.replaceChildren();
    samples.style.gridTemplateColumns = 'repeat(auto-fit, minmax(min(100%, ' + (76 * Number(scale.value) + 26) + 'px), 1fr))';
    for (const padding of paddings) {
      const size = sizeFor(padding), card = document.createElement('section');
      card.className = 'sample' + (padding === 3 ? ' current' : '');
      const title = document.createElement('strong');
      title.textContent = '패딩 ' + padding + 'px' + (padding === 3 ? ' · 현재' : '');
      const canvas = document.createElement('canvas');
      canvas.width = 76; canvas.height = 36;
      canvas.style.width = (canvas.width * Number(scale.value)) + 'px';
      canvas.style.height = 'auto';
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (const [name, cx, color] of [['wheelbarrow', 20, P.paper], ['daisy', 56, P.growth]]) {
        const x = cx - size / 2, y = (36 - size) / 2;
        frame(ctx, x, y, size, color, 'fill');
        ctx.drawImage(icons[name], x + padding + line, y + padding + line);
      }
      const caption = document.createElement('small');
      caption.textContent = size + '×' + size + 'px · 백색 / 황록';
      card.append(title, canvas, caption); samples.append(card);
    }
  }
  scale.addEventListener('change', show);
  show();
  const run = document.getElementById('run'), status = document.getElementById('status'), results = document.getElementById('results');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  function measure(size, method, count) {
    const columns = Math.floor(256 / size), slots = columns * columns;
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const k = i % slots;
      frame(ctx, (k % columns) * size, Math.floor(k / columns) * size, size, i % 2 ? P.growth : P.paper, method);
    }
    // 실제 그리기 완료를 강제하는 readback 포함. 프레임 FPS 측정은 아님.
    ctx.getImageData(0, 0, 256, 256);
    return performance.now() - start;
  }
  function median(values) { return values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]; }
  run.addEventListener('click', () => {
    run.disabled = true; status.textContent = '측정 중…'; results.replaceChildren();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        for (const padding of paddings) {
          const size = sizeFor(padding), times = { fill: [], edges: [] };
          for (const method of ['fill', 'edges']) measure(size, method, 1000);
          for (let round = 0; round < 7; round++) {
            for (const method of round % 2 ? ['edges', 'fill'] : ['fill', 'edges']) times[method].push(measure(size, method, 10000));
          }
          const row = document.createElement('tr');
          for (const value of [padding + 'px / ' + size + 'px', median(times.fill).toFixed(2) + ' ms', median(times.edges).toFixed(2) + ' ms']) {
            const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
          }
          results.append(row);
        }
        status.textContent = '측정 완료 · 10,000장 기준 중앙값 (브라우저/장치별 차이 가능)';
      } catch (error) { status.textContent = '측정 실패: ' + error.message; }
      finally { run.disabled = false; }
    }));
  });
}());
