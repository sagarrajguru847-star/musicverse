import { useEffect, useRef } from 'react'
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const shards = [
  { position: [-2.55, 0.92, 0.12] as const, rotation: [0.1, 0.48, -0.13] as const, color: '#743bdf', title: 'AFTER\nHOURS', subtitle: 'VOL. 04' },
  { position: [2.62, 0.68, -0.38] as const, rotation: [-0.08, -0.5, 0.13] as const, color: '#157d9b', title: 'BLUE\nHOUR', subtitle: 'SIDE A' },
  { position: [-2.32, -1.3, -0.72] as const, rotation: [0.18, 0.24, 0.1] as const, color: '#c05076', title: 'SOFT\nSIGNALS', subtitle: 'A MIX' },
  { position: [2.35, -1.45, 0.18] as const, rotation: [-0.13, -0.24, -0.1] as const, color: '#4d58cb', title: 'IN\nMOTION', subtitle: 'PLAYLIST' },
  { position: [-3.48, -0.04, -1.35] as const, rotation: [0.06, 0.37, -0.08] as const, color: '#137e87', title: 'NIGHT\nDRIVE', subtitle: 'SIDE B' },
  { position: [3.45, -0.2, -1.25] as const, rotation: [-0.08, -0.32, 0.06] as const, color: '#a64ca6', title: 'SLOW\nBURN', subtitle: 'VOL. 02' },
]

