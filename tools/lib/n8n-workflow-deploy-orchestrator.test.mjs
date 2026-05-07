/**
 * Tests for n8n-workflow-deploy-orchestrator.mjs (Node 18+).
 *
 * Verifies bootstrap-or-update branching and `--dry-run` safety:
 * - dry-run + missing env id: no fetch, no .env write
 * - dry-run + present env id: GET only (workflow + credentials), no PUT/POST, no .env write
 * - bootstrap real run: POST + GET + GET creds + PUT, .env written with new id
 * - update real run: GET + GET creds + PUT, .env unchanged
 *
 * Run: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { deployOneWorkflow } from "./n8n-workflow-deploy-orchestrator.mjs";

const ENV_KEY = "N8N_WORKFLOW_ID_WF01";

function makeWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-orchestrator-"));
  const wfDir = path.join(dir, "workflows", "wf01-email-dispatch");
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(
    path.join(wfDir, "workflow.json"),
    `${JSON.stringify(
      { name: "Test WF", nodes: [], connections: {}, settings: {} },
      null,
      2,
    )}\n`,
  );
  return { dir, envPath: path.join(dir, ".env") };
}

function mockJsonResponse(body, init = {}) {
  const text = JSON.stringify(body);
  return {
    ok: init.ok !== false,
    status: init.status || 200,
    json: async () => body,
    text: async () => text,
  };
}

function stubFetch(behavior = {}) {
  const calls = [];
  const created = behavior.createdId || "newid-123";
  /**
   * @param {string} url
   * @param {{ method?: string }} [init]
   */
  const fake = async (url, init = {}) => {
    const method = init.method || "GET";
    const u = String(url);
    calls.push({ url: u, method });
    if (method === "POST" && /\/api\/v1\/workflows$/.test(u)) {
      return mockJsonResponse({ id: created, name: "Test WF" });
    }
    if (method === "GET" && /\/api\/v1\/workflows\/[^/]+$/.test(u)) {
      return mockJsonResponse({
        id: created,
        name: "Test WF",
        nodes: [],
        connections: {},
        active: false,
      });
    }
    if (method === "GET" && /\/api\/v1\/credentials$/.test(u)) {
      return mockJsonResponse({ data: [] });
    }
    if (method === "PUT" && /\/api\/v1\/workflows\/[^/]+$/.test(u)) {
      return mockJsonResponse({
        id: created,
        name: "Test WF",
        updatedAt: "2026-05-07T00:00:00.000Z",
      });
    }
    if (method === "POST" && /\/(activate|deactivate)$/.test(u)) {
      return mockJsonResponse({});
    }
    throw new Error(`Unmocked fetch: ${method} ${u}`);
  };
  return { fake, calls };
}

async function withStubbedFetchAndQuiet(stub, fn) {
  const prevFetch = globalThis.fetch;
  const prevLog = console.log;
  globalThis.fetch = stub.fake;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    globalThis.fetch = prevFetch;
    console.log = prevLog;
  }
}

