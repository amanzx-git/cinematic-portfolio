"""Compare exported deformation to the canonical bake, then render local pose sheets.
No runtime scene or source FBX is modified. Run with Blender --background --python.
"""
import bpy
import json
import sys
import warnings
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
warnings.filterwarnings('ignore', category=DeprecationWarning)

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'asset-source' / 'runner'
OUT = ROOT / 'test-results' / 'runner'
OUT.mkdir(parents=True, exist_ok=True)
names = ('Idle', 'Run', 'Jump', 'Land')

def activate(rig, action):
    rig.animation_data_create()
    for t in rig.animation_data.nla_tracks:
        t.mute = True
    rig.animation_data.action = action
    if len(action.slots):
        rig.animation_data.action_slot = action.slots[0]

def points(meshes):
    dg = bpy.context.evaluated_depsgraph_get()
    result = []
    for obj in meshes:
        evaluated = obj.evaluated_get(dg)
        mesh = evaluated.to_mesh()
        result.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    return result

def tree(pts):
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    return kd

# Save sampled deformed geometry from the normalized canonical .blend.
bpy.ops.wm.open_mainfile(filepath=str(STAGE / 'runner-canonical.blend'))
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == rig]
reference = {}
for name in names:
    action = bpy.data.actions[name]
    activate(rig, action)
    start, end = action.frame_range
    reference[name] = []
    for fraction in (0, .25, .5, .75, 1):
        frame = start + fraction*(end-start)
        bpy.context.scene.frame_set(int(frame), subframe=frame-int(frame))
        bpy.context.view_layer.update()
        reference[name].append(points(meshes))

# Fresh glTF importer round trip, with no old bind rig/actions retained.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(STAGE / 'runner-candidate.glb'))
rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
assert len(rigs) == 1
rig = rigs[0]
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == rig]
report = {'blender': bpy.app.version_string, 'rigs': len(rigs), 'bones': len(rig.data.bones),
          'mesh_objects': len(meshes), 'actions': [a.name for a in bpy.data.actions], 'clips': {}}
print('ROUNDTRIP_ACTIONS', report['actions'])
snapshots = {}
for name in names:
    matches = [a for a in bpy.data.actions if a.name == name or a.name.startswith(name + '_')]
    assert len(matches) == 1, (name, report['actions'])
    action = matches[0]
    activate(rig, action)
    start, end = action.frame_range
    max_error = 0
    snapshots[name] = []
    for i, fraction in enumerate((0, .25, .5, .75, 1)):
        frame = start + fraction*(end-start)
        bpy.context.scene.frame_set(int(frame), subframe=frame-int(frame))
        bpy.context.view_layer.update()
        actual = points(meshes)
        a, b = tree(actual), tree(reference[name][i])
        max_error = max(max_error, max(b.find(v)[2] for v in actual),
                        max(a.find(v)[2] for v in reference[name][i]))
        # Evaluated mesh snapshots are for the review scene only, never exported.
        items = []
        dg = bpy.context.evaluated_depsgraph_get()
        for obj in meshes:
            evaluated = obj.evaluated_get(dg)
            copied = bpy.data.meshes.new_from_object(evaluated, depsgraph=dg)
            copied.transform(evaluated.matrix_world)
            items.append(copied)
        snapshots[name].append(items)
    if max_error >= .00025:
        def bounds(pts):
            return [[min(v[i] for v in pts) for i in range(3)], [max(v[i] for v in pts) for i in range(3)]]
        print('ROUNDTRIP_MISMATCH', name, list(action.frame_range), 'actual', bounds(actual), 'reference', bounds(reference[name][i]),
              'rig', [list(row) for row in rig.matrix_world])
    assert max_error < .00025, (name, 'glTF deformation changed', max_error)
    report['clips'][name] = {'source_range': list(action.frame_range),
                            'five_pose_bidirectional_surface_error_m': max_error}
(STAGE / 'roundtrip-report.json').write_text(json.dumps(report, indent=2))
print('ROUNDTRIP_VALIDATED', json.dumps(report))
if '--check-only' in sys.argv:
    sys.exit(0)

# Render five front and five side poses per clip using CPU Cycles.
for obj in list(bpy.context.scene.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.render.resolution_x = 1800
scene.render.resolution_y = 820
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('ReviewWorld')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.16, .18, .2, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
camera_data = bpy.data.cameras.new('ReviewCamera')
camera = bpy.data.objects.new('ReviewCamera', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -12, 2.15)
camera.rotation_euler = (Vector((0, 0, 2.15))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 12.3
scene.camera = camera
for x in (-4, 4):
    data = bpy.data.lights.new('ReviewLight', 'AREA')
    data.energy, data.shape, data.size = 1700, 'DISK', 8
    obj = bpy.data.objects.new('ReviewLight', data)
    scene.collection.objects.link(obj)
    obj.location = (x, -4, 7)
    obj.rotation_euler = (Vector((0, 0, 2))-obj.location).to_track_quat('-Z', 'Y').to_euler()
for name, poses in snapshots.items():
    created = []
    for i, components in enumerate(poses):
        all_points = [v.co for m in components for v in m.vertices]
        # Center only review geometry; GLB motion is not recentered or altered.
        min_z = min(v.z for v in all_points)
        center = (min(v.x for v in all_points)+max(v.x for v in all_points))/2
        center_y = (min(v.y for v in all_points)+max(v.y for v in all_points))/2
        for row in range(2):
            transform = Matrix.Translation(((i-2)*2.25, 0, (1-row)*2.45)) @ Matrix.Rotation(row*1.57079632679, 4, 'Z') @ Matrix.Translation((-center, -center_y, -min_z))
            for component in components:
                obj = bpy.data.objects.new(name + '_review', component)
                scene.collection.objects.link(obj)
                obj.matrix_world = transform
                created.append(obj)
    scene.render.filepath = str(OUT / (name.lower() + '-poses.png'))
    bpy.ops.render.render(write_still=True)
    for obj in created:
        bpy.data.objects.remove(obj, do_unlink=True)
print('RUNNER_POSE_SHEETS', str(OUT))
