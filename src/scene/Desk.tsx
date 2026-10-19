import * as THREE from 'three'
import { RoundedBox, useGLTF } from '@react-three/drei'
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DESK } from './layout'
import { useMaterials } from './materials'

/** Dark-walnut writing desk with two drawers and brass pulls, built from primitives. */
export function ProceduralDesk() {
  const m = useMaterials()
  const { w, d, top, thickness: t } = DESK
  const legH = top - t
  const apronH = 0.13
  const inset = 0.05
  const legs: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  return (
    <group position={[DESK.x, 0, DESK.z]}>
      <RoundedBox args={[w, t, d]} radius={0.01} smoothness={4} position={[0, top - t / 2, 0]} material={m.deskTop} castShadow receiveShadow />
      {legs.map(([sx, sz], i) => (
        // square tapered legs: a 4-sided cylinder turned 45°
        <mesh key={i} material={m.deskWood} position={[sx * (w / 2 - inset), legH / 2, sz * (d / 2 - inset)]} rotation-y={Math.PI / 4} castShadow receiveShadow>
          <cylinderGeometry args={[0.032, 0.02, legH, 4]} />
        </mesh>
      ))}
      {/* aprons */}
      <mesh material={m.deskWood} position={[0, legH - apronH / 2, -d / 2 + inset]} castShadow receiveShadow>
        <boxGeometry args={[w - 2 * inset, apronH, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.deskWood} position={[s * (w / 2 - inset), legH - apronH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.02, apronH, d - 2 * inset]} />
        </mesh>
      ))}
      <mesh material={m.trim} position={[0, legH - apronH / 2, d / 2 - inset - 0.004]} castShadow receiveShadow>
        <boxGeometry args={[w - 2 * inset - 0.04, apronH, 0.012]} />
      </mesh>
      {[-0.36, 0.36].map((x) => (
        <group key={x} position={[x, legH - apronH / 2, d / 2 - inset + 0.006]}>
          <RoundedBox args={[0.5, apronH - 0.025, 0.018]} radius={0.004} smoothness={3} material={m.deskWood} castShadow receiveShadow />
          <mesh material={m.brass} position={[0, 0, 0.016]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.011, 0.014, 0.014, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---- Optional GLTF desk -------------------------------------------------------------------------------
// Drop a model at public/models/desk.glb and it replaces the procedural desk, scaled so its height matches
// DESK.top and centred on the desk's footprint. Without the file (or if it fails to load) the procedural
// desk stays.

const DESK_MODEL = `${import.meta.env.BASE_URL}models/desk.glb`

/** true once we know a real model file is served (Vite answers missing files with index.html). */
function useModelAvailable(url: string) {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    fetch(url, { method: 'HEAD' })
      .then((r) => live && setOk(r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')))
      .catch(() => live && setOk(false))
    return () => { live = false }
  }, [url])
  return ok
}

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function FittedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const fitted = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
    })
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const s = DESK.top / size.y
    root.scale.setScalar(s)
    const c = box.getCenter(new THREE.Vector3())
    root.position.set(DESK.x - c.x * s, -box.min.y * s, DESK.z - c.z * s)
    return root
  }, [scene])
  return <primitive object={fitted} />
}

export function Desk() {
  const available = useModelAvailable(DESK_MODEL)
  if (!available) return <ProceduralDesk />
  return (
    <Fallback fallback={<ProceduralDesk />}>
      <Suspense fallback={<ProceduralDesk />}>
        <FittedModel url={DESK_MODEL} />
      </Suspense>
    </Fallback>
  )
}
