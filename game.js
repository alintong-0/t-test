const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  level: document.getElementById('level'),
  shield: document.getElementById('shield'),
  aiDifficulty: document.getElementById('aiDifficulty'),
  overlay: document.getElementById('overlay'),
  startBtn: document.getElementById('startBtn')
};

const world = {
  w: canvas.width,
  h: canvas.height,
  playing: false,
  score: 0,
  level: 1,
  shield: 0,
  keys: { left: false, right: false },
  player: { x: canvas.width / 2 - 22, y: canvas.height - 80, w: 44, h: 54, speed: 340 },
  obstacles: [],
  pickups: [],
  particles: [],
  spawnTimer: 0,
  pickupTimer: 0,
  ai: {
    difficulty: 1,
    hitsWindow: [],
    nearMissWindow: [],
    survivalStart: 0
  },
  lastTs: 0
};

function resetGame() {
  world.playing = true;
  world.score = 0;
  world.level = 1;
  world.shield = 1;
  world.obstacles = [];
  world.pickups = [];
  world.particles = [];
  world.spawnTimer = 0;
  world.pickupTimer = 0;
  world.player.x = world.w / 2 - world.player.w / 2;
  world.ai.difficulty = 1;
  world.ai.hitsWindow = [];
  world.ai.nearMissWindow = [];
  world.ai.survivalStart = performance.now();
  ui.overlay.classList.remove('show');
}

function rectsCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnObstacle() {
  const laneWidth = world.w / 6;
  const lane = Math.floor(Math.random() * 6);
  const w = laneWidth * (0.7 + Math.random() * 0.6);
  world.obstacles.push({
    x: lane * laneWidth + (laneWidth - w) / 2,
    y: -60,
    w,
    h: 34 + Math.random() * 28,
    speed: 150 + world.ai.difficulty * 90 + Math.random() * 120
  });
}

function spawnPickup() {
  world.pickups.push({
    x: 20 + Math.random() * (world.w - 40),
    y: -20,
    r: 11,
    speed: 150,
    type: 'shield'
  });
}

function updateAIDirector(now) {
  const cutoff = now - 8000;
  world.ai.hitsWindow = world.ai.hitsWindow.filter((t) => t > cutoff);
  world.ai.nearMissWindow = world.ai.nearMissWindow.filter((t) => t > cutoff);

  const safeSeconds = (now - world.ai.survivalStart) / 1000;
  const offense = Math.min(1.8, safeSeconds / 20 + world.ai.nearMissWindow.length * 0.08);
  const defense = world.ai.hitsWindow.length * 0.35;
  world.ai.difficulty = Math.max(0.75, Math.min(2.6, 1 + offense - defense));

  if (world.ai.difficulty < 1.05 && Math.random() < 0.015 && world.pickups.length < 1) {
    spawnPickup();
  }

  world.level = 1 + Math.floor((world.ai.difficulty - 0.75) * 2.2);
}

function loseLifeOrEnd(now) {
  if (world.shield > 0) {
    world.shield -= 1;
    world.ai.hitsWindow.push(now);
    for (let i = 0; i < 12; i += 1) {
      world.particles.push({
        x: world.player.x + world.player.w / 2,
        y: world.player.y + world.player.h / 2,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        life: 0.5
      });
    }
    return;
  }

  world.playing = false;
  ui.overlay.innerHTML = `
    <h1>游戏结束</h1>
    <p>得分：${Math.floor(world.score)}</p>
    <p>AI 最终难度：${world.ai.difficulty.toFixed(2)}</p>
    <button id="restartBtn">再来一局</button>
  `;
  ui.overlay.classList.add('show');
  document.getElementById('restartBtn').addEventListener('click', resetGame, { once: true });
}

