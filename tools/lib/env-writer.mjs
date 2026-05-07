/**
 * Helpers to update repository root `.env` from deploy tooling.
 *
 * Behavior of {@link writeEnvKey}:
 * - If the key exists (uncommented `KEY=...`), comment out the existing line and insert a
 *   new `KEY=value` line right below it, prefixed with a timestamped audit comment.
 * - If the key does not exist, append it at end of file under a dedicated section header
 *   (`# --- deploy auto-bootstrap ---`), again with a timestamped comment above the new line.
 * - File line endings (LF or CRLF) are preserved when present; otherwise LF is used.
 * - Idempotent: when the existing value already equals the new value, no write happens.
 */
import fs from "node:fs";

export const DEPLOY_BOOTSTRAP_SECTION_HEADER = "# --- deploy auto-bootstrap ---";

/**
 * @param {string} content
 * @returns {"\r\n" | "\n"}
 */
function detectNewline(content) {
  return /\r\n/.test(content) ? "\r\n" : "\n";
}

/**
 * Find the first uncommented `KEY=...` line in `lines` and return its index along with the
 * trimmed value. Returns `{ index: -1, value: "" }` when no match.
 *
 * @param {string[]} lines
 * @param {string} key
 * @returns {{ index: number; value: string }}
 */
function findActiveKeyLine(lines, key) {
  const prefix = `${key}=`;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#")) continue;
    if (!line.startsWith(prefix)) continue;
    return { index: i, value: line.slice(prefix.length) };
  }
  return { index: -1, value: "" };
}

/**
 * Write or update an env key in `.env`, preserving the rest of the file.
 *
 * @param {string} envPath absolute path to `.env`
 * @param {string} key
 * @param {string} value
 * @param {{ now?: () => Date; section?: string; tool?: string }} [opts]
 *   - `now`: clock injection for tests (default: real `Date`)
 *   - `section`: header used when appending under a fresh section (default: deploy auto-bootstrap)
 *   - `tool`: short label embedded in audit comments (default: "deploy")
 * @returns {{ action: "noop" | "updated" | "appended"; previousValue?: string; envPath: string }}
 */
export function writeEnvKey(envPath, key, value, opts = {}) {
  if (typeof key !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new Error(`writeEnvKey: invalid key "${key}" (expected uppercase identifier)`);
  }
  if (typeof value !== "string") {
    throw new Error("writeEnvKey: value must be a string");
  }
  if (/\r|\n/.test(value)) {
    throw new Error("writeEnvKey: value must not contain newlines");
  }

  const now = (opts.now || (() => new Date()))();
  const timestamp = now.toISOString();
  const section = opts.section || DEPLOY_BOOTSTRAP_SECTION_HEADER;
  const tool = opts.tool || "deploy";

  const exists = fs.existsSync(envPath);
  const content = exists ? fs.readFileSync(envPath, "utf8") : "";
  const newline = detectNewline(content);
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];

  const found = findActiveKeyLine(lines, key);

  if (found.index >= 0) {
    if (found.value === value) {
      return { action: "noop", previousValue: found.value, envPath };
    }
    const updated = [...lines];
    updated[found.index] = `# ${lines[found.index]}`;
    updated.splice(
      found.index + 1,
      0,
      `# ${tool} updated ${key} on ${timestamp} (previous value commented above)`,
      `${key}=${value}`,
    );
    fs.writeFileSync(envPath, updated.join(newline));
    return { action: "updated", previousValue: found.value, envPath };
  }

  let toAppend = "";
  const hasSection = content.includes(section);
  if (!hasSection) {
    if (content.length > 0 && !content.endsWith(newline)) {
      toAppend += newline;
    }
    if (content.length > 0) {
      toAppend += newline;
    }
    toAppend += `${section}${newline}`;
  } else if (content.length > 0 && !content.endsWith(newline)) {
    toAppend += newline;
  }
  toAppend += `# ${tool} added ${key} on ${timestamp}${newline}${key}=${value}${newline}`;
  fs.writeFileSync(envPath, content + toAppend);
  return { action: "appended", envPath };
}
