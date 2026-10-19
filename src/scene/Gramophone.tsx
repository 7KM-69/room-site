import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DESK, GRAMOPHONE } from './layout'
import { useAnisotropy, useMaterials } from './materials'
import { audio } from './audio'
import { night } from './night'

// Horn gramophone on the right of the desk. Click it to start/stop the music (see audio.ts): the record spins
// up, the tone arm swings onto the record and little musical notes drift up out of the horn.

const BASE = { w: 0.25, h: 0.1, d: 0.25 }
const RECORD_Y = BASE.h + 0.0098
const PIVOT = new THREE.Vector3(0.09, BASE.h + 0.045, -0.09) // tone-arm pivot, top of the brass pillar
const ARM_LEN = 0.178
const ARM_PLAY = -0.666 // yaw that puts the needle in the grooves
const ARM_REST = 0.06 // parked just off the record
const HORN_THROAT = new THREE.Vector3(0.028, 0.29, -0.042)
const HORN_DIR = new THREE.Vector3(-0.28, 0.5, 0.82).normalize()
const HORN_LEN = 0.26
const HORN_MOUTH = 0.11

function canvasTexture(size: number, aniso: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  draw(g, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  return t
}

/** Record face: fine grooves with a sheen, red paper label in the middle. */
function recordTexture(aniso: number) {
  return canvasTexture(1024, aniso, (g, S) => {
    const c = S / 2
    g.fillStyle = '#0c0b0b'
    g.fillRect(0, 0, S, S)
    for (let r = c * 0.36; r < c * 0.98; r += 1.6) {
      g.strokeStyle = `rgba(255,255,255,${0.025 + 0.02 * Math.sin(r * 0.9)})`
      g.lineWidth = 0.8
      g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke()
    }
    // track gaps
    for (const f of [0.55, 0.72, 0.86]) {
      g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 4
      g.beginPath(); g.arc(c, c, c * f, 0, Math.PI * 2); g.stroke()
    }
    const label = c * 0.33
    g.fillStyle = '#8c2a22'
    g.beginPath(); g.arc(c, c, label, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#d8b46a'; g.lineWidth = 3
    g.beginPath(); g.arc(c, c, label * 0.92, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#efd9a6'; g.textAlign = 'center'
    g.font = '700 30px Georgia, serif'; g.fillText('MIDNIGHT PAGES', c, c - label * 0.35)
    g.font = 'italic 22px Georgia, serif'; g.fillText('Lo-Fi Philosophy', c, c + label * 0.5)
    g.fillStyle = '#0c0b0b'
    g.beginPath(); g.arc(c, c, 8, 0, Math.PI * 2); g.fill()
  })
}

/** White note glyphs (tinted per sprite), drawn as shapes so no music font is needed. */
function noteTextures(aniso: number) {
  const head = (g: CanvasRenderingContext2D, x: number, y: number) => {
    g.save(); g.translate(x, y); g.rotate(-0.42)
    g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); g.fill()
    g.restore()
  }
  const glow = (g: CanvasRenderingContext2D) => { g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.shadowColor = 'rgba(255,255,255,0.8)'; g.shadowBlur = 10 }
  return [
    canvasTexture(128, aniso, (g) => { glow(g); head(g, 52, 96); g.fillRect(64, 24, 6, 72) }),
    canvasTexture(128, aniso, (g) => {
      glow(g); head(g, 46, 98); g.fillRect(58, 22, 6, 76)
      g.beginPath(); g.moveTo(64, 22); g.bezierCurveTo(78, 40, 104, 46, 92, 84); g.bezierCurveTo(96, 58, 78, 52, 64, 46); g.fill()
    }),
    canvasTexture(128, aniso, (g) => {
      glow(g); head(g, 34, 100); head(g, 90, 88)
      g.fillRect(46, 30, 6, 70); g.fillRect(102, 18, 6, 70)
      g.beginPath(); g.moveTo(46, 30); g.lineTo(108, 18); g.lineTo(108, 32); g.lineTo(46, 44); g.fill()
    }),
  ]
}

type Note = { sprite: THREE.Sprite; age: number; life: number; seed: number; vel: THREE.Vector3; size: number }

function MusicNotes({ playing }: { playing: () => boolean }) {
  const aniso = useAnisotropy()
  const mouth = useMemo(() => HORN_THROAT.clone().addScaledVector(HORN_DIR, HORN_LEN * 0.95), [])
  const pool = useMemo(() => {
    const tex = noteTextures(aniso)
    return Array.from({ length: 18 }, (_, i): Note => {
      const mat = new THREE.SpriteMaterial({ map: tex[i % tex.length], transparent: true, depthWrite: false, opacity: 0 })
      const sprite = new THREE.Sprite(mat)
      sprite.visible = false
      sprite.raycast = () => {} // notes are decoration: never clickable
      return { sprite, age: 0, life: 0, seed: 0, vel: new THREE.Vector3(), size: 0 }
    })
  }, [aniso])
  const group = useRef<THREE.Group>(null)
  const nextSpawn = useRef(0)
  const dayInk = useMemo(() => new THREE.Color('#5b3b1f'), [])
  const nightInk = useMemo(() => new THREE.Color('#ffdfa6'), [])

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime
    if (playing() && t > nextSpawn.current) {
      const n = pool.find((p) => !p.sprite.visible)
      if (n) {
        n.age = 0
        n.life = 4 + Math.random() * 2
        n.seed = Math.random() * 100
        n.size = 0.026 + Math.random() * 0.016
        // out of the bell, then mostly upward
        n.vel.copy(HORN_DIR).multiplyScalar(0.03).add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.05 + Math.random() * 0.02, (Math.random() - 0.5) * 0.02))
        n.sprite.position.copy(mouth).add(new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.06))
        n.sprite.visible = true
      }
      nextSpawn.current = t + 0.45 + Math.random() * 0.5
    }
    for (const n of pool) {
      if (!n.sprite.visible) continue
      n.age += dt
      if (n.age > n.life) { n.sprite.visible = false; continue }
      const sway = Math.sin(n.age * 1.6 + n.seed) * 0.012
      n.sprite.position.addScaledVector(n.vel, dt)
      n.sprite.position.x += sway * dt
      n.vel.multiplyScalar(1 - dt * 0.15)
      const k = n.age / n.life
      const fade = Math.min(1, n.age / 0.5) * (1 - THREE.MathUtils.smoothstep(k, 0.6, 1))
      const mat = n.sprite.material
      mat.opacity = fade * 0.85
      mat.rotation = Math.sin(n.age * 1.1 + n.seed) * 0.35
      mat.color.copy(dayInk).lerp(nightInk, night.current)
      n.sprite.scale.setScalar(n.size * (0.8 + 0.2 * Math.min(1, n.age)))
    }
  })
  return (
    <group ref={group}>
      {pool.map((n, i) => <primitive key={i} object={n.sprite} />)}
    </group>
  )
}

