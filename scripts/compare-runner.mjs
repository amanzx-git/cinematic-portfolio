import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('asset-source/runner/intake.json', 'utf8'));
const base = report.files.Idle.rigs[0].rest;
const matrixDifference = (a, b) => Math.max(...a.flatMap((row, i) => row.map((v,j) => Math.abs(v-b[i][j]))));
for (const [clip, file] of Object.entries(report.files)) {
  const samples = file.motion.Armature;
  const positions = samples.map(s => s.bones_world['mixamorig:Hips']);
  const first = positions[0], last = positions.at(-1);
  const rotations = samples.map(s => s.hips_rotation['mixamorig:Hips']);
  const q0 = rotations[0];
  const angularDifference = q => 2 * Math.acos(Math.min(1, Math.abs(q.reduce((sum,v,i) => sum+v*q0[i],0)))) * 180 / Math.PI;
  console.log(JSON.stringify({clip, sha256: file.sha256, bytes: file.bytes,
    fps: file.fps, units: file.unit_settings, actions: file.actions.map(a=>({name:a.name,range:a.range,durationSeconds:a.duration_seconds,channels:a.channels?.length,unkeyedRotationBones:a.bones_without_rotation_keys,unexpectedChannels:a.unexpected_channels})),
    armature: file.objects.find(o => o.type === 'ARMATURE'),
    objectMatrixVariation: Math.max(...samples.map(s => matrixDifference(s.object_matrix, samples[0].object_matrix))),
    hipsWorldFirst: first, hipsWorldLast: last,
    hipsWorldNet: last.map((v,i) => v-first[i]),
    hipsWorldExtent: first.map((_,i) => Math.max(...positions.map(p => p[i]))-Math.min(...positions.map(p => p[i]))),
    hipsRotationMaxDegreesFromFirst: Math.max(...rotations.map(angularDifference)),
    rootBones: Object.entries(file.rigs[0].rest).filter(([,b]) => !b.parent).map(([n]) => n),
  }));
}
for (const clip of ['Run', 'Jump', 'Land']) {
  const rest = report.files[clip].rigs[0].rest;
  const missing = Object.keys(base).filter(n => !rest[n]);
  const extra = Object.keys(rest).filter(n => !base[n]);
  const parentDifferences = Object.keys(base).filter(n => rest[n] && base[n].parent !== rest[n].parent);
  console.log(clip, JSON.stringify({missing, extra, parentDifferences}));
  const differences = Object.entries(base).map(([name, bone]) => ({
    name,
    ...(!rest[name] ? {} : {
    lengthDifference: Math.abs(bone.length - rest[name].length),
    rotationDifference: Math.max(...bone.matrix.slice(0, 3).flatMap((row, i) => row.slice(0, 3).map((v, j) => Math.abs(v - rest[name].matrix[i][j])))),
    positionDifference: Math.hypot(...bone.matrix.slice(0, 3).map((row, i) => row[3] - rest[name].matrix[i][3])),
    localDifference: Math.max(...bone.local_matrix.flatMap((row, i) => row.map((v,j) => Math.abs(v-rest[name].local_matrix[i][j])))),
    }),
  }));
  console.log(clip, JSON.stringify(differences.sort((a,b) => b.localDifference-a.localDifference).slice(0, 5)));
}
