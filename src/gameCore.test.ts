import { describe, expect, it } from 'vitest';
import {
  checkPathClear,
  Direction,
  DragonSystem,
  GameCoreController,
  SlotManager,
  type Ball,
  type DragonSegment
} from './gameCore';

function ball(overrides: Partial<Ball>): Ball {
  return {
    id: 'b',
    color: 'red',
    points: 2,
    dir: Direction.RIGHT,
    position: { x: 0, y: 0 },
    isMoving: false,
    ...overrides
  };
}

function segment(overrides: Partial<DragonSegment>): DragonSegment {
  return {
    id: 's',
    color: 'red',
    currentHP: 2,
    maxHP: 2,
    x: 0,
    ...overrides
  };
}

describe('checkPathClear', () => {
  it('detects blocker on selected direction', () => {
    const selected = ball({ id: '1', dir: Direction.RIGHT, position: { x: 0, y: 0 } });
    const blocker = ball({ id: '2', position: { x: 1, y: 0.001 } });

    expect(checkPathClear(selected, [selected, blocker], 0.01)).toBe(false);
  });

  it('ignores balls off ray', () => {
    const selected = ball({ id: '1', dir: Direction.UP, position: { x: 0, y: 0 } });
    const offRay = ball({ id: '2', position: { x: 1, y: 2 } });

    expect(checkPathClear(selected, [selected, offRay])).toBe(true);
  });
});

describe('SlotManager', () => {
  it('unlocks slot via ad callback when active slots are full', async () => {
    const slotManager = new SlotManager(async () => true);

    for (let i = 0; i < 4; i += 1) {
      await slotManager.addBall(ball({ id: `a-${i}` }));
    }

    const added = await slotManager.addBall(ball({ id: 'after-ad' }));
    expect(added).toBe(true);
    expect(slotManager.getActiveCapacity()).toBe(5);
  });
});

describe('GameCoreController integration', () => {
  it('matches leftmost slot ball and destroys dragon head', async () => {
    const balls = [
      ball({ id: 'r1', color: 'red', points: 2, dir: Direction.RIGHT, position: { x: 0, y: 0 } }),
      ball({ id: 'r2', color: 'red', points: 1, dir: Direction.RIGHT, position: { x: 1, y: 1 } })
    ];

    const dragon = new DragonSystem(
      [segment({ id: 'head', color: 'red', currentHP: 2, maxHP: 2, x: 10 }), segment({ id: 'tail', color: 'blue', x: 12 })],
      1,
      2
    );
    const slotManager = new SlotManager(async () => true);
    const controller = new GameCoreController([...balls], slotManager, dragon);

    const clicked = await controller.onBallClick('r1');

    expect(clicked).toBe(true);
    expect(dragon.getHead()?.id).toBe('tail');
    expect(slotManager.getSlots().filter((s) => s.ball !== null).length).toBe(0);
  });

  it('updates dragon position with time-scaled speed', () => {
    const dragon = new DragonSystem([segment({ id: 'head', x: 0 })], 2, 2);
    dragon.updateDragonPos(1, 60);
    expect(dragon.getHead()?.x).toBe(4);
  });
});