export function Gramophone() {
  const m = useMaterials()
  const aniso = useAnisotropy()
  const record = useRef<THREE.Mesh>(null)
  const arm = useRef<THREE.Group>(null)
  const spin = useRef(0)

  const parts = useMemo(() => {
    const recordFace = new THREE.MeshPhysicalMaterial({ map: recordTexture(aniso), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 })
    const vinyl = new THREE.MeshStandardMaterial({ color: '#0c0b0b', roughness: 0.4 })
    const felt = new THREE.MeshStandardMaterial({ color: '#2d4532', roughness: 1 })
    const horn = new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: 1, roughness: 0.26, side: THREE.DoubleSide })
    const profile: THREE.Vector2[] = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      profile.push(new THREE.Vector2(0.011 + (HORN_MOUTH - 0.011) * t ** 2.6, t * HORN_LEN))
    }
    const bell = new THREE.LatheGeometry(profile, 64)
    const hornQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), HORN_DIR)
    const neck = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        PIVOT.clone().setY(PIVOT.y - 0.005),
        new THREE.Vector3(PIVOT.x + 0.005, 0.2, PIVOT.z - 0.02),
        new THREE.Vector3(0.06, 0.26, -0.075),
        HORN_THROAT.clone().addScaledVector(HORN_DIR, 0.004),
      ]),
      32, 0.0115, 16,
    )
    return { recordMats: [vinyl, recordFace, vinyl], felt, horn, bell, hornQuat, neck }
  }, [aniso])

  useFrame((_, dt) => {
    const playing = audio.state.playing
    spin.current = THREE.MathUtils.damp(spin.current, playing ? 2.6 : 0, 1.4, dt)
    if (record.current) record.current.rotation.y -= spin.current * dt
    if (arm.current) {
      arm.current.rotation.y = THREE.MathUtils.damp(arm.current.rotation.y, playing ? ARM_PLAY : ARM_REST, 2.2, dt)
      // lifts while travelling, settles into the groove
      const travel = Math.abs(arm.current.rotation.y - (playing ? ARM_PLAY : ARM_REST))
      arm.current.rotation.x = -Math.min(0.12, travel * 0.4)
    }
  })

  // Only a direct hit on the gramophone itself counts: R3F only lists objects that have handlers, so check the
  // whole scene for anything in front (the cup, the lamp…) and ignore drags.
  const model = useRef<THREE.Group>(null)
  const scene = useThree((s) => s.scene)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const isDirectHit = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    ray.ray.copy(e.ray)
    const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent))
    const first = ray.intersectObject(scene, true).find((h) => (h.object as THREE.Mesh).isMesh && shown(h.object))
    for (let o: THREE.Object3D | null = first?.object ?? null; o; o = o.parent) if (o === model.current) return true
    return false
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || !isDirectHit(e)) return
    e.stopPropagation()
    audio.toggle()
  }
  const hover = (e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = isDirectHit(e) ? 'pointer' : ''
  }

  return (
    <group position={[GRAMOPHONE.x, DESK.top, GRAMOPHONE.z]} rotation-y={GRAMOPHONE.yaw}>
      <group ref={model} onClick={click} onPointerMove={hover} onPointerOut={() => { document.body.style.cursor = '' }}>
        {/* cabinet */}
        <mesh material={m.trim} position={[0, 0.006, 0]} castShadow receiveShadow>
          <boxGeometry args={[BASE.w + 0.014, 0.012, BASE.d + 0.014]} />
        </mesh>
        <RoundedBox args={[BASE.w, BASE.h - 0.012, BASE.d]} radius={0.006} smoothness={3} position={[0, 0.012 + (BASE.h - 0.012) / 2, 0]} material={m.deskTop} castShadow receiveShadow />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} material={m.brass} position={[sx * (BASE.w / 2 - 0.004), 0.05, sz * (BASE.d / 2 - 0.004)]} castShadow>
            <cylinderGeometry args={[0.005, 0.005, 0.08, 12]} />
          </mesh>
        ))}
        {/* winding crank */}
        <group position={[BASE.w / 2, 0.05, 0.04]}>
          <mesh material={m.brass} position={[0.02, 0, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.004, 0.004, 0.04, 10]} />
          </mesh>
          <mesh material={m.brass} position={[0.04, -0.02, 0]} castShadow>
            <cylinderGeometry args={[0.0035, 0.0035, 0.045, 10]} />
          </mesh>
          <mesh material={m.trim} position={[0.052, -0.042, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.007, 0.007, 0.022, 14]} />
          </mesh>
        </group>
        {/* turntable */}
        <mesh material={parts.felt} position={[0, BASE.h + 0.004, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.112, 0.112, 0.008, 72]} />
        </mesh>
        <mesh ref={record} material={parts.recordMats} position={[0, RECORD_Y, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.108, 0.108, 0.0018, 96]} />
        </mesh>
        <mesh material={m.brass} position={[0, RECORD_Y + 0.006, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.012, 10]} />
        </mesh>
        {/* tone arm, pillar and horn */}
        <mesh material={m.brass} position={[PIVOT.x, BASE.h + 0.0225, PIVOT.z]} castShadow>
          <cylinderGeometry args={[0.012, 0.016, 0.045, 24]} />
        </mesh>
        <mesh geometry={parts.neck} material={parts.horn} castShadow />
        <group position={HORN_THROAT} quaternion={parts.hornQuat}>
          <mesh geometry={parts.bell} material={parts.horn} castShadow receiveShadow />
          <mesh material={m.brass} position={[0, HORN_LEN, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[HORN_MOUTH, 0.003, 10, 64]} />
          </mesh>
        </group>
        <group ref={arm} position={PIVOT} rotation-y={ARM_REST}>
          <mesh material={m.brass} position={[0, -0.004, ARM_LEN / 2]} rotation-x={Math.PI / 2 + 0.12} castShadow>
            <cylinderGeometry args={[0.0045, 0.0065, ARM_LEN, 14]} />
          </mesh>
          <group position={[0, -0.012, ARM_LEN]}>
            <mesh material={m.brass} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.022, 0.022, 0.011, 32]} />
            </mesh>
            <mesh material={m.blackMetal} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.017, 0.017, 0.0125, 32]} />
            </mesh>
            <mesh material={m.blackMetal} position={[0, -0.017, 0]} rotation-x={Math.PI}>
              <coneGeometry args={[0.0015, 0.014, 8]} />
            </mesh>
          </group>
        </group>
      </group>
      {/* outside the clickable model, so the floating notes never toggle the music */}
      <MusicNotes playing={() => audio.state.playing} />
    </group>
  )
}
