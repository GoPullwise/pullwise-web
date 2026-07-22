import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as contractPackage from "@pullwise/agent-task-contract";

const WEB_ROOT = process.cwd();
const EXPECTED_ARTIFACT_PATH = "vendor/generated/agent-task-contract-npm";
const EXPECTED_DEPENDENCY_SPEC = `file:${EXPECTED_ARTIFACT_PATH}`;
const PIN_PATH = join(WEB_ROOT, "contract-package-pin.json");
const PACKAGE_MANIFEST_PATH = join(WEB_ROOT, "package.json");
const PACKAGE_LOCK_PATH = join(WEB_ROOT, "package-lock.json");

const pin = JSON.parse(readFileSync(PIN_PATH, "utf8"));
const packageManifest = JSON.parse(readFileSync(PACKAGE_MANIFEST_PATH, "utf8"));
const packageLock = JSON.parse(readFileSync(PACKAGE_LOCK_PATH, "utf8"));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])])
    );
  }
  return value;
}

function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonicalValue(value)), "utf8");
}

describe("Server-owned Agent-First contract package pin", () => {
  it("pins the exact generated package tuple", () => {
    expect(pin).toMatchObject({
      package_identity: "@pullwise/agent-task-contract",
      package_version: "0.1.0",
      generated_artifact: {
        path: EXPECTED_ARTIFACT_PATH,
        producer: "pullwise-server",
        generator: "pullwise_server.agent_first_contract_bundle",
      },
    });
    expect(pin.content_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pin.root_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pin.generated_artifact.wrapper_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pin.generated_artifact.package_manifest_sha256).toMatch(/^[0-9a-f]{64}$/);

    expect(contractPackage.PACKAGE_TUPLE).toEqual([
      pin.package_identity,
      pin.package_version,
      pin.content_sha256,
      pin.root_sha256,
    ]);
    expect(contractPackage.PACKAGE_IDENTITY).toBe(pin.package_identity);
    expect(contractPackage.PACKAGE_VERSION).toBe(pin.package_version);
    expect(contractPackage.CONTENT_SHA256).toBe(pin.content_sha256);
    expect(contractPackage.ROOT_SHA256).toBe(pin.root_sha256);
  });

  it("independently recomputes the canonical content and layered root digests", async () => {
    const embeddedBytes = Buffer.from(contractPackage.bundleBytes());
    const document = JSON.parse(embeddedBytes.toString("utf8"));
    const { root_sha256: declaredRootSha256, ...rootWithoutDigest } =
      document.root_manifest;

    expect(embeddedBytes.equals(canonicalBytes(document))).toBe(true);
    expect(sha256(embeddedBytes)).toBe(pin.content_sha256);
    expect(declaredRootSha256).toBe(pin.root_sha256);
    expect(sha256(canonicalBytes(rootWithoutDigest))).toBe(pin.root_sha256);
    expect(document.package_identity).toBe(pin.package_identity);
    expect(document.package_version).toBe(pin.package_version);
    expect(document.root_manifest.package_identity).toBe(pin.package_identity);
    expect(document.root_manifest.package_version).toBe(pin.package_version);

    await expect(contractPackage.verifyBundle()).resolves.toBeDefined();
  });

  it("keeps the installed wrapper byte-identical to the pinned Server-generated artifact", () => {
    const artifactRoot = join(WEB_ROOT, ...pin.generated_artifact.path.split("/"));
    const vendorWrapper = readFileSync(join(artifactRoot, "index.js"));
    const vendorManifest = readFileSync(join(artifactRoot, "package.json"));
    const installedWrapper = readFileSync(
      join(WEB_ROOT, "node_modules", "@pullwise", "agent-task-contract", "index.js")
    );
    const installedManifest = readFileSync(
      join(WEB_ROOT, "node_modules", "@pullwise", "agent-task-contract", "package.json")
    );
    const artifactManifest = JSON.parse(vendorManifest.toString("utf8"));

    expect(installedWrapper.equals(vendorWrapper)).toBe(true);
    expect(installedManifest.equals(vendorManifest)).toBe(true);
    expect(sha256(vendorWrapper)).toBe(pin.generated_artifact.wrapper_sha256);
    expect(sha256(vendorManifest)).toBe(pin.generated_artifact.package_manifest_sha256);
    expect(artifactManifest).toMatchObject({
      name: pin.package_identity,
      version: pin.package_version,
      pullwiseContentSha256: pin.content_sha256,
      pullwiseRootSha256: pin.root_sha256,
    });
  });

  it("locks only the checked-in generated artifact, never a range, tag, workspace, or sibling repo", () => {
    const manifestSpec = packageManifest.devDependencies?.[pin.package_identity];
    const lockRootSpec = packageLock.packages?.[""]?.devDependencies?.[pin.package_identity];
    const installedEntry = packageLock.packages?.[
      "node_modules/@pullwise/agent-task-contract"
    ];
    const artifactEntry = packageLock.packages?.[EXPECTED_ARTIFACT_PATH];

    expect(manifestSpec).toBe(EXPECTED_DEPENDENCY_SPEC);
    expect(lockRootSpec).toBe(EXPECTED_DEPENDENCY_SPEC);
    for (const spec of [manifestSpec, lockRootSpec, installedEntry?.resolved]) {
      expect(spec).not.toMatch(/(?:^|[\\/])\.\.(?:[\\/]|$)/);
      expect(spec).not.toMatch(/^(?:workspace|link|git\+|https?):/);
      expect(spec).not.toMatch(/^(?:latest|next|canary|beta|alpha|\^|~|[<>=*])/);
    }
    expect(installedEntry).toMatchObject({
      resolved: EXPECTED_ARTIFACT_PATH,
      link: true,
    });
    expect(artifactEntry).toMatchObject({
      name: pin.package_identity,
      version: pin.package_version,
    });
  });
});
