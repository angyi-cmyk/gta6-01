// Particles: smoke, sparks, blood puffs, skid marks and explosions. One job:
// make impacts and speed visible.
import { makeRng, pick, range } from './random.js';

export function makeParticles() {
  return { list: [], skids: [] };
}

export function addParticles(state, kind, x, y, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    const angle = range(rng, 0, Math.PI * 2);
    const speed = kind === 'explosion' ? range(rng, 60, 320) : range(rng, 20, 140);
    state.particles.list.push({
      kind,
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: kind === 'smoke' ? range(rng, 0.7, 1.6) : range(rng, 0.2, 0.7),
      maxLife: 1,
      size: kind === 'explosion' ? range(rng, 5, 12) : range(rng, 2, 6),
      color: kind === 'smoke' ? '#5a5a5a' : kind === 'spark' ? pick(rng, ['#ffd23d', '#ff9a3d', '#fff2a8']) : kind === 'blood' ? '#a02020' : pick(rng, ['#ff7a2d', '#ffd23d', '#8a8a8a']),
    });
    const p = state.particles.list[state.particles.list.length - 1];
    p.maxLife = p.life;
  }
}

export function addSkid(state, x, y, angle) {
  state.particles.skids.push({ x, y, angle, life: 6 });
  if (state.particles.skids.length > 220) state.particles.skids.shift();
}

export function updateParticles(state, dt) {
  const list = state.particles.list;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - 2.4 * dt);
    p.vy *= Math.max(0, 1 - 2.4 * dt);
    if (p.kind === 'smoke') {
      p.y -= 22 * dt;
      p.size += 14 * dt;
    }
  }
  for (let i = state.particles.skids.length - 1; i >= 0; i -= 1) {
    const s = state.particles.skids[i];
    s.life -= dt;
    if (s.life <= 0) state.particles.skids.splice(i, 1);
  }
}