function update(dt, now) {
  if (!world.playing) return;

  if (world.keys.left) world.player.x -= world.player.speed * dt;
  if (world.keys.right) world.player.x += world.player.speed * dt;
  world.player.x = Math.max(0, Math.min(world.w - world.player.w, world.player.x));

  updateAIDirector(now);

  world.spawnTimer -= dt;
  const spawnGap = Math.max(0.14, 0.58 - world.ai.difficulty * 0.16);
  if (world.spawnTimer <= 0) {
    spawnObstacle();
    world.spawnTimer = spawnGap * (0.8 + Math.random() * 0.7);
  }

  world.pickupTimer -= dt;
  if (world.pickupTimer <= 0) {
    if (Math.random() < 0.28) spawnPickup();
    world.pickupTimer = 5.5;
  }

  world.score += dt * (18 + world.ai.difficulty * 8);

  world.obstacles.forEach((o) => {
    o.y += o.speed * dt;
    const dx = Math.abs(o.x + o.w / 2 - (world.player.x + world.player.w / 2));
    const dy = Math.abs(o.y + o.h / 2 - (world.player.y + world.player.h / 2));
    if (dy < 60 && dx < (o.w + world.player.w) * 0.6 && !o.near) {
      o.near = true;
      world.ai.nearMissWindow.push(now);
    }
  });

  world.pickups.forEach((p) => {
    p.y += p.speed * dt;
  });

  for (const o of world.obstacles) {
    if (rectsCollide(world.player, o)) {
      o.y = world.h + 100;
      loseLifeOrEnd(now);
    }
  }

  world.pickups = world.pickups.filter((p) => {
    const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
    if (rectsCollide(world.player, box)) {
      world.shield = Math.min(3, world.shield + 1);
      return false;
    }
    return p.y < world.h + 30;
  });

  world.obstacles = world.obstacles.filter((o) => o.y < world.h + 80);

  world.particles = world.particles.filter((pt) => {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    return pt.life > 0;
  });

  ui.score.textContent = Math.floor(world.score);
  ui.level.textContent = world.level;
  ui.shield.textContent = world.shield;
  ui.aiDifficulty.textContent = world.ai.difficulty.toFixed(2);
}

function draw() {
  ctx.clearRect(0, 0, world.w, world.h);

  const grad = ctx.createLinearGradient(0, 0, 0, world.h);
  grad.addColorStop(0, '#0b1430');
  grad.addColorStop(1, '#070b15');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, world.w, world.h);

  ctx.strokeStyle = '#1e3f73';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i += 1) {
    const x = (world.w / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.h);
    ctx.stroke();
  }

  ctx.fillStyle = '#44f0ff';
  ctx.beginPath();
  ctx.moveTo(world.player.x + world.player.w / 2, world.player.y);
  ctx.lineTo(world.player.x, world.player.y + world.player.h);
  ctx.lineTo(world.player.x + world.player.w, world.player.y + world.player.h);
  ctx.closePath();
  ctx.fill();

  world.obstacles.forEach((o) => {
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(o.x, o.y, o.w, o.h);
  });

  world.pickups.forEach((p) => {
    ctx.fillStyle = '#8df28d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  world.particles.forEach((pt) => {
    ctx.fillStyle = `rgba(255,255,255,${pt.life * 2})`;
    ctx.fillRect(pt.x, pt.y, 3, 3);
  });
}

function loop(ts) {
  if (!world.lastTs) world.lastTs = ts;
  const dt = Math.min(0.033, (ts - world.lastTs) / 1000);
  world.lastTs = ts;
  update(dt, ts);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') world.keys.left = true;
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') world.keys.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') world.keys.left = false;
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') world.keys.right = false;
});

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x < rect.width / 2) world.keys.left = true;
  else world.keys.right = true;
});
canvas.addEventListener('pointerup', () => {
  world.keys.left = false;
  world.keys.right = false;
});
canvas.addEventListener('pointerleave', () => {
  world.keys.left = false;
  world.keys.right = false;
});

ui.startBtn.addEventListener('click', resetGame);
requestAnimationFrame(loop);
