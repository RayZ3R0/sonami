/**
 * Spring animation utility for smooth, physics-based animations
 */

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
  precision: number;
}

export const SPRING_PRESETS = {
  gentle: { stiffness: 120, damping: 14, mass: 1, precision: 0.01 },
  default: { stiffness: 170, damping: 26, mass: 1, precision: 0.01 },
  wobbly: { stiffness: 180, damping: 12, mass: 1, precision: 0.01 },
  stiff: { stiffness: 210, damping: 20, mass: 1, precision: 0.01 },
  slow: { stiffness: 280, damping: 60, mass: 1, precision: 0.01 },
  molasses: { stiffness: 280, damping: 120, mass: 1, precision: 0.01 },
};

export class Spring {
  private value: number;
  private velocity: number;
  private target: number;
  private config: SpringConfig;

  constructor(
    initialValue: number = 0,
    config: SpringConfig = SPRING_PRESETS.default,
  ) {
    this.value = initialValue;
    this.velocity = 0;
    this.target = initialValue;
    this.config = config;
  }

  setGoal(newTarget: number, instant: boolean = false): void {
    this.target = newTarget;
    if (instant) {
      this.value = newTarget;
      this.velocity = 0;
    }
  }

  setConfig(config: SpringConfig): void {
    this.config = config;
  }

  step(deltaTime: number): number {
    if (deltaTime <= 0) return this.value;

    const { stiffness, damping, mass } = this.config;

    // Spring physics calculations
    const springForce = -stiffness * (this.value - this.target);
    const dampingForce = -damping * this.velocity;
    const acceleration = (springForce + dampingForce) / mass;

    this.velocity += acceleration * deltaTime;
    this.value += this.velocity * deltaTime;

    // Stop animation if close enough to target
    const distance = Math.abs(this.value - this.target);
    const velocityMagnitude = Math.abs(this.velocity);

    if (
      distance < this.config.precision &&
      velocityMagnitude < this.config.precision
    ) {
      this.value = this.target;
      this.velocity = 0;
    }

    return this.value;
  }

  getValue(): number {
    return this.value;
  }

  getTarget(): number {
    return this.target;
  }

  isAtRest(): boolean {
    const distance = Math.abs(this.value - this.target);
    const velocityMagnitude = Math.abs(this.velocity);
    return (
      distance < this.config.precision &&
      velocityMagnitude < this.config.precision
    );
  }

  reset(value: number = 0): void {
    this.value = value;
    this.velocity = 0;
    this.target = value;
  }
}

/**
 * Cubic spline interpolation for smooth easing curves
 */
export class Spline {
  private xs: number[];
  private ys: number[];
  private ks: number[];

  constructor(xs: number[], ys: number[]) {
    this.xs = xs;
    this.ys = ys;
    this.ks = this.getNaturalKs(xs, ys);
  }

  private getNaturalKs(xs: number[], ys: number[]): number[] {
    const n = xs.length - 1;
    const a: number[] = [];
    const b: number[] = [];
    const c: number[] = [];
    const d: number[] = [];

    for (let i = 1; i < n; i++) {
      a[i] = xs[i] - xs[i - 1];
      c[i] = xs[i + 1] - xs[i];
      b[i] = 2 * (a[i] + c[i]);
      d[i] = 6 * ((ys[i + 1] - ys[i]) / c[i] - (ys[i] - ys[i - 1]) / a[i]);
    }

    const ks = new Array(n + 1).fill(0);
    for (let i = 1; i < n; i++) {
      const m = a[i] / b[i];
      b[i + 1] = b[i + 1] - m * c[i];
      d[i + 1] = d[i + 1] - m * d[i];
    }

    ks[n] = 0;
    for (let i = n - 1; i > 0; i--) {
      ks[i] = (d[i] - c[i] * ks[i + 1]) / b[i];
    }
    ks[0] = 0;

    return ks;
  }

  at(x: number): number {
    let i = this.xs.length - 1;
    for (let j = 0; j < this.xs.length; j++) {
      if (this.xs[j] > x) {
        i = Math.max(0, j - 1);
        break;
      }
    }

    const dx = this.xs[i + 1] - this.xs[i];
    const t = (x - this.xs[i]) / dx;
    const a = this.ks[i] * dx - (this.ys[i + 1] - this.ys[i]);
    const b = -this.ks[i + 1] * dx + (this.ys[i + 1] - this.ys[i]);

    return (
      (1 - t) * this.ys[i] +
      t * this.ys[i + 1] +
      t * (1 - t) * (a * (1 - t) + b * t)
    );
  }
}
