# Yalla1 — Great Place to Work map integration

This package contains the additional **Great Place to Work** map and its required image tilesets/assets.

## What's included
- `great-place-to-work.tmj` — Tiled map (79 × 92 tiles, 32 × 32 px per tile).
- `map.png` — preview image.
- `map.wam` — map metadata, updated to point at the local map file.
- `src/assets/` and `src/animations/` — image assets referenced by the map.
- License files from the source map package.

## Add it to the existing Yalla1 repository
1. Download and extract this ZIP.
2. Copy `great-place-to-work.tmj`, `map.png`, `map.wam`, `src/assets/`, and `src/animations/` into the root of the existing Yalla1 repository. Merge folders rather than replacing existing files.
3. Commit and push the files to GitHub.
4. Open the repository's WorkAdventure map publishing workflow and publish `great-place-to-work.tmj` using the same map-hosting method already configured for Yalla1.

## Important
This is a map/assets integration package, not a deployed live multiplayer server. The existing Yalla1 maps are not overwritten. A public play URL is available only after the map is published through the project's configured WorkAdventure hosting/storage. Keep any existing files with the same names; compare them before merging.
