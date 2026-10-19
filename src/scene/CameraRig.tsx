import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { cameraPath, clamp01, fovFor, lerp, smoothstep, TIMELINE, wideFovFor } from './layout'
import { scroll } from './scroll'

const UP = new THREE.Vector3(0, 1, 0)
const UP_TOP_DOWN = new THREE.Vector3(0, 0, -1) // far edge of the desk at the top of the screen

/**
 * Flies the camera along a Catmull-Rom path through the poses in layout.ts. GSAP's scrubbed ScrollTrigger
 * already smooths `scroll.progress`, so the camera follows it directly. Past `TIMELINE.land` the pose is
 * frozen on the two-page spread: scrolling further never pushes the camera into the paper.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height
  const fov = fovFor(aspect)
  const wideFov = wideFovFor(aspect)

  const curves = useMemo(() => {
    const poses = cameraPath(aspect, fov)
    return {
      poses,
      pos: new THREE.CatmullRomCurve3(poses.map((p) => new THREE.Vector3(...p.position)), false, 'centripetal'),
      look: new THREE.CatmullRomCurve3(poses.map((p) => new THREE.Vector3(...p.target)), false, 'centripetal'),
    }
  }, [aspect, fov])

  useEffect(() => {
    camera.near = 0.01
    camera.far = 40
  }, [camera])

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), up: new THREE.Vector3() }), [])

  useFrame(() => {
    const { poses, pos, look } = curves
    const p = Math.min(scroll.progress, TIMELINE.land)
    // map scroll progress onto the curve parameter: each pose sits at its own `at`, eased inside each leg
    let i = 0
    while (i < poses.length - 2 && p > poses[i + 1].at) i++
    const a = poses[i].at, b = poses[i + 1].at
    let local = clamp01((p - a) / (b - a))
    if (i === poses.length - 2) local = 1 - (1 - local) ** 3 // settle softly onto the spread
    const u = (i + local) / (poses.length - 1)
    pos.getPoint(u, tmp.p)
    look.getPoint(u, tmp.t)
    // tip the up vector over as we end up looking straight down, so the spread reads upright
    const tip = smoothstep(poses[poses.length - 3].at, TIMELINE.land, p)
    tmp.up.copy(UP).lerp(UP_TOP_DOWN, tip).normalize()
    camera.position.copy(tmp.p)
    camera.up.copy(tmp.up)
    camera.lookAt(tmp.t)
    // wide establishing lens that narrows during the walk-up; the landing always uses `fov`
    const f = lerp(wideFov, fov, smoothstep(0, TIMELINE.wideEnd, scroll.progress))
    if (Math.abs(camera.fov - f) > 1e-4) {
      camera.fov = f
      camera.updateProjectionMatrix()
    }
  })
  return null
}
