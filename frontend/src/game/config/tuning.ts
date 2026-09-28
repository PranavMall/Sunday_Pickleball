// Central tuning. All gameplay "feel" numbers live here, never scattered in
// logic. Units: distance = feet, time = seconds, so speeds are ft/s.
//
// The shot model is TARGET-AIMED (not raw impulse): given a landing target and
// a shot type we solve vx,vy,vz so the ball lands there after a set flight
// time, guaranteeing it clears the net. This makes shots predictable and
// learnable, which the brief requires.

export const PHYS = {
  GRAVITY: 32, // ft/s^2
  BOUNCE_RESTITUTION: 0.45, // low, dead pickleball bounce
  BOUNCE_FRICTION: 0.72, // horizontal speed kept after a bounce
  DEAD_BALL_SPEED: 3.5, // ft/s below which a rolling ball is dead
  CONTACT_HEIGHT_GROUND: 1.4, // ft, contact point for a groundstroke
  CONTACT_HEIGHT_VOLLEY: 3.2, // ft, contact when taking it out of the air
  MAX_REACH_HEIGHT: 6.5, // ft, highest reachable ball
} as const;

export const PLAYER = {
  SPEED: 15.5, // ft/s base foot speed
  RADIUS: 0.9, // ft, body radius (spacing / collision)
  MIN_SEPARATION: 3.2, // ft, teammates keep at least this apart
  REACH: 3.0, // ft, how close to the ball to be able to strike it
  HIT_COOLDOWN: 0.35, // s between strikes by the same player
  RECOVER_DEPTH_BASELINE: 6.5, // ft in from baseline when recovering deep
  KITCHEN_LINE_STANDOFF: 1.2, // ft behind own kitchen line when playing net
} as const;

// Flight times (seconds) and target depths per shot type. Depth is measured
// from the receiving baseline inward (ft).
export const SHOTS = {
  serve: { flight: 1.15, contactH: 1.3, minDepth: 4, maxDepth: 13, netClear: 1.2 },
  drive: { flight: 0.72, contactH: 1.4, minDepth: 3, maxDepth: 16, netClear: 0.8 },
  drop: { flight: 1.0, contactH: 1.3, minDepth: 0.5, maxDepth: 5, netClear: 1.0 }, // lands in/near far kitchen
  dink: { flight: 0.85, contactH: 1.1, minDepth: 0.5, maxDepth: 6, netClear: 0.35 }, // soft into kitchen
  lob: { flight: 1.55, contactH: 1.5, minDepth: 2, maxDepth: 6, netClear: 5.0 }, // M2
  smash: { flight: 0.5, contactH: 3.4, minDepth: 3, maxDepth: 18, netClear: 0.6 }, // M2
} as const;

export type ShotTuning = (typeof SHOTS)[keyof typeof SHOTS];

// Swipe → shot mapping thresholds (power is 0..1 from swipe length).
export const INPUT = {
  MIN_SWIPE: 18, // px, below this = tap (serve release / no-op)
  POWER_MAX_PX: 230, // px swipe length that maps to full power
  DINK_POWER_MAX: 0.32, // power under this near the net = dink
  DRIVE_POWER_MIN: 0.55,
  DROP_POWER_MAX: 0.4,
} as const;

// Kitchen mechanic timings.
export const KITCHEN = {
  MOMENTUM_WINDOW: 0.6, // s after a volley in which entering NVZ is a fault
  REESTABLISH_TIME: 0.25, // s of both feet out required before a legal volley
  LINE_TOLERANCE: 0.25, // ft, treated as "touching" the kitchen line
} as const;

export const MATCH = {
  POINTS_TO_WIN: 11,
  WIN_BY: 2,
  FIXED_DT: 1 / 60, // simulation timestep (deterministic)
  SERVE_DELAY: 1.1, // s the server waits before an AI serve
  POINT_RESET_DELAY: 1.4, // s pause after a point before next serve setup
} as const;
