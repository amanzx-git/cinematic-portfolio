// Local-only GLB structure + installed Three GLTFLoader/skinning/animation checks.
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { AnimationMixer, Box3, Matrix4, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const path = process.argv[2] ?? 'asset-source/runner/runner-candidate.glb'
const bytes = await fs.readFile(path)
assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
assert.equal(bytes.readUInt32LE(4), 2)
assert.equal(bytes.readUInt32LE(8), bytes.length)
const json = JSON.parse(bytes.toString('utf8', 20, 20+bytes.readUInt32LE(12)))
assert.deepEqual([...json.animations.map(a=>a.name)].sort(), ['Idle','Jump','Land','Run'])
assert.equal(json.skins.length, 1)
assert.equal(json.skins[0].joints.length, 65)
assert.equal(json.meshes.length, 1)
assert.equal(json.nodes.filter(n=>n.skin!==undefined).length, 1)
assert.ok(!json.extensionsRequired?.length)
assert.ok(!json.images?.length)
assert.ok((json.materials??[]).every(m=>!m.alphaMode||m.alphaMode==='OPAQUE'))
assert.ok(json.buffers.every(b=>!b.uri))
assert.ok(json.nodes.every(n=>!n.scale || n.scale.every(v=>v>0)))
const root = json.nodes.find(n=>n.name==='CharacterRoot')
assert.ok(root)
assert.ok(!root.translation || root.translation.every(v=>Math.abs(v)<1e-6))
assert.ok(!root.scale || root.scale.every(v=>Math.abs(v-1)<1e-6))
assert.ok(!root.rotation || root.rotation.every((v,i)=>Math.abs(v-(i===3?1:0))<1e-6))
const joints = new Set(json.skins[0].joints)
assert.ok(json.animations.every(a=>a.channels.every(c=>joints.has(c.target.node))))
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength), '')
gltf.scene.updateMatrixWorld(true)
const meshes=[]
gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)})
// Three creates one SkinnedMesh per glTF primitive; both share the same skin.
assert.equal(new Set(meshes.map(m=>m.skeleton)).size,1)
const restBounds = new Box3()
let vertices=0, triangles=0, maxInfluences=0, weightError=0, bindError=0
for(const m of meshes){
 const g=m.geometry, weights=g.attributes.skinWeight, indices=g.attributes.skinIndex
 vertices+=g.attributes.position.count; triangles+=(g.index?.count??g.attributes.position.count)/3
 for(let i=0;i<weights.count;i++){
  const ws=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)]
  const js=[indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)]
  assert.ok(ws.every(w=>Number.isFinite(w)&&w>=0))
  assert.ok(js.every(j=>Number.isInteger(j)&&j>=0&&j<65))
  maxInfluences=Math.max(maxInfluences,ws.filter(w=>w>1e-7).length)
  weightError=Math.max(weightError,Math.abs(ws.reduce((a,b)=>a+b,0)-1))
 }
 for(let i=0;i<m.skeleton.bones.length;i++){
  const product=new Matrix4().multiplyMatrices(m.skeleton.bones[i].matrixWorld,m.skeleton.boneInverses[i])
  bindError=Math.max(bindError,...product.elements.map((v,j)=>Math.abs(v-(j%5===0?1:0))))
 }
 m.skeleton.update();m.computeBoundingBox();restBounds.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld))
}
assert.ok(weightError<.001&&maxInfluences<=4&&bindError<1e-4)
const size=restBounds.getSize(new Vector3())
assert.ok(Math.abs(size.y-1.8)<.001, `Neutral height ${size.y}`)
assert.ok(Math.abs(restBounds.min.y)<.001, `Sole ${restBounds.min.y}`)
const skeleton=meshes[0].skeleton
const jointPosition=suffix=>skeleton.bones.find(b=>b.name.endsWith(suffix)).getWorldPosition(new Vector3())
const forwardEvidence=jointPosition('LeftToeBase').sub(jointPosition('LeftFoot')).add(jointPosition('RightToeBase').sub(jointPosition('RightFoot'))).multiplyScalar(.5)
assert.ok(forwardEvidence.z>0,'Rest feet must face glTF +Z')
const mixer=new AnimationMixer(gltf.scene)
const bone=gltf.scene.getObjectByName('mixamorigHips')??gltf.scene.getObjectByName('mixamorig:Hips')
assert.ok(bone)
const clips=[]
for(const clip of gltf.animations){
 mixer.stopAllAction()
 const action=mixer.clipAction(clip);action.reset().play()
 const positions=[], boxes=[]
 const sampleCount=Math.ceil(clip.duration*60)
 let maxTurnDegrees=0, firstRotation
 for(let i=0;i<=sampleCount;i++){
  action.time=clip.duration*i/sampleCount;mixer.update(0);gltf.scene.updateMatrixWorld(true)
  if(!firstRotation)firstRotation=bone.quaternion.clone()
  maxTurnDegrees=Math.max(maxTurnDegrees,bone.quaternion.angleTo(firstRotation)*180/Math.PI)
  for(const m of meshes)for(const b of m.skeleton.bones)assert.ok(b.scale.toArray().every(s=>Math.abs(s-1)<1e-5),'Animated bone scale')
  const bounds=new Box3()
  for(const m of meshes){
   m.skeleton.update()
   for(let j=0;j<m.geometry.attributes.position.count;j++){
    const v=new Vector3().fromBufferAttribute(m.geometry.attributes.position,j)
    m.applyBoneTransform(j,v).applyMatrix4(m.matrixWorld)
    assert.ok(v.toArray().every(Number.isFinite),'Nonfinite deformed vertex')
    bounds.expandByPoint(v)
   }
  }
  positions.push(bone.getWorldPosition(new Vector3()).toArray())
  boxes.push([bounds.min.toArray(),bounds.max.toArray()])
 }
 assert.ok(clip.duration>0)
 clips.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,samples:sampleCount+1,maxHipsRotationDegreesFromFirst:maxTurnDegrees,
  hipsFirst:positions[0],hipsLast:positions.at(-1),
  hipsNet:positions[0].map((v,i)=>positions.at(-1)[i]-v),
  hipsExtent:positions[0].map((_,i)=>Math.max(...positions.map(p=>p[i]))-Math.min(...positions.map(p=>p[i]))),
  deformedBounds:boxes})
}
mixer.stopAllAction();mixer.uncacheRoot(gltf.scene)
const report={file:path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
 gltfGenerator:json.asset.generator,canonicalSkins:json.skins.length,joints:65,
 gltfMeshes:json.meshes.length,primitives:json.meshes[0].primitives.length,
 threeSkinnedPrimitives:meshes.length,vertices,triangles,materials:json.materials?.length??0,
 images:json.images?.length??0,maxInfluences,weightError,bindError,
 restBounds:[restBounds.min.toArray(),restBounds.max.toArray()],footToToeForwardVector:forwardEvidence.toArray(),clips}
await fs.mkdir('asset-source/runner',{recursive:true})
await fs.writeFile('asset-source/runner/gltf-validation.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({...report,clips:clips.map(({deformedBounds,...c})=>c)},null,2))
