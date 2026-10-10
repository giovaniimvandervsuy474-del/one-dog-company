import * as THREE from 'three'
const clamp = THREE.MathUtils.clamp
export type PuppyRig = { shoulders: THREE.Bone[]; elbows: THREE.Bone[]; wrists: THREE.Bone[] }
/** Soft regional skin weights for the supplied single-mesh character; no face deformation. */
export function rigPuppy(model: THREE.Object3D): PuppyRig {
  const rig: PuppyRig = { shoulders: [], elbows: [], wrists: [] }
  const meshes: THREE.Mesh[] = []
  model.traverse(o => { if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh)) meshes.push(o) })
  for (const mesh of meshes) {
    const geometry = mesh.geometry.clone(), positions = geometry.attributes.position
    const indices = new Uint16Array(positions.count * 4), weights = new Float32Array(positions.count * 4)
    const root = new THREE.Bone(); root.name = 'OneDogRoot'
    const bones: THREE.Bone[] = [root]
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Bone(), elbow = new THREE.Bone(), wrist = new THREE.Bone()
      shoulder.name = `${side < 0 ? 'Left' : 'Right'}Shoulder`; elbow.name = shoulder.name.replace('Shoulder','Elbow'); wrist.name = shoulder.name.replace('Shoulder','Wrist')
      shoulder.position.set(side * .40, -.06, .03); elbow.position.set(side * .07, -.17, .24); wrist.position.set(0, -.04, .23)
      root.add(shoulder); shoulder.add(elbow); elbow.add(wrist); bones.push(shoulder, elbow, wrist)
      rig.shoulders.push(shoulder); rig.elbows.push(elbow); rig.wrists.push(wrist)
    }
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), base = x < 0 ? 1 : 4
      const outside = clamp((Math.abs(x) - .27) / .13, 0, 1)
      const front = clamp((z - .03) / .18, 0, 1)
      const lower = clamp((y + .58) / .15, 0, 1), upper = clamp((.12 - y) / .14, 0, 1)
      const arm = outside * front * lower * upper
      const forearm = clamp((z - .18) / .24, 0, 1), paw = clamp((z - .42) / .13, 0, 1)
      indices.set([0, base, base + 1, base + 2], i * 4)
      weights.set([1 - arm, arm * (1 - forearm), arm * forearm * (1 - paw), arm * forearm * paw], i * 4)
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
    const skinned = new THREE.SkinnedMesh(geometry, mesh.material); skinned.name = 'OneDogTypingRig'; skinned.position.copy(mesh.position); skinned.rotation.copy(mesh.rotation); skinned.scale.copy(mesh.scale)
    skinned.add(root); skinned.updateMatrixWorld(true); skinned.bind(new THREE.Skeleton(bones)); skinned.frustumCulled = false
    mesh.parent?.add(skinned); mesh.removeFromParent()
  }
  return rig
}