function withTempEnv(setup, fn) {
  const prev = {};
  for (const k of Object.keys(setup)) {
    prev[k] = process.env[k];
    if (setup[k] === undefined) delete process.env[k];
    else process.env[k] = setup[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

async function testDryRunMissingEnvHasNoSideEffects() {
  const ws = makeWorkspace();
  const stub = stubFetch();
  try {
    await withTempEnv({ [ENV_KEY]: undefined }, async () => {
      await withStubbedFetchAndQuiet(stub, () =>
        deployOneWorkflow(ws.dir, "wf01", {
          base: "https://fake",
          key: "fake",
          dryRun: true,
          skipValidate: true,
          noDeps: true,
        }),
      );
    });
    assert.equal(stub.calls.length, 0, "no fetch should happen on dry-run when env id is missing");
    assert.equal(fs.existsSync(ws.envPath), false, ".env must not be created on dry-run");
    assert.equal(process.env[ENV_KEY], undefined, "process.env must not be mutated on dry-run");
  } finally {
    fs.rmSync(ws.dir, { recursive: true, force: true });
  }
}

async function testDryRunWithEnvIdSkipsPut() {
  const ws = makeWorkspace();
  const stub = stubFetch({ createdId: "existing-999" });
  try {
    await withTempEnv({ [ENV_KEY]: "existing-999" }, async () => {
      await withStubbedFetchAndQuiet(stub, () =>
        deployOneWorkflow(ws.dir, "wf01", {
          base: "https://fake",
          key: "fake",
          dryRun: true,
          skipValidate: true,
          noDeps: true,
        }),
      );
    });
    const methods = stub.calls.map((c) => c.method);
    assert.ok(!methods.includes("PUT"), "no PUT on dry-run");
    assert.ok(!methods.includes("POST"), "no POST on dry-run");
    assert.ok(methods.includes("GET"), "GET still happens (workflow + credentials)");
    assert.equal(fs.existsSync(ws.envPath), false, ".env must not be created on dry-run");
  } finally {
    fs.rmSync(ws.dir, { recursive: true, force: true });
  }
}

async function testBootstrapPostsAndWritesEnv() {
  const ws = makeWorkspace();
  const stub = stubFetch({ createdId: "freshly-minted-id" });
  try {
    await withTempEnv({ [ENV_KEY]: undefined }, async () => {
      await withStubbedFetchAndQuiet(stub, () =>
        deployOneWorkflow(ws.dir, "wf01", {
          base: "https://fake",
          key: "fake",
          dryRun: false,
          skipValidate: true,
          noDeps: true,
        }),
      );
      assert.equal(process.env[ENV_KEY], "freshly-minted-id");
    });
    const methods = stub.calls.map((c) => c.method);
    const postWorkflowCount = stub.calls.filter(
      (c) => c.method === "POST" && /\/api\/v1\/workflows$/.test(c.url),
    ).length;
    const putCount = methods.filter((m) => m === "PUT").length;
    assert.equal(postWorkflowCount, 1, "exactly one POST workflow on bootstrap");
    assert.equal(putCount, 1, "PUT runs after POST to apply credentials/overrides");
    assert.equal(fs.existsSync(ws.envPath), true, ".env must be created after bootstrap");
    const envBody = fs.readFileSync(ws.envPath, "utf8");
    assert.match(envBody, new RegExp(`${ENV_KEY}=freshly-minted-id`));
    assert.match(envBody, /# --- deploy auto-bootstrap ---/);
  } finally {
    fs.rmSync(ws.dir, { recursive: true, force: true });
  }
}

async function testUpdateDoesNotMutateEnv() {
  const ws = makeWorkspace();
  const initialEnv = "OTHER=keep\n";
  fs.writeFileSync(ws.envPath, initialEnv);
  const stub = stubFetch({ createdId: "existing-999" });
  try {
    await withTempEnv({ [ENV_KEY]: "existing-999" }, async () => {
      await withStubbedFetchAndQuiet(stub, () =>
        deployOneWorkflow(ws.dir, "wf01", {
          base: "https://fake",
          key: "fake",
          dryRun: false,
          skipValidate: true,
          noDeps: true,
        }),
      );
    });
    const postWorkflowCount = stub.calls.filter(
      (c) => c.method === "POST" && /\/api\/v1\/workflows$/.test(c.url),
    ).length;
    const putCount = stub.calls.filter((c) => c.method === "PUT").length;
    assert.equal(postWorkflowCount, 0, "no POST when env id is set (update path)");
    assert.equal(putCount, 1, "PUT happens once on update");
    assert.equal(fs.readFileSync(ws.envPath, "utf8"), initialEnv, ".env must remain untouched on update path");
  } finally {
    fs.rmSync(ws.dir, { recursive: true, force: true });
  }
}

async function main() {
  await testDryRunMissingEnvHasNoSideEffects();
  await testDryRunWithEnvIdSkipsPut();
  await testBootstrapPostsAndWritesEnv();
  await testUpdateDoesNotMutateEnv();
  console.log("n8n-workflow-deploy-orchestrator.test.mjs: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
