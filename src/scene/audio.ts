// Global audio state for the study. The 3D gramophone toggles it; a future floating player widget can use the
// same store (React: `useAudio()`, anywhere else: `window.studyAudio`).
//
// Tracks come from src/data/playlist.ts and play on loop, fading in and out at a soft ambient volume. If the
// current track's file is missing, a small generative lo-fi loop is synthesised with Web Audio instead (warm
// seventh chords, soft bass, a sparse melody and vinyl crackle), so the gramophone always plays something.

import { useSyncExternalStore } from 'react'
import { PLAYBACK, PLAYLIST, type Track } from '../data/playlist'

type State = { playing: boolean; track: number; source: 'file' | 'synth' | null }
let state: State = { playing: false, track: 0, source: null }
const listeners = new Set<() => void>()
const set = (s: Partial<State>) => {
  state = { ...state, ...s }
  listeners.forEach((l) => l())
  window.dispatchEvent(new CustomEvent('study-audio', { detail: state }))
}

type Engine = { start: () => void; stop: () => void }
let engine: Engine | null = null
let enginePromise: Promise<Engine> | null = null

async function fileExists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    return r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/')
  } catch {
    return false
  }
}

/** Eases the element's volume to `to` over `seconds` (time-based, so it is smooth at any frame rate). */
function fader(el: HTMLAudioElement) {
  let frame = 0
  return (to: number, seconds: number, then?: () => void) => {
    cancelAnimationFrame(frame)
    const from = el.volume, t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / (seconds * 1000))
      el.volume = from + (to - from) * k * k * (3 - 2 * k)
      if (k < 1) frame = requestAnimationFrame(step)
      else then?.()
    }
    frame = requestAnimationFrame(step)
  }
}

function fileEngine(track: Track): Engine {
  const el = new Audio(track.src)
  el.loop = true
  el.preload = 'auto'
  el.volume = 0
  const fade = fader(el)
  return {
    start: () => {
      el.play().catch(() => set({ playing: false }))
      fade(PLAYBACK.volume, PLAYBACK.fadeIn)
    },
    stop: () => fade(0, PLAYBACK.fadeOut, () => el.pause()),
  }
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function synthEngine(): Engine {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1600
  tone.Q.value = 0.4
  master.connect(tone).connect(ctx.destination)

  // tape wow: slow pitch drift shared by every voice
  const wow = ctx.createOscillator()
  const wowDepth = ctx.createGain()
  wow.frequency.value = 0.18
  wowDepth.gain.value = 5 // cents
  wow.connect(wowDepth)
  wow.start()

  // vinyl crackle + hiss
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.5 : 0)
  const crackle = ctx.createBufferSource()
  crackle.buffer = buf
  crackle.loop = true
  const crackleGain = ctx.createGain()
  crackleGain.gain.value = 0.35
  crackle.connect(crackleGain).connect(master)
  crackle.start()

  const voice = (midi: number, at: number, dur: number, gain: number, type: OscillatorType) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = hz(midi)
    wowDepth.connect(o.detune)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(gain, at + 0.04)
    g.gain.exponentialRampToValueAtTime(gain * 0.45, at + 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g).connect(master)
    o.start(at)
    o.stop(at + dur + 0.05)
  }

  // Fmaj7 – Em7 – Dm7 – Cmaj7, one bar each at ~72 bpm
  const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
  const scale = [72, 74, 76, 79, 81, 84]
  const bar = 3.3
  let next = ctx.currentTime + 0.1
  let i = 0
  const schedule = () => {
    while (next < ctx.currentTime + 1) {
      const ch = chords[i % chords.length]
      ch.forEach((n, k) => voice(n, next + k * 0.018, bar * 0.95, 0.05, k % 2 ? 'sine' : 'triangle')) // lazy strum
      voice(ch[0] - 12, next, bar * 0.6, 0.09, 'sine')
      voice(ch[0] - 12, next + bar * 0.62, bar * 0.35, 0.06, 'sine')
      for (let s = 0; s < 8; s++) if (Math.random() < 0.28) voice(scale[Math.floor(Math.random() * scale.length)], next + (s * bar) / 8, 0.9, 0.035, 'sine')
      next += bar
      i++
    }
  }
  let timer = 0
  return {
    start: () => {
      ctx.resume()
      next = Math.max(next, ctx.currentTime + 0.1)
      schedule()
      clearInterval(timer)
      timer = window.setInterval(schedule, 250)
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setTargetAtTime(PLAYBACK.volume * 3, ctx.currentTime, PLAYBACK.fadeIn / 3)
    },
    stop: () => {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setTargetAtTime(0, ctx.currentTime, PLAYBACK.fadeOut / 3)
      clearInterval(timer)
      setTimeout(() => { if (!state.playing) ctx.suspend() }, 1500)
    },
  }
}

function getEngine() {
  const track = PLAYLIST[state.track]
  enginePromise ??= (track ? fileExists(track.src) : Promise.resolve(false)).then((has) => {
    engine = has && track ? fileEngine(track) : synthEngine()
    set({ source: has ? 'file' : 'synth' })
    return engine
  })
  return enginePromise
}

export const audio = {
  get state() { return state },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
  async play() {
    if (state.playing) return
    set({ playing: true })
    ;(await getEngine()).start()
  },
  async pause() {
    if (!state.playing) return
    set({ playing: false })
    engine?.stop()
  },
  toggle() {
    return state.playing ? audio.pause() : audio.play()
  },
  /** The track that is (or will be) playing. */
  get track(): Track | undefined { return PLAYLIST[state.track] },
  /** Switches to playlist entry `i`, fading the current one out first; keeps playing if it was. */
  async select(i: number) {
    if (i === state.track || !PLAYLIST[i]) return
    const was = state.playing
    if (was) await audio.pause()
    engine = null
    enginePromise = null
    set({ track: i, source: null })
    if (was) setTimeout(() => audio.play(), PLAYBACK.fadeOut * 1000)
  },
}

declare global {
  interface Window { studyAudio: typeof audio }
}
window.studyAudio = audio

export const useAudio = () => useSyncExternalStore(audio.subscribe, () => audio.state)
