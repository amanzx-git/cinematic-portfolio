"""Read-only FBX intake. Run with Blender --background --python this_file."""
import bpy
import json
import hashlib
import math
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
report = {"blender": bpy.app.version_string, "files": {}}
def curves(action):
    return [fc for layer in action.layers for strip in layer.strips
            for bag in strip.channelbags for fc in bag.fcurves]
for name in ("Idle", "Run", "Jump", "Land"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = root / "asset-source" / "runner" / (name + ".fbx")
    bpy.ops.import_scene.fbx(filepath=str(path))
    rigs = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    scene = bpy.context.scene
    motion = {}
    for rig in rigs:
        action = rig.animation_data.action if rig.animation_data else None
        if not action:
            continue
        samples = []
        tracked = [b.name for b in rig.data.bones if b.parent is None or
                   any(part in b.name.lower() for part in ("hips", "foot", "toe"))]
        for frame in range(math.floor(action.frame_range[0]), math.ceil(action.frame_range[1]) + 1):
            scene.frame_set(frame)
            samples.append({"frame": frame,
                            "object_matrix": [list(row) for row in rig.matrix_world],
                            "bones_world": {n: list(rig.matrix_world @ rig.pose.bones[n].head)
                                            for n in tracked},
                            "hips_rotation": {n: list(rig.pose.bones[n].matrix.to_quaternion())
                                              for n in tracked if "hips" in n.lower()}})
        motion[rig.name] = samples
    report["files"][name] = {
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "bytes": path.stat().st_size,
        "fps": scene.render.fps / scene.render.fps_base,
        "unit_settings": {"system": scene.unit_settings.system,
                          "scale_length": scene.unit_settings.scale_length},
        "objects": [{"name": o.name, "type": o.type,
                     "matrix_world": [list(row) for row in o.matrix_world],
                     "scale": list(o.scale)} for o in bpy.data.objects],
        "motion": motion,
        "meshes": [{"name": o.name, "vertices": len(o.data.vertices),
                    "armature": o.find_armature().name if o.find_armature() else None}
                   for o in meshes],
        "rigs": [{"name": o.name, "bones": len(o.data.bones),
                  "rest": {b.name: {"parent": b.parent.name if b.parent else None,
                                     "matrix": [list(row) for row in b.matrix_local],
                                     "local_matrix": [list(row) for row in
                                         (b.parent.matrix_local.inverted() @ b.matrix_local
                                          if b.parent else b.matrix_local)],
                                     "length": b.length} for b in o.data.bones}}
                 for o in rigs],
        "actions": [{"name": a.name, "range": list(a.frame_range),
                     "duration_seconds": (a.frame_range[1] - a.frame_range[0]) / (scene.render.fps / scene.render.fps_base),
                     "channels": [{"path": c.data_path, "index": c.array_index,
                                   "keys": len(c.keyframe_points),
                                   "min": min((p.co.y for p in c.keyframe_points), default=None),
                                   "max": max((p.co.y for p in c.keyframe_points), default=None)} for c in curves(a)],
                     "bones_without_rotation": [b.name for rig in rigs for b in rig.data.bones
                          if not any(c.data_path.startswith('pose.bones["' + b.name + '"].rotation_') for c in curves(a))],
                     "bones_without_rotation_keys": [b.name for rig in rigs for b in rig.data.bones
                          if not any(c.data_path.startswith('pose.bones["' + b.name + '"].rotation_') and len(c.keyframe_points) for c in curves(a))],
                     "nonterminal_bones_without_rotation_keys": [b.name for rig in rigs for b in rig.data.bones
                          if b.children and not any(c.data_path.startswith('pose.bones["' + b.name + '"].rotation_') and len(c.keyframe_points) for c in curves(a))],
                     "unexpected_channels": [c.data_path for c in curves(a)
                          if not re.match(r'^pose\.bones\["[^\"]+"\]\.(location|rotation_euler|rotation_quaternion|scale)$', c.data_path)]}
                    for a in bpy.data.actions],
    }
out = root / "asset-source" / "runner" / "intake.json"
out.write_text(json.dumps(report, indent=2))
print("RUNNER_INTAKE " + json.dumps({k: {"meshes": v["meshes"],
    "rigs": [{"name": r["name"], "bones": r["bones"]} for r in v["rigs"]],
    "actions": [{"name": a['name'], "range": a['range'], "duration_seconds": a['duration_seconds'],
                 "channels": len(a['channels']), "unkeyed_rotation_bones": a['bones_without_rotation_keys'],
                 "unexpected_channels": a['unexpected_channels']} for a in v['actions']]}
    for k, v in report["files"].items()}))
