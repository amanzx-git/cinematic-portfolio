"""F2B.1 canonical-rig retarget bake. Originals are read-only; output is staged.

blender --background --python scripts/build_runner.py
Preserves source root motion deliberately: this is NOT an in-place cleanup.
"""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from runner_retarget import bake_action

STAGE = ROOT / 'asset-source' / 'runner'
NAMES = ('Idle', 'Run', 'Jump', 'Land')
paths = {n: STAGE / (n + '.fbx') for n in NAMES}
assert all(p.is_file() for p in paths.values()), 'Four original FBXs are required'
hashes = {n: hashlib.sha256(p.read_bytes()).hexdigest() for n, p in paths.items()}
report = {'blender': bpy.app.version_string, 'sources': hashes,
          'root_motion': 'PRESERVED SOURCE MOTION; not runtime in-place', 'clips': {}}

def rigid(matrix):
    p, q, s = matrix.decompose()
    return Matrix.LocRotScale(p, q, Vector((1, 1, 1)))

def import_file(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(paths[name]))
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(rigs) == 1, (name, 'expected exactly one source rig')
    return rigs[0]

# Determine one normalization from the canonical neutral mesh, not per clip.
rig = import_file('Idle')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert meshes and all(o.find_armature() == rig for o in meshes)
points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
low, high = min(p.z for p in points), max(p.z for p in points)
scale = 1.8 / (high - low)
feet = [rig.matrix_world @ rig.data.bones['mixamorig:' + n].head_local
        for n in ('LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase')]
origin = sum(feet, Vector()) / len(feet)
normalization = Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation((-origin.x, -origin.y, -low))
report['normalization'] = {'source_neutral_height_m': high-low, 'uniform_factor': scale,
                           'source_sole_z_m': low, 'origin_xy_m': list(origin)[:2],
                           'output_height_m': 1.8, 'blender_forward': '-Y', 'glTF_forward': '+Z'}

# Cache evaluated source poses; no source action is copied onto the target rig.
sources = {}
for name in NAMES:
    rig = import_file(name)
    action = rig.animation_data.action
    assert action and len(bpy.data.actions) == 1
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    assert abs(fps-30) < 1e-6
    rest = {b.name: rigid(normalization @ rig.matrix_world @ b.matrix_local) for b in rig.data.bones}
    parents = {b.name: b.parent.name if b.parent else None for b in rig.data.bones}
    samples = []
    for frame in range(round(action.frame_range[0]), round(action.frame_range[1])+1):
        bpy.context.scene.frame_set(frame)
        samples.append({b.name: rigid(normalization @ rig.matrix_world @ b.matrix) for b in rig.pose.bones})
    sources[name] = {'rest': rest, 'parents': parents, 'poses': samples}
    report['clips'][name] = {'original_action': action.name, 'source_range': list(action.frame_range),
                             'samples': len(samples), 'duration_seconds': (len(samples)-1)/fps}
canonical = sources['Idle']
assert all(s['parents'] == canonical['parents'] for s in sources.values()), 'Hierarchy mismatch'
assert len(canonical['rest']) == 65

# Normalize the single canonical bind rig and mesh together, in metres.
rig = import_file('Idle')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
rig.animation_data_clear()
mesh_worlds = {o.name: o.matrix_world.copy() for o in meshes}
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
world = rig.matrix_world.copy()
rig.data.transform(normalization @ world)
rig.matrix_world = Matrix.Identity(4)
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
for mesh in meshes:
    mesh_world = mesh_worlds[mesh.name]
    mesh.parent = None
    mesh.data.transform(normalization @ mesh_world)
    mesh.matrix_world = Matrix.Identity(4)
    assert len([m for m in mesh.modifiers if m.type == 'ARMATURE']) == 1
    mesh.modifiers[0].object = rig
rig.name = 'RunnerRig'
bpy.context.view_layer.update()
target_rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
assert all((target_rest[n].translation-canonical['rest'][n].translation).length < 1e-5 for n in target_rest)
assert all(abs(s-1) < 1e-5 for m in target_rest.values() for s in m.to_scale())

# Original surface and joint shells form ONE character, not duplicate characters.
bpy.ops.object.select_all(action='DESELECT')
for mesh in meshes:
    mesh.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'RunnerMesh'
mesh.parent = rig
mesh.matrix_parent_inverse = Matrix.Identity(4)
mesh.matrix_basis = Matrix.Identity(4)
mesh.data.calc_loop_triangles()
weights = [[g.weight for g in v.groups if g.weight > 1e-7] for v in mesh.data.vertices]
assert all(w and len(w) <= 4 and abs(sum(w)-1) < .001 for w in weights), 'Skin weight check failed'
report['geometry'] = {'vertices': len(mesh.data.vertices), 'triangles': len(mesh.data.loop_triangles),
                       'materials': len(mesh.data.materials), 'max_influences': max(map(len, weights)),
                       'material_names': [m.name for m in mesh.data.materials],
                       'images': [i.name for i in bpy.data.images if i.source == 'FILE']}

rig.animation_data_create()
scene = bpy.context.scene
scene.render.fps = 30
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
for name, source in sources.items():
    action, expected_samples, errors = bake_action(rig, name, source)
    max_position_error, max_angle_error, max_local_translation = errors
    report['clips'][name].update(max_bake_position_error_m=max_position_error,
                                 max_quaternion_dot_error=max_angle_error,
                                 max_nonroot_local_translation_m=max_local_translation)
    # NLA tracks explicitly register four independently exportable animations.
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = len(source['poses'])
    strip.mute = False
    track.mute = True
    (STAGE / (name + '-expected.json')).write_text(json.dumps(expected_samples))
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
root = bpy.data.objects.new('CharacterRoot', None)
scene.collection.objects.link(root)
rig.parent = root
rig.matrix_parent_inverse = Matrix.Identity(4)
rig.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()
scene.frame_start, scene.frame_end = 1, 79
bpy.ops.wm.save_as_mainfile(filepath=str(STAGE / 'runner-canonical.blend'))
candidate = STAGE / 'runner-candidate.glb'
bpy.ops.export_scene.gltf(filepath=str(candidate), export_format='GLB', export_animations=True,
                         export_animation_mode='ACTIONS', export_frame_range=False,
                         export_force_sampling=True, export_anim_slide_to_zero=True,
                         export_reset_pose_bones=True, export_skins=True,
                         export_influence_nb=4, export_all_influences=False,
                         export_morph=False, export_cameras=False, export_lights=False,
                         export_yup=True, export_rest_position_armature=True)
assert hashes == {n: hashlib.sha256(p.read_bytes()).hexdigest() for n, p in paths.items()}, 'Source changed'
report['candidate'] = {'bytes': candidate.stat().st_size, 'sha256': hashlib.sha256(candidate.read_bytes()).hexdigest()}
(STAGE / 'build-report.json').write_text(json.dumps(report, indent=2))
print('RUNNER_BUILD ' + json.dumps(report))
