"""Stage a retargeted Slide and measure its in-place skinned height at 120 Hz."""
import bpy
import json
import hashlib
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from runner_retarget import bake_action

STAGE = ROOT / 'asset-source' / 'runner'
source_path = next((p for folder in (STAGE, ROOT / 'public/assets/characters/runner')
                    for p in folder.iterdir() if p.name.lower() == 'slide.fbx'), None)
assert source_path, 'Slide FBX missing'
n = json.loads((STAGE / 'build-report.json').read_text())['normalization']
factor = n['uniform_factor']
x, y = n['origin_xy_m']
normalize = Matrix.Diagonal((factor, factor, factor, 1)) @ Matrix.Translation((-x, -y, -n['source_sole_z_m']))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source_path))
rig, = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
scene = bpy.context.scene
assert scene.render.fps / scene.render.fps_base == 30
action = rig.animation_data.action
first, last = map(round, action.frame_range)

def normalized(matrix):
    p, q, _ = (normalize @ rig.matrix_world @ matrix).decompose()
    return Matrix.LocRotScale(p, q, Vector((1, 1, 1)))

rest = {b.name: normalized(b.matrix_local) for b in rig.data.bones}
parents = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
poses = []
for frame in range(first, last + 1):
    scene.frame_set(frame)
    poses.append({b.name: normalized(b.matrix) for b in rig.pose.bones})
bpy.ops.wm.open_mainfile(filepath=str(STAGE / 'runner-canonical.blend'))
scene = bpy.context.scene
rig = bpy.data.objects['RunnerRig']
mesh = bpy.data.objects['RunnerMesh']
assert len(parents) == 65 and parents == {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
rig.animation_data_clear()
rig.animation_data_create()
for old_action in list(bpy.data.actions):
    bpy.data.actions.remove(old_action)
action, _, errors = bake_action(rig, 'Slide', {'rest': rest, 'poses': poses})
bpy.ops.export_scene.gltf(filepath=str(STAGE / 'slide-staged.glb'), export_format='GLB',
                         export_animation_mode='ACTIONS', export_force_sampling=True,
                         export_anim_slide_to_zero=True, export_reset_pose_bones=True,
                         export_influence_nb=4, export_morph=False, export_rest_position_armature=True)
hips = rig.pose.bones['mixamorig:Hips']
heights, lows = [], []
for i in range((last - first) * 4 + 1):
    scene.frame_set(1 + i // 4, subframe=(i % 4) / 4)
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    z = [v.co.z for v in evaluated.data.vertices]
    heights.append(round(max(z), 4))
    lows.append(round(min(z), 4))
report = {'source': str(source_path.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(), 'duration': (last - first) / 30, 'sourceFps': 30, 'poseFps': 120,
          'errors': errors, 'heights': heights, 'lows': lows,
          'sourcePelvisDisplacement': list(poses[-1][hips.name].translation - poses[0][hips.name].translation)}
(STAGE / 'slide-report.json').write_text(json.dumps(report, indent=2))
# Generate the runtime upper envelope from the same measured canonical skin.
# Neighbouring intervals share their maximum, so interpolation is conservative.
import math
envelope = []
for i in range(last - first + 1):
    samples = heights[max(0, i * 4 - 4):i * 4 + 5]
    envelope.append(min(1.8, max(.8, math.ceil((max(samples) + .01) * 1000) / 1000)))
envelope[:3] = envelope[-3:] = [1.8] * 3
report['colliderEnvelope30Hz'] = envelope
(STAGE / 'slide-report.json').write_text(json.dumps(report, indent=2))
print('SLIDE_REPORT', json.dumps(report))
