import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { color, mix, screenSize, screenUV, smoothstep } from 'three/tsl'
import { barriers, course, type Platform } from './simulation'
import { StaticInstances } from '../scene/StaticInstances'
import { slideObstacleInstances, SLIDE_STEEL_COLOR } from './slide-obstacle-data'
import { CITY_LAYERS, CityParallax, cityInstances, rooftopInstances, constructionScenery } from './environment-data'

function NightSky() {
  const skyMesh = useRef<Mesh>(null)
  useFrame(({ camera }) => {
    // Keep the existing sky plane centered over the moving orthographic viewport.
    skyMesh.current?.position.set(camera.position.x, camera.position.y, -80)
  }, -1)
  const material = useMemo(() => {
    const sky = new MeshBasicNodeMaterial({depthWrite:false,depthTest:false,fog:false,toneMapped:false})
    const height=screenUV.y.oneMinus()
    const gradient=mix(color('#d5e7ef'),color('#91b9d0'),smoothstep(0.06,0.91,height))
    const dx=screenUV.x.sub(0.24).mul(screenSize.x.div(screenSize.y))
    const dy=height.sub(0.80)
    const radius=dx.mul(dx).add(dy.mul(dy))
    const moon=smoothstep(0.00115,0.00148,radius).oneMinus()
    sky.colorNode=mix(gradient,color('#d9dedc'),moon)
    return sky
  },[])
  useEffect(()=>()=>material.dispose(),[material])
  return <mesh ref={skyMesh} position={[0,0,-80]} renderOrder={-10} frustumCulled={false} material={material}>
    <planeGeometry args={[400,400]} />
  </mesh>
}

function CorporateSigns() {
  const signs = useMemo(() => [
    { name: 'Amazon', towerX: -15.6, offset: .17 },
    { name: 'Microsoft', towerX: 6, offset: -.25 },
    { name: 'Capgemini', towerX: 16, offset: .17 },
  ].map(sign => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      context.font = '600 80px Arial'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#e1e5df'
      context.fillText(sign.name, 256, 66, 480)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    const tower = CITY_LAYERS[1].towers.find(([x]) => x === sign.towerX)!
    return {
      ...sign, texture,
      x: tower[0] + tower[1] * sign.offset,
      y: CITY_LAYERS[1].base + tower[2] - .7,
      width: tower[1] * .4,
    }
  }), [])
  useEffect(() => () => signs.forEach(sign => sign.texture.dispose()), [signs])
  return <>{[-1, 0, 1].flatMap(tile => signs.map(sign =>
    <mesh key={`${tile}-${sign.name}`} position={[sign.x + tile * 48, sign.y, -22.28]}>
      <planeGeometry args={[sign.width, sign.width / 4]} />
      <meshBasicMaterial map={sign.texture} transparent alphaTest={.05} depthWrite={false} toneMapped={false} />
    </mesh>
  ))}</>
}

