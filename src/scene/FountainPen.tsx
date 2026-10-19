import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { DESK, NOTEBOOK } from './layout'

// A fountain pen in black precious resin with gold trim and a two-tone nib, lying uncapped beside the
// notebook with its cap next to it. Every part is a lathe around the pen's axis (local +Y, back end at 0),
// so the silhouettes are smooth and the reflections run cleanly along the barrel.

const v = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(r, y))
const lathe = (pts: [number, number][], seg = 64, phiStart?: number, phiLength?: number) =>
  new THREE.LatheGeometry(v(pts), seg, phiStart, phiLength)

/** Upward on the desk, once the pen is laid on its side: local −X (φ = 3π/2 in lathe terms). */
const TOP = Math.PI * 1.5

const NIB = { y0: 0.1045, len: 0.0285 }
const nibR = (t: number) => (t < 0.18 ? 0.0051 : 0.0051 * Math.max(0, 1 - (t - 0.18) / 0.82) ** 0.85 + 0.00022)

/** A band of the nib surface between t0 and t1, `span` radians wide around the top, lifted by `lift`. */
function nibStrip(t0: number, t1: number, span: number, lift = 0, steps = 24) {
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps
    pts.push([nibR(t) + lift, NIB.y0 + t * NIB.len])
  }
  return lathe(pts, 24, TOP - span / 2, span)
}

const MATS = {
  resin: new THREE.MeshPhysicalMaterial({ color: '#0a0a0d', roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9 }),
  gold: new THREE.MeshPhysicalMaterial({ color: '#e2b65c', metalness: 1, roughness: 0.16, side: THREE.DoubleSide, envMapIntensity: 1.1 }),
  rhodium: new THREE.MeshPhysicalMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.1, side: THREE.DoubleSide, envMapIntensity: 1.1 }),
  ebonite: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 }),
  ink: new THREE.MeshBasicMaterial({ color: '#050505', side: THREE.DoubleSide }),
}
const useMaterials = () => MATS

/**
 * The room's environment is dimmed at night (scene.environmentIntensity), which turns polished metal black.
 * Giving the pen its own reference to the same environment makes it use these fixed intensities instead, so
 * the gold and lacquer keep their glints in lamplight.
 */
function useOwnReflections() {
  useFrame(({ scene }) => {
    const env = scene.environment
    if (!env || MATS.gold.envMap === env) return
    for (const m of [MATS.resin, MATS.gold, MATS.rhodium]) {
      m.envMap = env
      m.needsUpdate = true
    }
  })
}

function PenBody() {
  const m = useMaterials()
  const g = useMemo(() => ({
    finial: lathe([[0, 0], [0.0036, 0.0006], [0.0053, 0.0023], [0.0058, 0.0042]]),
    endRing: lathe([[0.0058, 0.0042], [0.0061, 0.0044], [0.0061, 0.0058], [0.0058, 0.006]]),
    barrel: lathe([[0.0058, 0.006], [0.0062, 0.02], [0.0066, 0.045], [0.0065, 0.07], [0.0062, 0.0838]]),
    threadRing: lathe([[0.0062, 0.0838], [0.0065, 0.0841], [0.0065, 0.0869], [0.0059, 0.0872]]),
    section: lathe([[0.0059, 0.0872], [0.0054, 0.093], [0.0049, 0.1], [0.0051, 0.1048], [0.0054, 0.1066], [0.0046, 0.1078], [0.003, 0.108]]),
    feed: lathe([[0.0043, 0.104], [0.0038, 0.112], [0.0026, 0.12], [0.0012, 0.1255], [0, 0.126]], 32),
    nib: nibStrip(0, 1, Math.PI * 0.95),
    inlay: nibStrip(0.3, 0.78, Math.PI * 0.55, 0.00004), // rhodium plating: the two-tone nib
    slit: nibStrip(0.47, 1, 0.05, 0.00008, 12),
  }), [])
  const holeY = NIB.y0 + 0.47 * NIB.len
  return (
    <group>
      <mesh geometry={g.finial} material={m.gold} castShadow />
      <mesh geometry={g.endRing} material={m.gold} castShadow />
      <mesh geometry={g.barrel} material={m.resin} castShadow receiveShadow />
      <mesh geometry={g.threadRing} material={m.gold} castShadow />
      <mesh geometry={g.section} material={m.resin} castShadow />
      {/* feed sits under the nib */}
      <mesh geometry={g.feed} material={m.ebonite} scale={[0.85, 1, 0.85]} position={[0.0006, 0, 0]} castShadow />
      <mesh geometry={g.nib} material={m.gold} castShadow />
      <mesh geometry={g.inlay} material={m.rhodium} />
      <mesh geometry={g.slit} material={m.ink} />
      {/* breather hole */}
      <mesh material={m.ink} position={[-(nibR(0.47) + 0.0001), holeY, 0]} rotation-y={-Math.PI / 2}>
        <circleGeometry args={[0.00055, 20]} />
      </mesh>
    </group>
  )
}

