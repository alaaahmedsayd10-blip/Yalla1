# Yalla Original Map — native 3D renderer

This native C++/raylib renderer reads the exact root `great-place-to-work.tmj` and its existing tileset images in place. It does not use HTML or Godot and does not generate a replacement map.

## Build (desktop)

Install CMake, a C++17 compiler, and raylib's platform dependencies. From the repository root:

```sh
cmake -S engine3d -B engine3d/build -DCMAKE_BUILD_TYPE=Release
cmake --build engine3d/build --config Release
./engine3d/build/yalla-map3d .
```

On Windows, run the generated `yalla-map3d.exe` from the repository root.

## Controls

- WASD / arrow keys: move
- Mouse: orbit the 3D camera
- Mouse wheel: zoom
- Escape: exit

## Map fidelity

The original TMJ remains the source of truth. The renderer reads map dimensions, GIDs, group/layer order, tile flips, existing tileset image paths, and the collision layer. Floor layers render as horizontal surfaces; layers named `Wall` render as upright surfaces; the player and camera move in 3D space. Artwork remains the original 2D tile art, mapped onto 3D surfaces rather than replaced with newly modeled 3D assets. A build/runtime test is still required on a desktop with CMake and raylib dependencies installed.
