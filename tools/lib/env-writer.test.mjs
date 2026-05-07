/**
 * Tests for env-writer.mjs (Node 18+).
 * Run: npm test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEPLOY_BOOTSTRAP_SECTION_HEADER, writeEnvKey } from "./env-writer.mjs";

function makeTmpEnv(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-writer-"));
  const file = path.join(dir, ".env");
  if (initial !== undefined) fs.writeFileSync(file, initial);
  return { dir, file };
}

function frozenClock(iso) {
  return () => new Date(iso);
}

function testAppendWhenFileMissing() {
  const { dir, file } = makeTmpEnv(undefined);
  try {
    const r = writeEnvKey(file, "N8N_WORKFLOW_ID_WF01", "abc123", {
      now: frozenClock("2026-05-07T10:00:00.000Z"),
    });
    assert.equal(r.action, "appended");
    const out = fs.readFileSync(file, "utf8");
    assert.ok(out.includes(DEPLOY_BOOTSTRAP_SECTION_HEADER));
    assert.ok(out.includes("# deploy added N8N_WORKFLOW_ID_WF01 on 2026-05-07T10:00:00.000Z"));
    assert.ok(out.endsWith("N8N_WORKFLOW_ID_WF01=abc123\n"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testAppendWhenFileExistsWithoutKey() {
  const { dir, file } = makeTmpEnv("N8N_BASE_URL=https://example\n");
  try {
    const r = writeEnvKey(file, "N8N_WORKFLOW_ID_WF01", "abc", {
      now: frozenClock("2026-05-07T10:00:00.000Z"),
    });
    assert.equal(r.action, "appended");
    const out = fs.readFileSync(file, "utf8");
    assert.ok(out.startsWith("N8N_BASE_URL=https://example\n"));
    assert.ok(out.includes(DEPLOY_BOOTSTRAP_SECTION_HEADER));
    assert.ok(out.endsWith("N8N_WORKFLOW_ID_WF01=abc\n"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testAppendKeepsSectionUniqueOnSecondAppend() {
  const { dir, file } = makeTmpEnv("N8N_BASE_URL=https://example\n");
  try {
    writeEnvKey(file, "N8N_WORKFLOW_ID_WF01", "abc", {
      now: frozenClock("2026-05-07T10:00:00.000Z"),
    });
    writeEnvKey(file, "N8N_WORKFLOW_ID_WF02", "def", {
      now: frozenClock("2026-05-07T10:00:01.000Z"),
    });
    const out = fs.readFileSync(file, "utf8");
    const matches = out.match(new RegExp(DEPLOY_BOOTSTRAP_SECTION_HEADER, "g"));
    assert.equal(matches?.length || 0, 1, "section header must only appear once");
    assert.ok(out.includes("N8N_WORKFLOW_ID_WF01=abc"));
    assert.ok(out.includes("N8N_WORKFLOW_ID_WF02=def"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testUpdateCommentsExistingLine() {
  const { dir, file } = makeTmpEnv(
    [
      "N8N_BASE_URL=https://example",
      "N8N_WORKFLOW_ID_WF01=old123",
      "OTHER=keep-me",
      "",
    ].join("\n"),
  );
  try {
    const r = writeEnvKey(file, "N8N_WORKFLOW_ID_WF01", "new456", {
      now: frozenClock("2026-05-07T11:30:00.000Z"),
    });
    assert.equal(r.action, "updated");
    assert.equal(r.previousValue, "old123");
    const out = fs.readFileSync(file, "utf8");
    const lines = out.split("\n");
    assert.equal(lines[0], "N8N_BASE_URL=https://example");
    assert.equal(lines[1], "# N8N_WORKFLOW_ID_WF01=old123");
    assert.match(lines[2], /^# deploy updated N8N_WORKFLOW_ID_WF01 on 2026-05-07T11:30:00\.000Z/);
    assert.equal(lines[3], "N8N_WORKFLOW_ID_WF01=new456");
    assert.equal(lines[4], "OTHER=keep-me");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testNoopWhenValueUnchanged() {
  const initial = ["N8N_WORKFLOW_ID_WF01=keep", ""].join("\n");
  const { dir, file } = makeTmpEnv(initial);
  try {
    const r = writeEnvKey(file, "N8N_WORKFLOW_ID_WF01", "keep");
    assert.equal(r.action, "noop");
    assert.equal(fs.readFileSync(file, "utf8"), initial);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testCommentedLineIgnored() {
  const { dir, file } = makeTmpEnv(
    ["# N8N_WORKFLOW_ID_WF01=ghost", "OTHER=keep", ""].join("\n"),
  );
  try {
    const r = writeEnvKey(file, "N8N_WORKFLOW_ID_WF01", "real", {
      now: frozenClock("2026-05-07T12:00:00.000Z"),
    });
    assert.equal(r.action, "appended");
    const out = fs.readFileSync(file, "utf8");
    assert.ok(out.includes("# N8N_WORKFLOW_ID_WF01=ghost"));
    assert.ok(out.includes(DEPLOY_BOOTSTRAP_SECTION_HEADER));
    assert.ok(out.includes("N8N_WORKFLOW_ID_WF01=real"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testCrlfPreservation() {
  const { dir, file } = makeTmpEnv("A=1\r\nN8N_WORKFLOW_ID_WF01=old\r\nB=2\r\n");
  try {
    writeEnvKey(file, "N8N_WORKFLOW_ID_WF01", "new", {
      now: frozenClock("2026-05-07T12:00:00.000Z"),
    });
    const out = fs.readFileSync(file, "utf8");
    assert.ok(out.includes("\r\n"));
    assert.ok(!/[^\r]\n/.test(out), "no bare LF should be present in CRLF file");
    assert.ok(out.includes("# N8N_WORKFLOW_ID_WF01=old\r\n"));
    assert.ok(out.includes("N8N_WORKFLOW_ID_WF01=new\r\n"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testInvalidKeyRejected() {
  const { dir, file } = makeTmpEnv("");
  try {
    assert.throws(() => writeEnvKey(file, "lowercase", "x"));
    assert.throws(() => writeEnvKey(file, "WITH SPACE", "x"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testValueWithoutNewline() {
  const { dir, file } = makeTmpEnv("");
  try {
    assert.throws(() => writeEnvKey(file, "K", "a\nb"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

testAppendWhenFileMissing();
testAppendWhenFileExistsWithoutKey();
testAppendKeepsSectionUniqueOnSecondAppend();
testUpdateCommentsExistingLine();
testNoopWhenValueUnchanged();
testCommentedLineIgnored();
testCrlfPreservation();
testInvalidKeyRejected();
testValueWithoutNewline();
console.log("env-writer.test.mjs: OK");
