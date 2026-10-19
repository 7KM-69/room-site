import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { CameraRig } from './CameraRig'
import { Desk } from './Desk'
import { Lighting } from './Lighting'
import { Notebook } from './Notebook'
import { Books, CoffeeCup, DeskLamp } from './Props'
import { FountainPen } from './FountainPen'
import { Gramophone } from './Gramophone'
import { Room } from './Room'
import type { Mode } from './layout'

export default function Experience({ mode, onReady }: { mode: Mode; onReady?: () => void }) {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ fov: 40, near: 0.01, far: 40, position: [1.3, 1.52, 2.15] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={(state) => {
        if (import.meta.env.DEV) Object.assign(window, { __r3f: state }) // inspect from the console while developing
        requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))
      }}
    >
      <color attach="background" args={['#0d0b0a']} />
      <CameraRig />
      <Lighting mode={mode} />
      <Room mode={mode} />
      <Desk />
      <Notebook />
      <DeskLamp />
      <Gramophone />
      <CoffeeCup />
      <Books />
      <FountainPen />
    </Canvas>
  )
}
