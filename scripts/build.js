import { fileURLToPath } from "node:url";
import { buildProject } from "./lib/build.js";

try {
  const root = fileURLToPath(new URL("../", import.meta.url));
  for (const artifact of Object.values(await buildProject(root))) {
    console.log(artifact);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
