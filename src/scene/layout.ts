// Every placement in the study lives here. Units are metres, Y is up, the desk faces +Z.

export type Vec3 = [number, number, number]
export type Mode = 'day' | 'night'

export const ROOM = {
  backZ: -0.62, // wall the desk stands against
  leftX: -1.55, // wall with the window
  rightX: 1.95,
  frontZ: 3.2,
  height: 2.8,
  window: { z0: -0.25, z1: 0.95, y0: 0.92, y1: 2.25 },
}

export const DESK = { w: 1.45, d: 0.74, top: 0.76, thickness: 0.045, x: 0, z: ROOM.backZ + 0.37 + 0.06 }

/** One page of the open notebook (A5). The spine runs along Z through x = NOTEBOOK.x. */
export const PAGE = { w: 0.148, d: 0.21, block: 0.0065 /* page stack thickness per side */ }
export const NOTEBOOK = {
  x: 0,
  z: DESK.z + 0.1,
  cover: 0.0032, // board thickness
  coverMargin: 0.005,
  /** height of the paper surface away from the gutter — what the landing camera frames */
  get pageY() {
    return DESK.top + this.cover + PAGE.block
  },
}
export const PAPER_HEX = '#FDF6E2'

export const LAMP = { x: -0.5, z: ROOM.backZ + 0.2 }
export const GRAMOPHONE = { x: 0.47, z: DESK.z - 0.07, yaw: -0.6 }
export const CUP = { x: 0.27, z: DESK.z + 0.23 }

/** Scroll milestones (0..1 across the scroll track). */
export const TIMELINE = {
  wideEnd: 0.3, // lens narrows from the wide establishing shot to the working focal length
  open: [0.36, 0.68] as const, // notebook opens as the camera closes in
  land: 0.94, // camera settles straight above the spread; the page ends just after, so it can't go further
}

/** Lens: wide for the establishing shot (shows the bookshelf), narrower for the approach. */
export const fovFor = (aspect: number) => (aspect < 1 ? 58 : 40)
export const wideFovFor = (aspect: number) => (aspect < 1 ? 70 : 52)

/** What the final frame holds: the two pages filling the tighter side of the screen edge to edge, never closer. */
const LANDING_FIT = 1
export const LANDING_FRAME = { w: 2 * PAGE.w, h: PAGE.d }

export function landingDistance(aspect: number, fov: number) {
  const t = Math.tan((fov * Math.PI) / 360)
  return Math.max(LANDING_FRAME.h / (LANDING_FIT * 2 * t), LANDING_FRAME.w / (LANDING_FIT * 2 * t * aspect))
}

export type Pose = { at: number; position: Vec3; target: Vec3 }

/**
 * Continuous camera path. The last two poses share the spine's X so the view never rolls
 * as it tips over to look straight down at the spread.
 */
export function cameraPath(aspect: number, fov: number): Pose[] {
  const y = NOTEBOOK.pageY
  const z = NOTEBOOK.z
  const portrait = aspect < 1
  return [
    { at: 0, position: portrait ? [0.95, 1.68, 3.15] : [0.82, 1.62, 2.8], target: [0.22, 1.05, -0.4] },
    { at: 0.3, position: [0.62, 1.28, 1.05], target: [0.0, 0.86, -0.2] },
    { at: 0.6, position: [0.04, 1.08, 0.48], target: [0, y + 0.01, z - 0.02] },
    { at: 0.76, position: [0, y + 0.26, z + 0.11], target: [0, y, z] },
    { at: TIMELINE.land, position: [0, y + landingDistance(aspect, fov), z + 0.0001], target: [0, y, z] },
  ]
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
