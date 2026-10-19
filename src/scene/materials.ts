import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { applyAnisotropy, floorPlanks, leather, pageEdges, plaster, setRepeat, walnutSlab, type PBRSet } from './textures'

// PBR materials baked once per page load (procedural maps, no downloads). Max anisotropy + mipmaps keep the
// floor boards crisp at grazing angles — there is deliberately no depth of field anywhere.

let cache: ReturnType<typeof build> | null = null

function std(set: PBRSet, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ ...set, ...extra })
}

function build(aniso: number) {
  const floor = floorPlanks(2048)
  setRepeat(floor, 3, 3) // one tile ≈ 1.2 m
  const wall = plaster(512, [118, 104, 90])
  setRepeat(wall, 3.5, 3)
  const desk = walnutSlab(1024, 512)
  const deskSide = walnutSlab(512, 256)
  const cover = leather(512)
  const edges = pageEdges(256, 64)
  for (const s of [floor, wall, desk, deskSide, cover, edges]) applyAnisotropy(s, aniso)

  return {
    floor: std(floor, { normalScale: new THREE.Vector2(0.6, 0.6) }),
    wall: std(wall, { normalScale: new THREE.Vector2(0.5, 0.5) }),
    deskTop: new THREE.MeshPhysicalMaterial({ ...desk, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
    deskWood: std(deskSide, { color: '#b9a597' }),
    trim: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.55 }),
    cover: std(cover, { color: '#5a3424' }), // oxblood leather
    edges: std(edges),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: 1, roughness: 0.28 }),
    blackMetal: new THREE.MeshStandardMaterial({ color: '#1b1b1d', metalness: 0.6, roughness: 0.4 }),
    aluminium: new THREE.MeshStandardMaterial({ color: '#9a9ca2', metalness: 1, roughness: 0.32 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#efe9df', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    coffee: new THREE.MeshPhysicalMaterial({ color: '#2a170d', roughness: 0.08, clearcoat: 1 }),
    frame: new THREE.MeshStandardMaterial({ color: '#1e140e', roughness: 0.45, metalness: 0.1 }),
    mat: new THREE.MeshStandardMaterial({ color: '#e8e1d3', roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.08, clearcoat: 1, depthWrite: false,
    }),
    windowWood: new THREE.MeshStandardMaterial({ color: '#d9cfc0', roughness: 0.6 }),
  }
}

export type StudyMaterials = ReturnType<typeof build>

export function useMaterials(): StudyMaterials {
  const gl = useThree((s) => s.gl)
  return useMemo(() => (cache ??= build(gl.capabilities.getMaxAnisotropy())), [gl])
}

export const useAnisotropy = () => useThree((s) => s.gl.capabilities.getMaxAnisotropy())
