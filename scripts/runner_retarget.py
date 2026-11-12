"""Shared canonical-rig rest correction and action bake."""
import bpy
from mathutils import Matrix, Vector

def bake_action(rig, name, source):
    scene = bpy.context.scene
    target_rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    order = sorted(rig.data.bones, key=lambda b: len(b.parent_recursive))
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    previous = {}
    max_position_error = max_angle_error = max_local_translation = 0
    expected_samples = []
    for frame, poses in enumerate(source['poses'], start=1):
        scene.frame_set(frame)
        desired = {}
        for bone in order:
            n = bone.name
            rest_s, pose_s = source['rest'][n], poses[n]
            # Transfer the armature-space rest-relative rotation, then reconstruct
            # target heads from canonical parent lengths. This is a rest correction,
            # not name-only action reassignment or source inverse-bind transplantation.
            q = pose_s.to_quaternion() @ rest_s.to_quaternion().inverted() @ target_rest[n].to_quaternion()
            if bone.parent:
                parent = bone.parent.name
                source_local = poses[parent].inverted() @ pose_s
                source_local_rest = source['rest'][parent].inverted() @ rest_s
                delta = source_local.translation - source_local_rest.translation
                max_local_translation = max(max_local_translation, delta.length)
                # Translate in equivalent rest-parent axes (metres).
                mapped = target_rest[parent].to_quaternion().inverted() @ (source['rest'][parent].to_quaternion() @ delta)
                target_local = (target_rest[parent].inverted() @ target_rest[n]).translation + mapped
                position = desired[parent] @ target_local
            else:
                position = target_rest[n].translation + pose_s.translation - rest_s.translation
            desired[n] = Matrix.LocRotScale(position, q, Vector((1, 1, 1)))
            kwargs = {'parent_matrix': desired[bone.parent.name], 'parent_matrix_local': target_rest[bone.parent.name]} if bone.parent else {}
            basis = bone.convert_local_to_pose(desired[n], target_rest[n], invert=True, **kwargs)
            p, rotation, s = basis.decompose()
            assert max(abs(v-1) for v in s) < 1e-4, 'Unexpected animated scale'
            if n in previous and rotation.dot(previous[n]) < 0:
                rotation.negate()
            previous[n] = rotation.copy()
            pb = rig.pose.bones[n]
            pb.rotation_mode = 'QUATERNION'
            pb.location, pb.rotation_quaternion, pb.scale = p, rotation, (1, 1, 1)
            pb.keyframe_insert('location', frame=frame, group=n)
            pb.keyframe_insert('rotation_quaternion', frame=frame, group=n)
        bpy.context.view_layer.update()
        for n, expected in desired.items():
            actual = rig.pose.bones[n].matrix
            max_position_error = max(max_position_error, (actual.translation-expected.translation).length)
            # Quaternion dot avoids acos precision amplification near identity.
            max_angle_error = max(max_angle_error, 1-abs(actual.to_quaternion().dot(expected.to_quaternion())))
        expected_samples.append({n: [list(row) for row in m] for n, m in desired.items()})
    assert max_local_translation < .001, 'Source has substantial non-root translation; investigate mapping'
    assert max_position_error < .0001 and max_angle_error < .00001, 'Retarget bake does not reproduce intended matrices'
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for key in fc.keyframe_points:
                        key.interpolation = 'LINEAR'
    action.use_fake_user = True
    return action, expected_samples, (max_position_error, max_angle_error, max_local_translation)
