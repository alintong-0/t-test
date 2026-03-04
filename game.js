const COLORS = ['#21d2bf', '#356dff', '#f38a1f', '#a03be8', '#6ccf32', '#f0c431'];
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
const DIRS = Object.keys(ARROWS);

const state = {
  gridCols: 8,
  gridRows: 9,
  blocks: [],
  slots: [],
  dragon: [],
  dragonProgress: 0,
  gameOver: false,
  totalDragonStart: 0
};

const els = {
  grid: document.getElementById('grid'),
  slots: document.getElementById('slots'),
  msg: document.getElementById('message'),
  dragonInfo: document.getElementById('dragonInfo'),
  progressInfo: document.getElementById('progressInfo'),
  canvas: document.getElementById('dragonCanvas'),
  restart: document.getElementById('restartBtn')
};
const ctx = els.canvas.getContext('2d');

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildLevel() {
  state.blocks = [];
  const cells = state.gridCols * state.gridRows;
  for (let i = 0; i < cells; i += 1) {
    const fill = Math.random() > 0.27;
    if (!fill) continue;
    state.blocks.push({
      id: `b${i}`,
      cell: i,
      color: rand(COLORS),
      dir: rand(DIRS),
      value: 1
    });
  }

  state.slots = Array.from({ length: 7 }, (_, i) => ({
    active: i < 4,
    item: null
  }));

  const dragonLen = 40;
  state.dragon = Array.from({ length: dragonLen }, (_, i) => ({
    id: `d${i}`,
    color: rand(COLORS),
    t: 0.05 + i * 0.018
  }));
  state.totalDragonStart = dragonLen;
  state.dragonProgress = 0;
  state.gameOver = false;
}

function getBlockAt(col, row) {
  return state.blocks.find((b) => b.cell === row * state.gridCols + col) || null;
}

function cellToXY(cell) {
  return { col: cell % state.gridCols, row: Math.floor(cell / state.gridCols) };
}

function pathClear(block) {
  const { col, row } = cellToXY(block.cell);
  if (block.dir === 'up') {
    for (let r = row - 1; r >= 0; r--) if (getBlockAt(col, r)) return false;
  } else if (block.dir === 'down') {
    for (let r = row + 1; r < state.gridRows; r++) if (getBlockAt(col, r)) return false;
  } else if (block.dir === 'left') {
    for (let c = col - 1; c >= 0; c--) if (getBlockAt(c, row)) return false;
  } else {
    for (let c = col + 1; c < state.gridCols; c++) if (getBlockAt(c, row)) return false;
  }
  return true;
}

function slotAdd(block) {
  const empty = state.slots.find((s) => s.active && !s.item);
  if (empty) {
    empty.item = { color: block.color, value: block.value };
    return true;
  }
  const locked = state.slots.find((s) => !s.active);
  if (locked) {
    locked.active = true;
    locked.item = { color: block.color, value: block.value };
    setMsg('已自动解锁 1 个槽位（模拟广告）。');
    return true;
  }
  return false;
}

function compactSlots() {
  const active = state.slots.filter((s) => s.active);
  const items = active.filter((s) => s.item).map((s) => s.item);
  active.forEach((s, i) => { s.item = items[i] ?? null; });
}

function matchLoop() {
  let changed = false;
  while (state.dragon.length) {
    const head = state.dragon[0];
    const idx = state.slots.findIndex((s) => s.active && s.item && s.item.color === head.color);
    if (idx < 0) break;
    const slot = state.slots[idx];
    slot.item.value -= 1;
    state.dragon.shift();
    changed = true;
    if (slot.item.value <= 0) slot.item = null;
    compactSlots();
  }
  if (changed) {
    state.dragonProgress = Math.round((1 - state.dragon.length / state.totalDragonStart) * 100);
  }
}

function tryLoseByDeadlock() {
  const active = state.slots.filter((s) => s.active);
  if (active.every((s) => s.item) && state.dragon.length) {
    const headColor = state.dragon[0].color;
    const hasMatch = active.some((s) => s.item?.color === headColor);
    if (!hasMatch) {
      state.gameOver = true;
      setMsg('失败：槽位已满且无可匹配颜色。');
    }
  }
}

function colorName(hex) { return hex; }

