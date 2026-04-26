/**
 * Load repository root `.env` into `process.env` for Node tools that call external APIs.
 * Validation-only scripts should not import this module.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRootFromTools = path.join(__dirname, "..");

export function loadRepoDotenv() {
  dotenv.config({ path: path.join(repoRootFromTools, ".env") });
  return repoRootFromTools;
}
