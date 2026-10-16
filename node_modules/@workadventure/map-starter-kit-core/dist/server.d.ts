declare module "@workadventure/map-starter-kit-core/dist/server.js" {
  import type { Application } from "express";
  const core: { default: Application; viteNodeApp: Application };
  export default core;
}