function clickBlock(id) {
  if (state.gameOver) return;
  const b = state.blocks.find((x) => x.id === id);
  if (!b) return;
  if (!pathClear(b)) {
    setMsg('路径被阻挡：只能选择箭头方向无遮挡的方块。');
    render();
    return;
  }
  const ok = slotAdd(b);
  if (!ok) {
    state.gameOver = true;
    setMsg('失败：槽位已满，无法继续。');
    render();
    return;
  }
  state.blocks = state.blocks.filter((x) => x.id !== id);
  setMsg(`入槽成功：${colorName(b.color)} ${ARROWS[b.dir]}`);
  matchLoop();
  tryLoseByDeadlock();
  if (!state.dragon.length) {
    state.gameOver = true;
    setMsg('胜利：你清空了整条大龙！');
  }
  render();
}

function setMsg(text) { els.msg.textContent = text; }

function drawDragonTrack() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

  ctx.strokeStyle = '#9bb8eb';
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(25, 180);
  ctx.bezierCurveTo(100, 36, 310, 44, 396, 172);
  ctx.stroke();

  const time = performance.now() / 1000;
  if (!state.gameOver) {
    const speed = 0.03;
    state.dragon.forEach((seg, i) => {
      seg.t += speed * (1 + (state.totalDragonStart - state.dragon.length) / 80) * 0.016;
      if (i > 0 && seg.t < state.dragon[i - 1].t + 0.018) seg.t = state.dragon[i - 1].t + 0.018;
    });
    state.dragonProgress = Math.round((1 - state.dragon.length / state.totalDragonStart) * 100);
    if (state.dragon[0]?.t > 1) {
      state.gameOver = true;
      setMsg('失败：大龙到达终点。');
    }
  }

  for (const seg of state.dragon) {
    const p = bezier(seg.t);
    ctx.fillStyle = seg.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.dragon.length) {
    const head = bezier(state.dragon[0].t);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(Math.sin(time) * 0.12);
    ctx.fillStyle = '#f95f2f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function bezier(t) {
  const p0 = { x: 25, y: 180 };
  const p1 = { x: 100, y: 36 };
  const p2 = { x: 310, y: 44 };
  const p3 = { x: 396, y: 172 };
  const u = 1 - t;
  const x = u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x;
  const y = u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y;
  return { x, y };
}

function renderSlots() {
  const head = state.dragon[0];
  els.slots.innerHTML = '';
  state.slots.forEach((slot) => {
    const div = document.createElement('div');
    div.className = `slot ${slot.active ? '' : 'locked'} ${slot.item && head && slot.item.color === head.color ? 'matching' : ''}`;
    if (!slot.active) {
      div.textContent = 'LOCK';
    } else if (!slot.item) {
      div.textContent = '';
    } else {
      div.style.background = slot.item.color;
      div.textContent = `${slot.item.value}`;
    }
    els.slots.appendChild(div);
  });
}

function renderGrid() {
  els.grid.innerHTML = '';
  const map = new Map(state.blocks.map((b) => [b.cell, b]));
  for (let i = 0; i < state.gridCols * state.gridRows; i += 1) {
    const b = map.get(i);
    const btn = document.createElement('button');
    if (!b) {
      btn.className = 'block';
      btn.style.visibility = 'hidden';
      btn.disabled = true;
    } else {
      btn.className = 'block';
      btn.style.background = b.color;
      btn.textContent = ARROWS[b.dir];
      btn.addEventListener('click', () => clickBlock(b.id));
      if (state.gameOver) btn.disabled = true;
    }
    els.grid.appendChild(btn);
  }
}

function render() {
  drawDragonTrack();
  renderSlots();
  renderGrid();
  els.dragonInfo.textContent = `大龙长度: ${state.dragon.length}`;
  els.progressInfo.textContent = `进度: ${state.dragonProgress}%`;
}

function tick() {
  drawDragonTrack();
  els.dragonInfo.textContent = `大龙长度: ${state.dragon.length}`;
  els.progressInfo.textContent = `进度: ${state.dragonProgress}%`;
  if (!state.gameOver) requestAnimationFrame(tick);
}

function start() {
  buildLevel();
  setMsg('规则：点击箭头方向无遮挡的方块入槽，自动匹配并消除大龙。');
  render();
  requestAnimationFrame(tick);
}

els.restart.addEventListener('click', start);
start();