function PenCap() {
  const m = useMaterials()
  const g = useMemo(() => ({
    shell: lathe([[0.0071, 0], [0.0072, 0.011], [0.0072, 0.045], [0.0068, 0.057], [0.0058, 0.0618], [0.0038, 0.0638], [0, 0.064]]),
    lining: lathe([[0, 0.002], [0.0062, 0.002], [0.0066, 0.0003]], 48),
    band: lathe([[0.0071, 0.0028], [0.00745, 0.003], [0.00745, 0.0102], [0.0071, 0.0104]]),
    ring: lathe([[0.0072, 0.0121], [0.0074, 0.0123], [0.0074, 0.0133], [0.0072, 0.0135]]),
    top: lathe([[0, 0.0647], [0.0026, 0.0643], [0.0039, 0.0636], [0.0041, 0.063]], 48),
    clip: new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.0052, 0.0625, 0),
        new THREE.Vector3(-0.0079, 0.0585, 0),
        new THREE.Vector3(-0.0085, 0.045, 0),
        new THREE.Vector3(-0.0084, 0.03, 0),
        new THREE.Vector3(-0.008, 0.0215, 0),
      ]),
      40, 0.00085, 10,
    ),
  }), [])
  return (
    <group>
      <mesh geometry={g.shell} material={m.resin} castShadow receiveShadow />
      <mesh geometry={g.lining} material={m.ebonite} />
      <mesh geometry={g.band} material={m.gold} castShadow />
      <mesh geometry={g.ring} material={m.gold} castShadow />
      <mesh geometry={g.top} material={m.gold} castShadow />
      {/* flattened, tapering clip with a ball end */}
      <group scale={[1, 1, 2.1]}>
        <mesh geometry={g.clip} material={m.gold} castShadow />
      </group>
      <mesh material={m.gold} position={[-0.0081, 0.0212, 0]} scale={[1, 1, 1.3]} castShadow>
        <sphereGeometry args={[0.0017, 20, 16]} />
      </mesh>
    </group>
  )
}

/**
 * Lays a lathe-built part on its side: `from` is where its back end rests (desk x, z), `toward` the direction
 * its axis points along the desk, `rest` the radius it rolls on.
 */
function OnDesk({ from, toward, rest, roll = 0, children }: {
  from: [number, number]; toward: [number, number]; rest: number; roll?: number; children: React.ReactNode
}) {
  const yaw = Math.atan2(-toward[1], toward[0])
  return (
    <group position={[from[0], DESK.top + rest, from[1]]} rotation-y={yaw}>
      {/* lathe axis (+Y) → +X, keeping the "top" side of the part facing up */}
      <group rotation-z={-Math.PI / 2}>
        <group rotation-y={roll}>{children}</group>
      </group>
    </group>
  )
}

/**
 * The pen lies alongside the right edge of the notebook, uncapped with the cap posted on its end (one long,
 * slim line), nib towards the top of the page and turned a few degrees in, clip uppermost.
 */
const SLIM = [0.86, 1.05, 0.86] as const // slimmer, slightly longer than the parts are modelled
const POSTED = 0.03 // how far the posted cap slides over the barrel
const CAP_LEN = 0.064
export function FountainPen() {
  useOwnReflections()
  const z = NOTEBOOK.z
  return (
    <OnDesk from={[0.19, z + 0.07]} toward={[-0.1, -0.995]} rest={0.00745 * SLIM[0]} roll={-0.3}>
      <group scale={SLIM}>
        <group position-y={CAP_LEN - POSTED}>
          <PenBody />
          {/* posted: turned end for end (about X, so the clip stays on top) and pushed onto the barrel */}
          <group position-y={POSTED} rotation-x={Math.PI}>
            <PenCap />
          </group>
        </group>
      </group>
    </OnDesk>
  )
}
