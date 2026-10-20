#include "raylib.h"
#include "raymath.h"
#include <nlohmann/json.hpp>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <string>
#include <vector>
using json = nlohmann::json;
namespace fs = std::filesystem;
static constexpr float TILE=32.0f;
static constexpr uint32_t FLIP_H=0x80000000u, FLIP_V=0x40000000u, FLIP_D=0x20000000u, GID_MASK=0x1fffffffu;
struct Tileset { int firstGid=0,columns=1,tileW=32,tileH=32,imageW=0,imageH=0; std::string name,imagePath; Texture2D texture{}; };
struct Quad { Vector3 p[4]; Vector2 uv[4]; };
struct Batch { std::vector<float> vertices,uvs,normals; std::vector<unsigned short> indices; };
struct LayerMesh { Mesh mesh{}; Material material{}; bool valid=false; };
static std::string cleanPath(std::string p){if(p.rfind("./",0)==0)p.erase(0,2);return p;}
static void addQuad(Batch& b,const Quad& q,bool vertical){
 if(b.vertices.size()/3>65530)return; const unsigned short base=(unsigned short)(b.vertices.size()/3);
 for(int i=0;i<4;i++){b.vertices.insert(b.vertices.end(),{q.p[i].x,q.p[i].y,q.p[i].z});b.uvs.insert(b.uvs.end(),{q.uv[i].x,q.uv[i].y});if(vertical)b.normals.insert(b.normals.end(),{0,0,1});else b.normals.insert(b.normals.end(),{0,1,0});}
 b.indices.insert(b.indices.end(),{base,(unsigned short)(base+2),(unsigned short)(base+1),base,(unsigned short)(base+3),(unsigned short)(base+2)});
}
static Mesh uploadBatch(const Batch& b){
 Mesh m{};m.vertexCount=(int)(b.vertices.size()/3);m.triangleCount=(int)(b.indices.size()/3);if(!m.vertexCount)return m;
 m.vertices=(float*)MemAlloc(b.vertices.size()*sizeof(float));m.texcoords=(float*)MemAlloc(b.uvs.size()*sizeof(float));m.normals=(float*)MemAlloc(b.normals.size()*sizeof(float));m.indices=(unsigned short*)MemAlloc(b.indices.size()*sizeof(unsigned short));
 std::copy(b.vertices.begin(),b.vertices.end(),m.vertices);std::copy(b.uvs.begin(),b.uvs.end(),m.texcoords);std::copy(b.normals.begin(),b.normals.end(),m.normals);std::copy(b.indices.begin(),b.indices.end(),m.indices);UploadMesh(&m,false);return m;
}
class OriginalMap3DEngine{
 json map;std::vector<Tileset> tilesets;std::vector<LayerMesh> rendered;std::vector<Vector3> collisionCells,wallBlocks;int mapW=79,mapH=92;
 Camera3D camera{};Vector3 player{8*TILE,12,8*TILE};float yaw=0,pitch=0.78f,cameraDistance=430;bool ok=false;
 int findTileset(uint32_t gid)const{for(int i=(int)tilesets.size()-1;i>=0;i--)if((int)gid>=tilesets[i].firstGid)return i;return -1;}
 void collectLayers(const json& layers,const std::string& parent,bool parentVisible){
  for(const auto& l:layers){const std::string name=l.value("name",std::string(""));const std::string full=parent.empty()?name:parent+"/"+name;const bool visible=parentVisible&&l.value("visible",true);const std::string type=l.value("type",std::string(""));if(!visible)continue;
   if(type=="group"&&l.contains("layers")){collectLayers(l["layers"],full,visible);continue;}if(type!="tilelayer"||!l.contains("data")||!l["data"].is_array())continue;
   const auto& data=l["data"];const int w=l.value("width",mapW),h=l.value("height",mapH);const bool wall=full.find("Wall")!=std::string::npos||full.find("wall")!=std::string::npos;const bool collision=name=="collisions",start=name=="start";std::map<int,Batch> batches;
   for(int idx=0;idx<(int)data.size()&&idx<w*h;idx++){uint32_t raw=0;try{raw=data[idx].get<uint32_t>();}catch(...){continue;}const uint32_t gid=raw&GID_MASK;const int tx=idx%w,ty=idx/w;
    if(collision&&gid)collisionCells.push_back({(tx+.5f)*TILE,0,(ty+.5f)*TILE});if(start&&gid)player={(tx+.5f)*TILE,12,(ty+.5f)*TILE};if(!gid||collision||start)continue;
    if(wall)wallBlocks.push_back({(tx+.5f)*TILE,TILE*.5f,ty*TILE-2.0f});const int ti=findTileset(gid);if(ti<0||!tilesets[ti].texture.id)continue;const auto& ts=tilesets[ti];const int local=(int)gid-ts.firstGid,sx=(local%ts.columns)*ts.tileW,sy=(local/ts.columns)*ts.tileH;
    const float u0=(float)sx/ts.imageW,v0=(float)sy/ts.imageH,u1=(float)(sx+ts.tileW)/ts.imageW,v1=(float)(sy+ts.tileH)/ts.imageH;
    Vector2 uv[4]={{u0,v1},{u1,v1},{u1,v0},{u0,v0}};
    if(raw&FLIP_H){std::swap(uv[0],uv[1]);std::swap(uv[3],uv[2]);}if(raw&FLIP_V){std::swap(uv[0],uv[3]);std::swap(uv[1],uv[2]);}if(raw&FLIP_D){std::swap(uv[0],uv[2]);std::swap(uv[1],uv[3]);}
    Quad q{};const float x=tx*TILE,z=ty*TILE;if(wall){q.p[0]={x,TILE,z};q.p[1]={x+TILE,TILE,z};q.p[2]={x+TILE,0,z};q.p[3]={x,0,z};}else{q.p[0]={x,0,z};q.p[1]={x+TILE,0,z};q.p[2]={x+TILE,0,z+TILE};q.p[3]={x,0,z+TILE};}for(int k=0;k<4;k++)q.uv[k]=uv[k];addQuad(batches[ti],q,wall);
   }
   for(auto& e:batches){LayerMesh lm;lm.mesh=uploadBatch(e.second);lm.material=LoadMaterialDefault();lm.material.maps[MATERIAL_MAP_DIFFUSE].texture=tilesets[e.first].texture;lm.valid=lm.mesh.vertexCount>0;if(lm.valid)rendered.push_back(lm);}
  }
 }
 void updateCamera(){Vector3 off={sinf(yaw)*cosf(pitch)*cameraDistance,sinf(pitch)*cameraDistance,cosf(yaw)*cosf(pitch)*cameraDistance};camera.position=Vector3Add(player,off);camera.target=Vector3Add(player,{0,12,0});camera.up={0,1,0};camera.fovy=55;camera.projection=CAMERA_PERSPECTIVE;}
public:
 bool load(const fs::path& path){if(!fs::exists(path)){std::cerr<<"Original TMJ not found: "<<path<<"\n";return false;}std::ifstream in(path);try{in>>map;}catch(const std::exception&e){std::cerr<<"TMJ parse error: "<<e.what()<<"\n";return false;}
  mapW=map.value("width",79);mapH=map.value("height",92);
  for(const auto& raw:map.value("tilesets",json::array())){Tileset t;t.firstGid=raw.value("firstgid",0);t.name=raw.value("name",std::string(""));t.columns=std::max(1,raw.value("columns",1));t.tileW=raw.value("tilewidth",32);t.tileH=raw.value("tileheight",32);t.imageW=raw.value("imagewidth",0);t.imageH=raw.value("imageheight",0);t.imagePath=cleanPath(raw.value("image",std::string("")));fs::path image=path.parent_path()/t.imagePath;
   if(!fs::exists(image))std::cerr<<"Missing tileset: "<<image<<"\n";else{t.texture=LoadTexture(image.string().c_str());SetTextureFilter(t.texture,TEXTURE_FILTER_POINT);}tilesets.push_back(t);}
  std::sort(tilesets.begin(),tilesets.end(),[](const Tileset&a,const Tileset&b){return a.firstGid<b.firstGid;});if(map.contains("layers"))collectLayers(map["layers"],"",true);ok=!rendered.empty();std::cout<<"Original map "<<mapW<<"x"<<mapH<<" | tilesets "<<tilesets.size()<<" | 3D batches "<<rendered.size()<<"\n";return ok;
 }
 void run(){SetTargetFPS(60);DisableCursor();updateCamera();
  while(!WindowShouldClose()){float dt=GetFrameTime();yaw-=GetMouseDelta().x*.0025f;pitch=Clamp(pitch-GetMouseDelta().y*.0025f,.12f,1.35f);cameraDistance=Clamp(cameraDistance-GetMouseWheelMove()*24,150,1000);
   Vector3 f={-sinf(yaw),0,-cosf(yaw)},r={cosf(yaw),0,-sinf(yaw)},d={0,0,0};if(IsKeyDown(KEY_W)||IsKeyDown(KEY_UP))d=Vector3Add(d,f);if(IsKeyDown(KEY_S)||IsKeyDown(KEY_DOWN))d=Vector3Subtract(d,f);if(IsKeyDown(KEY_D)||IsKeyDown(KEY_RIGHT))d=Vector3Add(d,r);if(IsKeyDown(KEY_A)||IsKeyDown(KEY_LEFT))d=Vector3Subtract(d,r);
   if(Vector3Length(d)>0){d=Vector3Scale(Vector3Normalize(d),120*dt);Vector3 next=Vector3Add(player,d);bool hit=false;for(const auto& c:collisionCells)if(fabsf(next.x-c.x)<TILE*.42f&&fabsf(next.z-c.z)<TILE*.42f){hit=true;break;}if(!hit)player=next;}updateCamera();
   BeginDrawing();ClearBackground(Color{22,29,39,255});BeginMode3D(camera);DrawPlane({mapW*TILE*.5f,-1,(mapH*TILE)*.5f},{mapW*TILE,mapH*TILE},Color{87,116,77,255});for(const auto& b:wallBlocks)DrawCubeV(b,{TILE,TILE,4.0f},Color{78,83,88,255});for(const auto& lm:rendered)if(lm.valid)DrawMesh(lm.mesh,lm.material,MatrixIdentity());DrawCapsule({player.x,2,player.z},{player.x,23,player.z},7,8,8,Color{245,188,70,255});EndMode3D();
   DrawRectangle(12,12,490,70,Color{0,0,0,160});DrawText("YALLA ORIGINAL MAP - NATIVE 3D ENGINE",24,22,18,RAYWHITE);DrawText("WASD/Arrows move | Mouse orbit | Wheel zoom | ESC exit",24,48,13,Color{220,230,235,255});DrawFPS(GetScreenWidth()-90,15);EndDrawing();}
  for(auto& lm:rendered){if(lm.valid)UnloadMesh(lm.mesh);UnloadMaterial(lm.material);}for(auto& t:tilesets)if(t.texture.id)UnloadTexture(t.texture);CloseWindow();
 }
};
int main(int argc,char**argv){SetConfigFlags(FLAG_MSAA_4X_HINT|FLAG_WINDOW_RESIZABLE);InitWindow(1280,800,"YALLA - Original Great Place Map | 3D Engine");fs::path root=argc>1?fs::absolute(argv[1]):fs::current_path();OriginalMap3DEngine e;if(!e.load(root/"great-place-to-work.tmj")){CloseWindow();return 2;}e.run();return 0;}
