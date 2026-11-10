# Runner — F2B.1 technical prototype

runner.glb contains the supplied temporary Mixamo mannequin, one canonical 65-joint skin and exactly **Idle**, **Run**, **Jump**, **Land**. Rest-pose correction, skinning, independent playback and export round trip have been checked. No runtime code loads it yet.

**Not the final shadow-runner design or an in-place gameplay-ready handoff.** Source root travel/vertical arcs remain, the mesh is 49,112 triangles, contact/phase/blend editing is outstanding, and provenance rights fields remain unconfirmed. The F2A runtime motion policy is unchanged.

See [VALIDATION.md](./VALIDATION.md) for measured compatibility, export details, scripts, root motion and visual-review limits; [the contract](../../../../docs/CHARACTER_ASSET_CONTRACT.md) for outstanding runtime acceptance; and [ASSETS.md](../../ASSETS.md) for provenance status.

Original FBXs, canonical Blender scene and detailed private evidence stay in ignored asset-source/runner/. Vite serves/copies this public GLB, but no external publication or gameplay integration was performed.