export function NightEnvironment({platforms, decorations, reducedMotion, reset, diagnostics}: {
  platforms: readonly Platform[]; decorations: boolean; reducedMotion: boolean; reset: {restarts:number}
  diagnostics: React.RefObject<HTMLOutputElement|null>
}) {
  const groups=useRef<(Group|null)[]>([])
  const helicopter=useRef<Group>(null), rotor=useRef<Group>(null)
  const flight=useRef(0)
  const renderScene=useThree(state=>state.scene)
  const parallax=useRef(new CityParallax()).current
  const scene=useMemo(()=>{
    const geometry=new BoxGeometry(), pipe=new CylinderGeometry(1,1,1,8)
    const slideObstacles = slideObstacleInstances(platforms, barriers)
    const guides = course.takeoffs.flatMap((x, index) => x === undefined ? [] : [
      { position: [x ?? platforms[index][1] - 0.14, platforms[index][2] + 0.006, 0], scale: [x === null ? 0.2 : 0.07, 0.012, 2.5], tint: x === null ? '#E53935' : '#d0d0d0' },
      { position: [platforms[index + 1][0] + 0.24, platforms[index + 1][2] + 0.004, 0], scale: [0.08, 0.008, 2.5], tint: '#6f9cac' },
    ] satisfies import('../scene/StaticInstances').StaticInstance[])
    for (const zone of course.zones.filter(zone => zone.environment === 'underground')) {
      const [, tunnel, drainage] = zone.platforms
      const width = drainage[0] - tunnel[1], x = (tunnel[1] + drainage[0]) / 2
      // Close the rear wall and ceiling across the drain without bridging its floor.
      guides.push(
        { position: [x, tunnel[2] + .5, -2.9], scale: [width, 8.2, .35], tint: '#b4c4cb' },
        { position: [x, tunnel[2] + 4.05, -.15], scale: [width, .35, 5.2], tint: '#383838' },
      )
    }
    // Small reflective plates and painted hazard bands share the guide batch.
    for (const [index, marker] of course.takeoffs.entries()) {
      if (marker === undefined) continue
      const [, end, roof] = platforms[index]
      for (const z of [-1.12, 1.12]) {
        guides.push({ position: [end - 0.08, roof + 0.012, z], scale: [0.16, 0.024, 0.32], tint: marker === null ? '#E53935' : '#bcbcbc' })
      }
      if (marker === null) {
        const [start, , top] = platforms[index + 1]
        for (const x of [start + 0.45, start + 1.25, start + 2.05]) {
          guides.push({ position: [x, top + 0.007, 1.23], scale: [0.4, 0.014, 0.12], tint: '#a0b4bb' })
        }
      }
    }
    for (const index of course.bridges) {
      const [start, end, top] = platforms[index]
      for (const x of [start + 0.12, end - 0.12]) {
        for (const z of [-1.32, 1.32]) {
          guides.push({ position: [x, top + 0.65, z], scale: [0.08, 0.12, 0.08], tint: '#b8a17a' })
        }
      }
    }
    for (const x of [78.7, 79.3, 86.5, 87.1]) {
      for (const z of [-0.93, 0.93]) {
        guides.push({ position: [x, platforms[5][2] + 0.007, z], scale: [0.3, 0.014, 0.08], tint: x < 80 ? '#a69273' : '#8fa49b' })
      }
    }
    const guideMaterial = new MeshBasicMaterial({color:'#ffffff',toneMapped:false})
    const layers=CITY_LAYERS.map(config=>({...cityInstances(config),
      bodyMaterial:new MeshBasicMaterial({color:config.color,toneMapped:false}),
}))
    const materials={
      obstacleSteel: new MeshBasicMaterial({color:SLIDE_STEEL_COLOR,toneMapped:false}),
      facade:new MeshBasicMaterial({color:'#242424',toneMapped:false}),
      surfaces:new MeshBasicMaterial({color:'#42464a',toneMapped:false}),
      trim:new MeshBasicMaterial({color:'#919a9f',toneMapped:false}),
      details:new MeshBasicMaterial({color:'#353535',toneMapped:false}),
      windows:new MeshBasicMaterial({color:'#b4c4cb',toneMapped:false}),
      pipes:new MeshBasicMaterial({color:'#82949d',toneMapped:false}),
      vents:new MeshBasicMaterial({color:'#505050',toneMapped:false}),
    }
    const roof = rooftopInstances(platforms)
    // Retain broad architectural silhouettes; suppress small fixtures and front panels.
    roof.details = constructionScenery()
    roof.pipes = roof.pipes.filter(instance => instance.position[2] < -2)
    roof.trim = platforms.map(([start, end, top]) => ({
      position: [(start + end) / 2, top - .025, 1.415],
      scale: [end - start, .05, .035],
    }))
    roof.windows = roof.facade.filter(instance => instance.position[2] < -2 && instance.scale[0] >= 2 && instance.scale[1] >= 1)
    roof.facade = roof.facade.filter(instance => instance.position[2] >= -2 && instance.scale[0] >= .5)
    for (const name of ['facade', 'surfaces', 'trim', 'details', 'pipes', 'windows'] as const) {
      for (const instance of roof[name]) instance.tint = undefined
    }
    return {geometry,pipe,layers,materials,guides,guideMaterial,roof,slideObstacles}
  },[platforms])
  useEffect(()=>()=>{
    scene.geometry.dispose();scene.pipe.dispose()
    scene.guideMaterial.dispose()
    scene.layers.forEach(layer=>layer.bodyMaterial.dispose())
    Object.values(scene.materials).forEach(material=>material.dispose())
  },[scene])
  useEffect(()=>{
    const previous=renderScene.onAfterRender
    const report: typeof renderScene.onAfterRender = function(...args) {
      previous.apply(renderScene,args)
      const metrics=args[0].info.render as typeof args[0]['info']['render'] & {drawCalls?:number}
      if(diagnostics.current)Object.assign(diagnostics.current.dataset,{drawCalls:String(metrics.drawCalls??metrics.calls),triangles:String(metrics.triangles)})
    }
    renderScene.onAfterRender=report
    return ()=>{if(renderScene.onAfterRender===report)renderScene.onAfterRender=previous}
  },[renderScene,diagnostics])
  // Run after GameScene has updated the camera; no independent smoothing/clock drift.
  useFrame(({camera}, delta)=>{
    if (!reducedMotion && helicopter.current && rotor.current) {
      flight.current += Math.min(delta, .1)
      helicopter.current.position.x = ((flight.current * .35 + 19) % 48) - 24
      rotor.current.rotation.y = flight.current * 14
    }
    parallax.update(camera.position.x,reset.restarts,reducedMotion)
    CITY_LAYERS.forEach((config, index) => {
      const group = groups.current[index]
      if (!group) return
      group.position.x = parallax.offset(camera.position.x, config.rate)
      // Keep the skyline horizon framed while the camera follows roof elevations.
      group.position.y = camera.position.y - 3.6
    })
    if(diagnostics.current) Object.assign(diagnostics.current.dataset,{
      cityTravel:String(parallax.travel),cityFarOffset:String(parallax.offset(camera.position.x,CITY_LAYERS[0].rate)-camera.position.x),
      decorations:String(decorations),
    })
  }, -1)
  return <>
    <NightSky />
    <ambientLight color="#ffffff" intensity={1} />
    <directionalLight color="#ffffff" position={[-3,7,5]} intensity={1.6} />
    <StaticInstances geometry={scene.geometry} material={scene.guideMaterial} instances={scene.guides} />
    <StaticInstances geometry={scene.geometry} material={scene.materials.obstacleSteel} instances={scene.slideObstacles.boxes} />
    <StaticInstances geometry={scene.pipe} material={scene.materials.obstacleSteel} instances={scene.slideObstacles.pipes} />
    <StaticInstances geometry={scene.geometry} material={scene.guideMaterial} instances={scene.slideObstacles.markings} />
    {scene.layers.map((layer,index)=><group key={index} ref={group=>{groups.current[index]=group}}>
      <StaticInstances geometry={scene.geometry} material={layer.bodyMaterial} instances={layer.bodies} />
      {decorations && index === 1 && <CorporateSigns />}
      {decorations && index === 0 && <group ref={helicopter} position={[-5, 3, -35]}>
        <mesh><boxGeometry args={[.9, .28, .3]} /><meshBasicMaterial color="#354550" toneMapped={false} /></mesh>
        <mesh position={[.3, .02, .16]}><boxGeometry args={[.24, .15, .025]} /><meshBasicMaterial color="#85969d" toneMapped={false} /></mesh>
        <mesh position={[-.65, .06, 0]}><boxGeometry args={[.7, .07, .09]} /><meshBasicMaterial color="#354550" toneMapped={false} /></mesh>
        <mesh position={[-.95, .15, 0]}><boxGeometry args={[.08, .28, .08]} /><meshBasicMaterial color="#354550" toneMapped={false} /></mesh>
        <mesh position={[0, .23, 0]}><boxGeometry args={[.05, .2, .05]} /><meshBasicMaterial color="#354550" toneMapped={false} /></mesh>
        <group ref={rotor} position={[0, .33, 0]}>
          <mesh><boxGeometry args={[1.9, .025, .06]} /><meshBasicMaterial color="#354550" toneMapped={false} /></mesh>
        </group>
        {[-.16, .16].map(z => <mesh key={z} position={[0, -.2, z]}><boxGeometry args={[1.1, .035, .035]} /><meshBasicMaterial color="#354550" toneMapped={false} /></mesh>)}
      </group>}
    </group>)}
    {(['facade','surfaces','trim','details','pipes','windows'] as const).map(name=>
      (decorations||name==='facade'||name==='surfaces'||name==='trim'||name==='windows')&&<StaticInstances key={name}
        geometry={name==='pipes'?scene.pipe:scene.geometry} material={scene.materials[name]} instances={scene.roof[name]} />)}
  </>
}
