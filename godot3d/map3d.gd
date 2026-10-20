extends Node3D

# Native Godot 4 renderer for the ORIGINAL great-place-to-work.tmj.
# It reads the existing Tiled map and tileset images in the repository;
# it does not generate or replace the TMJ map.
const MAP_PATH := "res://great-place-to-work.tmj"
const TILE := 32.0
const HEIGHT := 1.25
const WALL_HEIGHT := 2.6
const TILE_GID_MASK := 0x1fffffff

var map_data: Dictionary
var tilesets: Array[Dictionary] = []
var textures: Dictionary = {}
var blocked: Dictionary = {}
var player: CharacterBody3D
var camera_pivot: Node3D
var move_speed := 140.0

func _ready() -> void:
    _load_original_map()
    _build_world()
    _make_player()
    _make_camera()
    _make_lighting()

func _load_original_map() -> void:
    var file := FileAccess.open(MAP_PATH, FileAccess.READ)
    if file == null:
        push_error("Could not open original map: " + MAP_PATH)
        return
    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("Original TMJ is not valid JSON")
        return
    map_data = parsed
    tilesets = map_data.get("tilesets", [])
    tilesets.sort_custom(func(a, b): return int(a.get("firstgid", 0)) < int(b.get("firstgid", 0)))
    for ts in tilesets:
        var image_path := str(ts.get("image", ""))
        if image_path.begins_with("./"):
            image_path = image_path.substr(2)
        var absolute_path := ProjectSettings.globalize_path("res://" + image_path)
        var image := Image.new()
        if image.load(absolute_path) == OK:
            textures[int(ts.get("firstgid", 0))] = ImageTexture.create_from_image(image)
        else:
            push_warning("Tileset image not found: " + absolute_path)

func _build_world() -> void:
    var width := int(map_data.get("width", 79))
    var height := int(map_data.get("height", 92))
    var ground := MeshInstance3D.new()
    var ground_mesh := PlaneMesh.new()
    ground_mesh.size = Vector2(width * TILE, height * TILE)
    ground.mesh = ground_mesh
    ground.position = Vector3(width * TILE * 0.5, -0.2, height * TILE * 0.5)
    var ground_mat := StandardMaterial3D.new()
    ground_mat.albedo_color = Color("#78966b")
    ground_mat.roughness = 1.0
    ground.material_override = ground_mat
    add_child(ground)

    var layers: Array = map_data.get("layers", [])
    _build_layers(layers, "")
    _build_collision(layers)

func _build_layers(layers: Array, parent_name: String) -> void:
    for layer in layers:
        var name := str(layer.get("name", ""))
        var full_name := (parent_name + "/" + name).trim_prefix("/")
        if layer.get("type", "") == "group":
            _build_layers(layer.get("layers", []), full_name)
        elif layer.get("type", "") == "tilelayer" and layer.has("data"):
            _build_tile_layer(layer, full_name)

func _build_tile_layer(layer: Dictionary, full_name: String) -> void:
    var width := int(layer.get("width", map_data.get("width", 79)))
    var data: Array = layer.get("data", [])
    var is_wall := full_name.to_lower().contains("wall")
    var layer_height := WALL_HEIGHT if is_wall else 0.02
    var by_tileset: Dictionary = {}
    for i in range(data.size()):
        var raw_gid := int(data[i])
        var gid := raw_gid & TILE_GID_MASK
        if gid == 0:
            continue
        var ts = _tileset_for(gid)
        if ts.is_empty():
            continue
        var first := int(ts.get("firstgid", 0))
        if not by_tileset.has(first):
            by_tileset[first] = []
        var x := float(i % width) * TILE
        var z := float(i / width) * TILE
        _append_tile(by_tileset[first], x, z, gid, ts, is_wall, layer_height, raw_gid)
    for first in by_tileset:
        if not textures.has(first):
            continue
        var arrays := []
        arrays.resize(Mesh.ARRAY_MAX)
        arrays[Mesh.ARRAY_VERTEX] = PackedVector3Array(by_tileset[first].vertices)
        arrays[Mesh.ARRAY_TEX_UV] = PackedVector2Array(by_tileset[first].uvs)
        arrays[Mesh.ARRAY_INDEX] = PackedInt32Array(by_tileset[first].indices)
        var mesh := ArrayMesh.new()
        mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
        var instance := MeshInstance3D.new()
        instance.name = full_name + "_" + str(first)
        instance.mesh = mesh
        var mat := StandardMaterial3D.new()
        mat.albedo_texture = textures[first]
        mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
        mat.roughness = 1.0
        mat.cull_mode = BaseMaterial3D.CULL_DISABLED
        instance.material_override = mat
        add_child(instance)

