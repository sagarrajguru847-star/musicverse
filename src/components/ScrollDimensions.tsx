import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const revealSelector = [
  '.welcome-row',
  '.rotation-section',
  '.workspace-section',
  '.library-browser',
  '.playlist-card',
  '.create-card',
  '.album-card',
  '.library-empty',
  '.library-track-list',
  '.library-tabs',
  '.workspace-main',
  '.search-panel',
  '.collection-summary',
  '.track-table-head',
  '.track-row',
  '.empty-playlist',
  '.playlist-management-row',
  '.search-panel-head',
  '.panel-search',
  '.search-context',
  '.search-result',
  '.bottom-note',
].join(',')

export default function ScrollDimensions() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.app-frame')
    if (!root) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tweens = new Map<HTMLElement, gsap.core.Tween>()
    let refreshFrame = 0

    const scan = () => {
      for (const [element, tween] of tweens) {
        if (element.isConnected) continue
        tween.scrollTrigger?.kill()
        tween.kill()
        tweens.delete(element)
      }

      if (reducedMotion) return
      const elements = root.querySelectorAll<HTMLElement>(revealSelector)
      elements.forEach((element, index) => {
        if (tweens.has(element)) return
        const direction = index % 2 === 0 ? -1 : 1
        const tween = gsap.fromTo(element,
          {
            autoAlpha: 0,
            y: 58,
            z: -150,
            rotateX: -14,
            rotateY: direction * 6,
            scale: 0.92,
            transformPerspective: 1100,
            transformOrigin: '50% 50%',
          },
          {
            autoAlpha: 1,
            y: 0,
            z: 0,
            rotateX: 0,
            rotateY: 0,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: element,
              start: 'top 94%',
              end: 'top 57%',
              scrub: reducedMotion ? 0.05 : 0.65,
              invalidateOnRefresh: true,
            },
          },
        )
        tweens.set(element, tween)
      })
    }

    const topbar = root.querySelector<HTMLElement>('.topbar')
    const sidebar = root.querySelector<HTMLElement>('.sidebar')
    const player = root.querySelector<HTMLElement>('.player-bar')
    const chrome = [topbar, sidebar, player].filter((element): element is HTMLElement => Boolean(element))

    const globalTrigger = reducedMotion ? undefined : ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: ({ progress }) => {
        root.style.setProperty('--page-depth-progress', String(progress))
        if (topbar) gsap.set(topbar, { transformPerspective: 1200, rotateX: progress * 1.1, z: progress * 14 })
        if (sidebar) gsap.set(sidebar, { transformPerspective: 1200, rotateY: progress * -1.15, x: progress * -3 })
        if (player) gsap.set(player, { transformPerspective: 1200, rotateX: progress * -1.4, z: progress * 18 })
      },
    })

    scan()
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(refreshFrame)
      refreshFrame = window.requestAnimationFrame(() => {
        scan()
        ScrollTrigger.refresh()
      })
    })
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(refreshFrame)
      globalTrigger?.kill()
      for (const [element, tween] of tweens) {
        tween.scrollTrigger?.kill()
        tween.kill()
        gsap.set(element, { clearProps: 'transform,opacity,visibility' })
      }
      gsap.set(chrome, { clearProps: 'transform' })
      root.style.removeProperty('--page-depth-progress')
    }
  }, [])

  return null
}
