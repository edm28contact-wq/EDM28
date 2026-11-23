# EDM28 hybrid GT3 asset build

## Inputs and provenance

- Appearance: [Porsche 911 GT3 RS Weissach](https://sketchfab.com/3d-models/porsche-911-gt3-rs-weissach-549c25c48c474274be5373f1f2fe20a8) by **VTDAT23**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Mechanics: [Porsche 911 Gt3 Rs](https://sketchfab.com/3d-models/porsche-911-gt3-rs-73a595bff7d5498fa1891c4a78787d26) by **musiss**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Adaptation by EDM28: assembly, component separation, geometric alignment, web texture/geometry compression and interactive part metadata. The adaptations do not imply endorsement by the original creators or Porsche.
- Red appearance source: `Porsche_GT3RS_MOD.glb` from the supplied Weissach archive.
- Gray mechanics source: `Porsche 911 gt3 rs.blend` from the supplied GT3 RS archive.
- Original input SHA-256 values are recorded in `manifest.json`.
- Red body, wheel geometry, material values, UVs and decals remain from the red source.
- Four red brake discs and four red caliper meshes are replaced with actual gray-source polygons.
- Left/right suspension subsets are extracted from connected source components. No mechanical shapes are generated.
- The gray brake/suspension assemblies receive a uniform fit per axle to the red brake diameters. This is an educational visual hybrid, not manufacturer CAD.
- Both front brake assemblies then receive a uniform factor of **0.980** about their disc axis to clear the red rim barrels. Only discs, calipers and their associated hardware are adjusted; hubs and suspension keep their original fitted positions. No axial translation is applied. Final matrices and pivots are recorded in each wheel's manifest entry.
- Pads are not exposed as a separate part because their identity could not be established reliably. Rear steering joints are likewise not invented.

## Reproduce

Tested with Blender 4.3.2, Python 3.12.14, Pillow 13.0.0 / libwebp 1.6.0, Node 24.22.3, glTF-Transform 4.2.1 and draco3d 1.5.7. Exact tool versions are in `build-versions.json`; Python and Node dependencies are pinned in `requirements.txt` and `deps/package-lock.json`.

Keep `deps/package.json` and `deps/package-lock.json` beside the scripts in the `deps` subdirectory, then install their locked dependencies:

```sh
npm ci --prefix deps --no-audit --no-fund --ignore-scripts
python3 -m pip install -r requirements.txt
```

Pass all source and output paths explicitly. Open the gray BLEND with embedded execution disabled, then run the three scripts sequentially:

```sh
blender --background --factory-startup --disable-autoexec '/path/to/Porsche 911 gt3 rs.blend' --python build_hybrid.py -- --red-source '/path/to/Porsche_GT3RS_MOD.glb' --front-brake-scale 0.980 --output-dir '/path/to/build'
python3 optimize_textures.py --input '/path/to/build/edm28-gt3-hybrid-uncompressed.glb' --output-dir '/path/to/build'
node compress.mjs --input '/path/to/build/edm28-gt3-hybrid-uncompressed.glb' --output '/path/to/build/edm28-gt3-hybrid-v1.glb' --manifest '/path/to/build/manifest.json' --texture-replacements '/path/to/build/texture-replacements.json' --audit '/path/to/build/compression-audit.json'
```

The build saves `edm28-gt3-hybrid.blend`, an uncompressed GLB, the final compressed GLB and `manifest.json`.

## Coordinates and interaction

Final glTF is Y-up, front toward +Z, physical vehicle left at +X. No whole-car reflection is applied; logos and handedness are preserved. Ground is Y=0.13. Final wheel centers and available parts are in `manifest.wheels`.

Thirty identity part groups use names such as `av-gauche__roue` and extras `wheelId` / `partId`. Descendant meshes also carry these tags for picking. Runtime lookup must map the semantic root groups rather than overwrite each root with its tagged descendants.

Each front wheel has roue, etrier, disques, moyeu, triangles, rotules, stabilisation and amortisseur. Each rear wheel has the same set except rotules. Common anti-roll-bar and steering-bar geometry is under `mecanique-fixe`.

## Compression and validation

- The repetitive paint microflake normal map alone is resized 4096² → 512², retaining 16-bit PNG precision and its original UV transform.
- Forty-one 8-bit textures are converted to lossless WebP. Every converted image is decoded and compared byte-for-byte in RGBA against its original. Other appearance maps keep their dimensions and pixels.
- Draco compression uses 16-bit positions, 12-bit normals and 16-bit UVs; no silhouette decimation is used.
- Source transforms with negative determinant are baked with both polygon winding and UV/normal loop order reversed, preserving outward normals on right brake assemblies.
- Final Draco decoding is checked and all 30 semantic groups/extras must survive unchanged.
- Final byte length, SHA-256, required extensions and triangle count are recorded in `manifest.asset` and `compression-audit.json`.

The triangle-count diagnostic can be reproduced without overwriting either asset:

```sh
node audit_triangle_loss.mjs --input '/path/to/build/edm28-gt3-hybrid-uncompressed.glb' --final '/path/to/build/edm28-gt3-hybrid-v1.glb' --report '/path/to/build/triangle-loss-audit.json'
```

The input and post-weld document both contain 817,560 triangles; Draco decodes to 817,548. All twelve omitted faces belong to `EXT_BLACK_MISC_0` and already have exactly zero area because two corner positions coincide. Re-encoding after removing only these twelve zero-area faces yields an exactly identical multiset of decoded triangle attributes for that mesh. The diagnostic records the original positions and this equality check.

The viewer needs support for `KHR_draco_mesh_compression` and `EXT_texture_webp`; no KTX2 decoder is required.
