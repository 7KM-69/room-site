import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type Listener = (p: number) => void

/** Scroll progress through the scene track (0..1), smoothed by GSAP's scrub. Read every frame by the camera. */
export const scroll = { progress: 0 }
const listeners = new Set<Listener>()

export function onScroll(fn: Listener) {
  listeners.add(fn)
  fn(scroll.progress)
  return () => { listeners.delete(fn) }
}

/** Scrubs `scroll.progress` from 0 to 1 while `track` scrolls past. Returns a cleanup. */
export function bindScrollTrack(track: HTMLElement) {
  const tween = gsap.to(scroll, {
    progress: 1,
    ease: 'none',
    scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 1.1 },
    onUpdate: () => listeners.forEach((fn) => fn(scroll.progress)),
  })
  return () => {
    tween.scrollTrigger?.kill()
    tween.kill()
  }
}
