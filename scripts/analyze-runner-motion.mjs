import {readFile,writeFile} from 'node:fs/promises'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {AnimationMixer,LoopOnce,Vector3} from 'three'
import {GameAnimation,VISUAL_OFFSETS} from '../src/game/animation.ts'

const bytes=await readFile('public/assets/characters/runner/runner.glb')
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
const game=new GameAnimation(asset)
const report={}
const meshes=[]
asset.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)})
const point=new Vector3()
for(const clip of asset.animations){
 const outputs={}
 for(const mode of ['source','runtime']){
  game.mixer.stopAllAction()
  const mixer=mode==='source'?new AnimationMixer(asset.scene):game.mixer
  const action=mode==='source'?mixer.clipAction(clip):game.actions[clip.name]
  action.reset().setLoop(LoopOnce,1).setEffectiveTimeScale(1).play()
  const samples=[]
  for(let i=0;i<=Math.ceil(clip.duration*120);i++){
   const time=Math.min(clip.duration,i/120)
   action.time=time;mixer.update(0);asset.scene.updateMatrixWorld(true)
   let low=Infinity,high=-Infinity
   for(const mesh of meshes){
    mesh.skeleton.update();mesh.computeBoundingBox()
    low=Math.min(low,mesh.boundingBox.min.y);high=Math.max(high,mesh.boundingBox.max.y)
   }
   const hips=asset.scene.getObjectByName('mixamorigHips')
   const feet=['LeftToeBase','RightToeBase','LeftFoot','RightFoot'].map(name=>asset.scene.getObjectByName('mixamorig'+name).getWorldPosition(point).toArray())
   samples.push({time,low,high,hips:hips.position.toArray(),feet})
  }
  outputs[mode]={renderedOffset:mode==='runtime'?VISUAL_OFFSETS[clip.name]:0,min:Math.min(...samples.map(s=>s.low)),max:Math.max(...samples.map(s=>s.low)),samples}
  mixer.stopAllAction()
  if(mode==='source')mixer.uncacheRoot(asset.scene)
 }
 const samples=outputs.source.samples
 const root=samples.at(-1).hips.map((v,i)=>v-samples[0].hips[i])
 report[clip.name]={duration:clip.duration,rootDelta:root,sourceSpeed:root[2]/clip.duration,...outputs}
}
for (const name of ['Run', 'Slide']) {
  const samples = report[name].source.samples
  const count = Math.round(report[name].duration * 30) + 1
  const lifts = []
  for (let i = 0; i < count; i++) {
    const interval = samples.slice(Math.max(0, i * 4 - 4), i * 4 + 5)
    lifts.push(Math.ceil(Math.max(0, -Math.min(...interval.map(sample => sample.low))) * 10000) / 10000)
  }
  if (name === 'Run') lifts[0] = lifts[lifts.length - 1] = Math.max(lifts[0], lifts[lifts.length - 1])
  report[name].soleLifts30Hz = lifts
}
game.dispose()
await writeFile(process.argv[2]??'test-results/runner-motion.json',JSON.stringify(report,null,2))
console.log(Object.fromEntries(Object.entries(report).map(([name,r])=>[name,{duration:r.duration,sourceSpeed:r.sourceSpeed,sourceSole:[r.source.min,r.source.max],runtimeSole:[r.runtime.min,r.runtime.max],rootDelta:r.rootDelta}])))