func _append_tile(bucket: Dictionary, x: float, z: float, gid: int, ts: Dictionary, is_wall: bool, y: float, raw_gid: int) -> void:
    var local_id := gid - int(ts.get("firstgid", 1))
    var cols := int(ts.get("columns", 1))
    var iw := float(ts.get("imagewidth", cols * TILE))
    var ih := float(ts.get("imageheight", TILE))
    var sx := float(local_id % cols) * TILE
    var sy := float(int(local_id / cols)) * TILE
    var u0 := sx / iw
    var u1 := (sx + TILE) / iw
    var v0 := sy / ih
    var v1 := (sy + TILE) / ih
    if (raw_gid & 0x80000000) != 0:
        var swap_u = u0
        u0 = u1
        u1 = swap_u
    if (raw_gid & 0x40000000) != 0:
        var swap_v = v0
        v0 = v1
        v1 = swap_v
    var verts: Array = bucket.get("vertices", [])
    var uvs: Array = bucket.get("uvs", [])
    var indices: Array = bucket.get("indices", [])
    var base := verts.size()
    if is_wall:
        verts.append_array([Vector3(x,y,z), Vector3(x+TILE,y,z), Vector3(x+TILE,y+TILE,z), Vector3(x,y+TILE,z)])
    else:
        verts.append_array([Vector3(x,y,z), Vector3(x+TILE,y,z), Vector3(x+TILE,y,z+TILE), Vector3(x,y,z+TILE)])
    uvs.append_array([Vector2(u0,v1), Vector2(u1,v1), Vector2(u1,v0), Vector2(u0,v0)])
    indices.append_array([base,base+2,base+1,base,base+3,base+2])
    bucket["vertices"] = verts
    bucket["uvs"] = uvs
    bucket["indices"] = indices

func _tileset_for(gid: int) -> Dictionary:
    var found: Dictionary = {}
    for ts in tilesets:
        if int(ts.get("firstgid", 0)) <= gid:
            found = ts
        else:
            break
    return found

func _build_collision(layers: Array) -> void:
    for layer in layers:
        if layer.get("type", "") == "group":
            _build_collision(layer.get("layers", []))
        elif str(layer.get("name", "")).to_lower() == "collisions" and layer.get("type", "") == "tilelayer":
            var width := int(layer.get("width", map_data.get("width", 79)))
            var data: Array = layer.get("data", [])
            for i in range(data.size()):
                if int(data[i]) == 0:
                    continue
                var body := StaticBody3D.new()
                var shape := CollisionShape3D.new()
                var box := BoxShape3D.new()
                box.size = Vector3(TILE, 28.0, TILE)
                shape.shape = box
                body.position = Vector3((i % width + 0.5) * TILE, 12.0, (int(i / width) + 0.5) * TILE)
                body.add_child(shape)
                add_child(body)

func _make_player() -> void:
    player = CharacterBody3D.new()
    player.name = "Player"
    var body_mesh := MeshInstance3D.new()
    var capsule := CapsuleMesh.new()
    capsule.radius = 8.0
    capsule.height = 24.0
    body_mesh.mesh = capsule
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color("#e6a24b")
    body_mesh.material_override = mat
    body_mesh.position.y = 12.0
    player.add_child(body_mesh)
    var collider := CollisionShape3D.new()
    var shape := CapsuleShape3D.new()
    shape.radius = 8.0
    shape.height = 24.0
    collider.shape = shape
    collider.position.y = 12.0
    player.add_child(collider)
    player.position = Vector3(8 * TILE, 0, 8 * TILE)
    add_child(player)

func _make_camera() -> void:
    camera_pivot = Node3D.new()
    camera_pivot.position = Vector3(0, 0, 0)
    player.add_child(camera_pivot)
    var camera := Camera3D.new()
    camera.position = Vector3(0, 420, 600)
    camera.rotation_degrees = Vector3(-35, 0, 0)
    camera.current = true
    camera_pivot.add_child(camera)

func _make_lighting() -> void:
    var env := WorldEnvironment.new()
    var environment := Environment.new()
    environment.background_mode = Environment.BG_SKY
    environment.sky = Sky.new()
    environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.ambient_light_color = Color("#b9d9e8")
    environment.ambient_light_energy = 0.8
    env.environment = environment
    add_child(env)
    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-55, -30, 0)
    sun.light_energy = 1.5
    sun.shadow_enabled = true
    add_child(sun)

func _physics_process(_delta: float) -> void:
    if player == null:
        return
    var input := Vector2(
        Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
        Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
    )
    if Input.is_key_pressed(KEY_W): input.y -= 1.0
    if Input.is_key_pressed(KEY_S): input.y += 1.0
    if Input.is_key_pressed(KEY_A): input.x -= 1.0
    if Input.is_key_pressed(KEY_D): input.x += 1.0
    input = input.normalized()
    player.velocity.x = input.x * move_speed
    player.velocity.z = input.y * move_speed
    player.velocity.y = 0
    player.move_and_slide()
    if player.position.y < -10:
        player.position.y = 0