export default function ImmersiveScene() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      host.classList.add('scene-fallback-active')
      return () => host.classList.remove('scene-fallback-active')
    }

    const scene = new Scene()
    const camera = new PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(0, 0, 7.8)
    camera.lookAt(0, 0, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.domElement.setAttribute('aria-hidden', 'true')
    host.appendChild(renderer.domElement)

    const universe = new Group()
    const orbit = new Group()
    const waveform = new Group()
    scene.add(universe)
    universe.add(waveform)
    universe.add(orbit)
    scene.add(new AmbientLight(0xffffff, 1.25))
    const violetLight = new DirectionalLight('#8876ff', 3.2)
    violetLight.position.set(2, 2, 5)
    scene.add(violetLight)
    const cyanLight = new DirectionalLight('#39e5f2', 3.1)
    cyanLight.position.set(-4, -2, 1)
    scene.add(cyanLight)

    const ringOne = new Mesh(new TorusGeometry(1.7, 0.012, 12, 180), new MeshBasicMaterial({ color: '#4fe8fa', transparent: true, opacity: 0.88 }))
    ringOne.rotation.set(0.7, 0.15, 0.15)
    orbit.add(ringOne)
    const ringTwo = new Mesh(new TorusGeometry(2.02, 0.008, 10, 180), new MeshBasicMaterial({ color: '#4ad4de', transparent: true, opacity: 0.62 }))
    ringTwo.rotation.set(1.2, -0.45, 0.3)
    orbit.add(ringTwo)
    const ringThree = new Mesh(new TorusGeometry(2.48, 0.006, 8, 180), new MeshBasicMaterial({ color: '#e984eb', transparent: true, opacity: 0.42 }))
    ringThree.rotation.set(0.42, 0.86, -0.2)
    orbit.add(ringThree)

    const record = new Group()
    const recordBody = new Mesh(new CylinderGeometry(0.83, 0.83, 0.13, 96), new MeshPhysicalMaterial({ color: '#071523', roughness: 0.24, metalness: 0.72, clearcoat: 1 }))
    recordBody.rotation.x = Math.PI / 2
    record.add(recordBody)
    const recordFace = new Mesh(new CircleGeometry(0.77, 96), new MeshBasicMaterial({ color: '#101a32' }))
    recordFace.position.z = 0.068
    record.add(recordFace)
    const grooves = [0.69, 0.62, 0.55, 0.48].map((radius, index) => {
      const groove = new Mesh(new TorusGeometry(radius, 0.004, 4, 100), new MeshBasicMaterial({ color: index % 2 ? '#526583' : '#45b9ca', transparent: true, opacity: index % 2 ? 0.36 : 0.56 }))
      groove.position.z = 0.073
      record.add(groove)
      return groove
    })
    const label = new Mesh(new CircleGeometry(0.31, 64), new MeshBasicMaterial({ color: '#49dbe7' }))
    label.position.z = 0.081
    record.add(label)
    const playButton = new Mesh(new CircleGeometry(0.2, 48), new MeshBasicMaterial({ color: '#0b2130' }))
    playButton.position.z = 0.09
    record.add(playButton)
    const playShape = new Shape()
    playShape.moveTo(-0.055, -0.095)
    playShape.lineTo(-0.055, 0.095)
    playShape.lineTo(0.12, 0)
    playShape.closePath()
    const playGlyph = new Mesh(new ShapeGeometry(playShape), new MeshBasicMaterial({ color: '#efffff', side: DoubleSide }))
    playGlyph.position.z = 0.1
    record.add(playGlyph)
    orbit.add(record)

    const radialBars: Array<{ mesh: Mesh; angle: number; phase: number; base: number }> = []
    const radialGeometry = new BoxGeometry(0.035, 1, 0.035)
    const radialMaterials = [
      new MeshBasicMaterial({ color: '#47e4f4', transparent: true, opacity: 0.94 }),
      new MeshBasicMaterial({ color: '#7f8dff', transparent: true, opacity: 0.9 }),
      new MeshBasicMaterial({ color: '#eb80e9', transparent: true, opacity: 0.85 }),
    ]
    for (let index = 0; index < 44; index += 1) {
      const angle = index / 44 * Math.PI * 2
      const base = index % 4 === 0 ? 0.27 : 0.12
      const mesh = new Mesh(radialGeometry, radialMaterials[Math.floor(index / 15) % radialMaterials.length])
      orbit.add(mesh)
      radialBars.push({ mesh, angle, phase: index * 0.73, base })
    }

    const waveformBars: Array<{ mesh: Mesh; phase: number; envelope: number }> = []
    const waveformGeometry = new BoxGeometry(0.052, 1, 0.035)
    const waveformMaterials = [
      new MeshBasicMaterial({ color: '#43e4f3', transparent: true, opacity: 0.88 }),
      new MeshBasicMaterial({ color: '#7b8eff', transparent: true, opacity: 0.84 }),
      new MeshBasicMaterial({ color: '#e980e6', transparent: true, opacity: 0.78 }),
    ]
    for (let index = 0; index < 76; index += 1) {
      const position = index / 75
      const mesh = new Mesh(waveformGeometry, waveformMaterials[Math.min(2, Math.floor(position * 3))])
      mesh.position.set((position - 0.5) * 7.7, 0, -1.18)
      waveform.add(mesh)
      waveformBars.push({ mesh, phase: index * 0.42, envelope: 0.32 + Math.pow(Math.abs(Math.sin(position * Math.PI * 3.8)), 1.25) * 0.8 })
    }

    const cardGroups: Array<{ group: Group; x: number; y: number; z: number; phase: number; rotationX: number; rotationY: number; rotationZ: number }> = []
    for (const [index, shard] of shards.entries()) {
      const card = new Group()
      card.position.set(shard.position[0], shard.position[1], shard.position[2])
      card.rotation.set(shard.rotation[0], shard.rotation[1], shard.rotation[2])
      const body = new Mesh(
        new BoxGeometry(1.04, 1.16, 0.1),
        new MeshPhysicalMaterial({ color: new Color(shard.color).multiplyScalar(0.74), roughness: 0.3, metalness: 0.2, clearcoat: 0.7 }),
      )
      card.add(body)
      const cover = new Mesh(new PlaneGeometry(0.9, 1.02), new MeshBasicMaterial({ map: makeArtworkTexture(shard.color, shard.title, shard.subtitle), side: DoubleSide }))
      cover.position.z = 0.056
      card.add(cover)
      orbit.add(card)
      if (index >= 4) card.scale.setScalar(0.72)
      cardGroups.push({
        group: card,
        x: shard.position[0],
        y: shard.position[1],
        z: shard.position[2],
        phase: index * Math.PI / 2,
        rotationX: shard.rotation[0],
        rotationY: shard.rotation[1],
        rotationZ: shard.rotation[2],
      })
    }

    const starPositions = new Float32Array(960)
    for (let index = 0; index < 320; index += 1) {
      const offset = index * 3
      const seed = index * 12.9898
      starPositions[offset] = Math.sin(seed) * 5.2
      starPositions[offset + 1] = Math.cos(seed * 0.72) * 3.6
      starPositions[offset + 2] = Math.sin(seed * 0.38) * 3.3
    }
    const starGeometry = new BufferGeometry()
    starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3))
    const starPoints = new Points(starGeometry, new PointsMaterial({ color: '#d7c4ff', size: 0.032, transparent: true, opacity: 0.78, sizeAttenuation: true }))
    scene.add(starPoints)

    const progress = { value: 0 }
    const stage = host.closest<HTMLElement>('.immersive-stage')
    const phaseNames = ['SURFACE', 'DRIFT', 'ORBIT', 'ARRIVAL']
    const depthNumber = stage?.querySelector<HTMLElement>('[data-depth-number]')
    const depthName = stage?.querySelector<HTMLElement>('[data-depth-name]')
    const depthIndex = stage?.querySelector<HTMLElement>('[data-depth-index]')
    let previousPhase = -1
    const updateDepthReadout = () => {
      const value = gsap.utils.clamp(0, 1, progress.value)
      stage?.style.setProperty('--depth-progress', String(value))
      const phase = Math.min(phaseNames.length - 1, Math.floor(value * phaseNames.length))
      if (phase === previousPhase) return
      previousPhase = phase
      const number = String(phase + 1).padStart(2, '0')
      if (depthNumber) depthNumber.textContent = number
      if (depthIndex) depthIndex.textContent = number
      if (depthName) depthName.textContent = phaseNames[phase]
    }
    updateDepthReadout()

    const heroCopy = stage?.querySelector<HTMLElement>('.hero-copy')
    const heroAside = stage?.querySelector<HTMLElement>('.hero-aside')
    const depthHud = stage?.querySelector<HTMLElement>('.depth-hud')
    const sceneCaption = stage?.querySelector<HTMLElement>('.scene-caption')
    const interactiveSurface = stage?.querySelector<HTMLElement>('.depth-sticky')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scrollTween = gsap.timeline({
      scrollTrigger: {
        trigger: stage || host,
        start: 'top top',
        end: 'bottom bottom',
        scrub: reducedMotion ? 0.05 : 1.05,
        invalidateOnRefresh: true,
      },
    })
    scrollTween.to(progress, { value: 1, duration: 1, ease: 'none', onUpdate: updateDepthReadout }, 0)
    if (heroCopy) scrollTween.to(heroCopy, { x: -86, y: -42, z: 125, rotateY: -13, rotateX: 3, scale: 0.86, opacity: 0.5, ease: 'none' }, 0)
    if (heroAside) scrollTween.to(heroAside, { y: -70, z: 70, rotateY: 18, opacity: 0.38, ease: 'none' }, 0)
    if (sceneCaption) scrollTween.to(sceneCaption, { x: -35, z: 65, opacity: 0.3, ease: 'none' }, 0)
    if (depthHud) scrollTween.to(depthHud, { z: -28, rotateY: -10, opacity: 0.75, ease: 'none' }, 0)

    const pointer = { x: 0, y: 0 }
    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion || !interactiveSurface) return
      const bounds = interactiveSurface.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    const onPointerLeave = () => { pointer.x = 0; pointer.y = 0 }
    stage?.addEventListener('pointermove', onPointerMove, { passive: true })
    stage?.addEventListener('pointerleave', onPointerLeave)
    const resize = () => {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()

    let previousTime = 0
    renderer.setAnimationLoop((time) => {
      const elapsed = time * 0.001
      const delta = Math.min((time - previousTime) * 0.001, 0.04)
      previousTime = time
      if (!reducedMotion) universe.rotation.y += delta * 0.025
      universe.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * 0.16) * 0.05
      const depth = progress.value
      const passage = Math.sin(depth * Math.PI)
      const pointerMotion = reducedMotion ? 0 : 0.2
      const targetX = Math.sin(depth * Math.PI * 2) * 0.54 + pointer.x * pointerMotion
      const targetY = Math.cos(depth * Math.PI * 2) * 0.24 - pointer.y * pointerMotion
      camera.position.x += (targetX - camera.position.x) * 0.035
      camera.position.y += (targetY - camera.position.y) * 0.035
      camera.position.z = 7.8 - passage * 2.25
      camera.lookAt(0, 0, 0)
      orbit.rotation.y = -0.42 + depth * Math.PI * 2.2
      orbit.rotation.x = 0.12 + Math.sin(depth * Math.PI * 2) * 0.34
      orbit.position.y = 0.05 + depth * 0.3 + pointer.y * pointerMotion * 0.16
      orbit.position.z = passage * 1.28
      orbit.scale.setScalar(0.92 + depth * 0.12 + passage * 0.24)
      record.rotation.z = elapsed * (reducedMotion ? 0 : 0.045) + depth * 0.42
      for (const groove of grooves) groove.rotation.z = -record.rotation.z * 0.6
      for (const bar of radialBars) {
        const amplitude = bar.base + Math.abs(Math.sin(elapsed * 1.7 + bar.phase + depth * 7)) * 0.3
        const radius = 0.94 + amplitude * 0.5
        bar.mesh.scale.y = amplitude
        bar.mesh.position.set(Math.cos(bar.angle) * radius, Math.sin(bar.angle) * radius, 0.04)
        bar.mesh.rotation.z = bar.angle - Math.PI / 2
      }
      for (const bar of waveformBars) {
        const pulse = Math.abs(Math.sin(elapsed * 2.1 + bar.phase + depth * 8))
        bar.mesh.scale.y = 0.1 + pulse * bar.envelope * 0.55
      }
      ringOne.rotation.z = 0.15 + depth * 1.4
      ringTwo.rotation.y = -0.45 - depth * 1.2
      ringThree.rotation.x = 0.42 + depth * 1.8
      starPoints.rotation.y = depth * 0.24 + (reducedMotion ? 0 : elapsed * 0.008)
      starPoints.rotation.x = depth * -0.12
      for (const card of cardGroups) {
        const orbitPhase = depth * Math.PI * 2 + card.phase
        card.group.position.x = card.x + Math.cos(orbitPhase) * 0.38
        card.group.position.y = card.y + Math.sin(elapsed * 0.36 + card.phase) * 0.06 + Math.sin(orbitPhase * 0.55) * 0.2
        card.group.position.z = card.z + Math.sin(orbitPhase) * 0.92
        card.group.rotation.x = card.rotationX + Math.cos(orbitPhase) * 0.11
        card.group.rotation.y = card.rotationY + Math.sin(orbitPhase) * 0.17
        card.group.rotation.z = card.rotationZ + Math.sin(elapsed * 0.36 + card.phase) * 0.045
      }
      renderer.render(scene, camera)
    })

    return () => {
      scrollTween.scrollTrigger?.kill()
      scrollTween.kill()
      stage?.removeEventListener('pointermove', onPointerMove)
      stage?.removeEventListener('pointerleave', onPointerLeave)
      resizeObserver.disconnect()
      renderer.setAnimationLoop(null)
      scene.traverse((object) => {
        const drawable = object as Mesh
        drawable.geometry?.dispose()
        const materials = Array.isArray(drawable.material) ? drawable.material : drawable.material ? [drawable.material] : []
        for (const material of materials) {
          const textured = material as MeshBasicMaterial
          textured.map?.dispose()
          material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div className="scene-canvas" ref={hostRef} aria-hidden="true" />
}

function makeArtworkTexture(color: string, title: string, subtitle: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 560
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(35, 40, 490, 530)
  gradient.addColorStop(0, lighten(color, 25))
  gradient.addColorStop(0.55, color)
  gradient.addColorStop(1, '#28243b')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalAlpha = 0.25
  const glow = context.createRadialGradient(340, 190, 16, 340, 190, 220)
  glow.addColorStop(0, '#ffffff')
  glow.addColorStop(1, color)
  context.fillStyle = glow
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalAlpha = 0.9
  context.strokeStyle = 'rgba(255,255,255,.68)'
  context.lineWidth = 4
  context.beginPath()
  context.ellipse(318, 215, 110, 70, -0.62, 0, Math.PI * 2)
  context.stroke()
  context.globalAlpha = 1
  context.fillStyle = 'rgba(255,255,255,.94)'
  context.font = '700 43px "Space Grotesk", sans-serif'
  title.split('\n').forEach((line, index) => context.fillText(line, 42, 379 + index * 49))
  context.fillStyle = 'rgba(255,255,255,.72)'
  context.font = '600 17px "DM Sans", sans-serif'
  context.fillText(subtitle, 44, 478)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 4
  return texture
}

function lighten(hexColor: string, amount: number) {
  const color = new Color(hexColor)
  color.r = Math.min(1, color.r + amount / 255)
  color.g = Math.min(1, color.g + amount / 255)
  color.b = Math.min(1, color.b + amount / 255)
  return `#${color.getHexString()}`
}

