import * as THREE from 'three'
import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DESK, NOTEBOOK, ROOM, type Mode } from './layout'
import { LAMP_HEAD } from './Props'
import { night } from './night'

type Look = {
  sun: number; sunColor: string
  hemi: number; env: number
  spot: number; glow: number; shelf: number
  exposure: number
}

// Day: soft warm sun through the window. Night: the room falls dark, the banker's lamp pools light on the desk.
const LOOKS: Record<Mode, Look> = {
  day: { sun: 4.2, sunColor: '#ffe2b8', hemi: 1.25, env: 0.75, spot: 0, glow: 0, shelf: 0, exposure: 0.95 },
  night: { sun: 0.5, sunColor: '#8ea4da', hemi: 0.06, env: 0.07, spot: 2.4, glow: 0.45, shelf: 0.5, exposure: 1.35 },
}

const SUN_FROM = new THREE.Vector3(-4.6, 3.6, 1.9)

export function Lighting({ mode }: { mode: Mode }) {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const spot = useRef<THREE.SpotLight>(null)
  const glow = useRef<THREE.PointLight>(null)
  const shelf = useRef<THREE.PointLight>(null)
  const targets = useMemo(() => {
    const desk = new THREE.Object3D()
    desk.position.set(DESK.x, DESK.top, DESK.z)
    const book = new THREE.Object3D()
    book.position.set(NOTEBOOK.x - 0.02, DESK.top, NOTEBOOK.z)
    return { desk, book }
  }, [])
  const colors = useMemo(() => ({ day: new THREE.Color(LOOKS.day.sunColor), night: new THREE.Color(LOOKS.night.sunColor) }), [])

  useFrame((_, dt) => {
    night.current = THREE.MathUtils.damp(night.current, mode === 'night' ? 1 : 0, 2.6, dt)
    const k = night.current
    const mix = (key: keyof Omit<Look, 'sunColor'>) => THREE.MathUtils.lerp(LOOKS.day[key], LOOKS.night[key], k)
    if (sun.current) {
      sun.current.intensity = mix('sun')
      sun.current.color.copy(colors.day).lerp(colors.night, k)
    }
    if (hemi.current) hemi.current.intensity = mix('hemi')
    if (spot.current) spot.current.intensity = mix('spot')
    if (glow.current) glow.current.intensity = mix('glow')
    if (shelf.current) shelf.current.intensity = mix('shelf')
    scene.environmentIntensity = mix('env')
    gl.toneMappingExposure = mix('exposure')
  })

  const S = 2.4
  return (
    <>
      <primitive object={targets.desk} />
      <primitive object={targets.book} />
      <hemisphereLight ref={hemi} args={['#dbe5f2', '#6b4a33', 0.5]} />
      <directionalLight
        ref={sun}
        position={SUN_FROM}
        target={targets.desk}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-S}
        shadow-camera-right={S}
        shadow-camera-top={S}
        shadow-camera-bottom={-S}
        shadow-camera-near={1}
        shadow-camera-far={12}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      <spotLight
        ref={spot}
        position={LAMP_HEAD}
        target={targets.book}
        color="#ffbf73"
        angle={0.78}
        penumbra={0.85}
        decay={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.03}
        shadow-camera-far={3}
        shadow-bias={-0.00008}
        shadow-normalBias={0.004}
      />
      <pointLight ref={glow} position={[LAMP_HEAD.x, LAMP_HEAD.y + 0.02, LAMP_HEAD.z]} color="#ffb565" distance={3.5} decay={2} />
      {/* faint warm wash so the bookshelf still reads at night */}
      <pointLight ref={shelf} position={[1.15, 2.1, 0.55]} color="#ffb978" distance={2.6} decay={2} />
      {/* Image-based light for reflections on brass, aluminium and glass — generated locally, no HDR download */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} color="#fff1dc" position={[ROOM.leftX - 0.5, 1.6, 0.35]} rotation-y={Math.PI / 2} scale={[1.3, 1.4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#f3e6d2" position={[0, ROOM.height, 0.6]} rotation-x={Math.PI / 2} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#d9b48a" position={[1.5, 1.2, 2.5]} rotation-y={-Math.PI / 4} scale={[2, 1.4, 1]} />
        <mesh scale={20}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#2a211b" side={THREE.BackSide} />
        </mesh>
      </Environment>
    </>
  )
}
