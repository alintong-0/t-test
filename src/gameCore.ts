export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  id: string;
  color: string;
  points: number;
  dir: Direction;
  position: Vec2;
  isMoving: boolean;
}

export interface DragonSegment {
  id: string;
  color: string;
  currentHP: number;
  maxHP: number;
  x: number;
}

export type SlotState = 'active' | 'locked';

export interface Slot {
  state: SlotState;
  ball: Ball | null;
}

export function checkPathClear(selectedBall: Ball, allBalls: Ball[], threshold = 0.01): boolean {
  const blockers = allBalls.filter((b) => b.id !== selectedBall.id);

  return !blockers.some((candidate) => {
    switch (selectedBall.dir) {
      case Direction.UP:
        return (
          Math.abs(candidate.position.x - selectedBall.position.x) <= threshold &&
          candidate.position.y > selectedBall.position.y + threshold
        );
      case Direction.DOWN:
        return (
          Math.abs(candidate.position.x - selectedBall.position.x) <= threshold &&
          candidate.position.y < selectedBall.position.y - threshold
        );
      case Direction.LEFT:
        return (
          Math.abs(candidate.position.y - selectedBall.position.y) <= threshold &&
          candidate.position.x < selectedBall.position.x - threshold
        );
      case Direction.RIGHT:
        return (
          Math.abs(candidate.position.y - selectedBall.position.y) <= threshold &&
          candidate.position.x > selectedBall.position.x + threshold
        );
      default:
        return false;
    }
  });
}

export class SlotManager {
  private readonly slots: Slot[];

  constructor(
    readonly onShowAd: () => Promise<boolean>,
    readonly maxSlots = 7,
    readonly initialActiveSlots = 4
  ) {
    this.slots = Array.from({ length: maxSlots }, (_, index) => ({
      state: index < initialActiveSlots ? 'active' : 'locked',
      ball: null
    }));
  }

  getSlots(): ReadonlyArray<Slot> {
    return this.slots;
  }

  getActiveCapacity(): number {
    return this.slots.filter((s) => s.state === 'active').length;
  }

  private findEmptyActiveSlotIndex(): number {
    return this.slots.findIndex((slot) => slot.state === 'active' && slot.ball === null);
  }

  async addBall(ball: Ball): Promise<boolean> {
    const emptyIndex = this.findEmptyActiveSlotIndex();
    if (emptyIndex >= 0) {
      this.slots[emptyIndex].ball = ball;
      return true;
    }

    const lockedIndex = this.slots.findIndex((slot) => slot.state === 'locked');
    if (lockedIndex >= 0) {
      const unlocked = await this.onShowAd();
      if (!unlocked) return false;

      this.slots[lockedIndex].state = 'active';
      this.slots[lockedIndex].ball = ball;
      return true;
    }

    return false;
  }

  compact(): void {
    const balls = this.slots.filter((s) => s.ball !== null).map((s) => s.ball) as Ball[];

    let ballCursor = 0;
    for (const slot of this.slots) {
      if (slot.state === 'active') {
        slot.ball = balls[ballCursor] ?? null;
        ballCursor += 1;
      } else {
        slot.ball = null;
      }
    }
  }

  consumeBall(slotIndex: number, amount = 1): Ball | null {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.ball) return null;

    slot.ball.points -= amount;
    if (slot.ball.points <= 0) {
      const removed = slot.ball;
      slot.ball = null;
      this.compact();
      return removed;
    }

    return null;
  }

  findLeftmostMatch(color: string): number {
    return this.slots.findIndex((slot) => slot.state === 'active' && slot.ball?.color === color);
  }
}

export class DragonSystem {
  constructor(
    private segments: DragonSegment[],
    private readonly baseSpeed: number,
    private readonly recoilDistance: number
  ) {}

  getSegments(): ReadonlyArray<DragonSegment> {
    return this.segments;
  }

  getHead(): DragonSegment | null {
    return this.segments[0] ?? null;
  }

  updateDragonPos(deltaTime: number, elapsedTime: number): void {
    const speed = this.baseSpeed * (1 + elapsedTime / 60);
    const displacement = speed * deltaTime;
    for (const segment of this.segments) {
      segment.x += displacement;
    }
  }

  recoilAll(): void {
    for (const segment of this.segments) {
      segment.x -= this.recoilDistance;
    }
  }

  executeMatch(ball: Ball): boolean {
    const head = this.getHead();
    if (!head || head.color !== ball.color) return false;

    head.currentHP -= ball.points;
    if (head.currentHP > 0) return false;

    this.segments.shift();
    this.recoilAll();
    this.fillGap();
    return true;
  }

  private fillGap(): void {
    for (let i = 1; i < this.segments.length; i += 1) {
      const prev = this.segments[i - 1];
      const current = this.segments[i];
      if (current.x < prev.x + 1) {
        current.x = prev.x + 1;
      }
    }
  }
}

export class GameCoreController {
  public globalInputInteractable = true;

  constructor(
    private balls: Ball[],
    readonly slotManager: SlotManager,
    readonly dragonSystem: DragonSystem
  ) {}

  getBalls(): ReadonlyArray<Ball> {
    return this.balls;
  }

  async onBallClick(ballId: string): Promise<boolean> {
    if (!this.globalInputInteractable) return false;

    const ball = this.balls.find((b) => b.id === ballId);
    if (!ball || ball.isMoving) return false;

    if (!checkPathClear(ball, this.balls)) return false;

    this.globalInputInteractable = false;
    ball.isMoving = true;

    const moved = await this.slotManager.addBall(ball);

    ball.isMoving = false;
    this.globalInputInteractable = true;

    if (!moved) return false;

    this.balls = this.balls.filter((b) => b.id !== ball.id);
    this.resolveSlotMatches();
    return true;
  }

  private resolveSlotMatches(): void {
    while (true) {
      const head = this.dragonSystem.getHead();
      if (!head) return;

      const slotIndex = this.slotManager.findLeftmostMatch(head.color);
      if (slotIndex < 0) return;

      const slot = this.slotManager.getSlots()[slotIndex];
      if (!slot.ball) return;

      const consumedBall = { ...slot.ball, points: 1 };
      const destroyed = this.dragonSystem.executeMatch(consumedBall);
      this.slotManager.consumeBall(slotIndex, 1);

      if (!destroyed) continue;
    }
  }

  checkGameOver(finishLineX: number): boolean {
    const head = this.dragonSystem.getHead();
    return !!head && head.x >= finishLineX;
  }
}
