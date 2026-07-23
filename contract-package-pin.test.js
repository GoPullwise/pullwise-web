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
    const { root_sha256: declaredRootSha256, ...rootWithoutDigest } = document.root_manifest;

    expect(embeddedBytes.equals(canonicalBytes(document))).toBe(true);
    expect(sha256(embeddedBytes)).toBe(pin.content_sha256);
    expect(declaredRootSha256).toBe(pin.root_sha256);
    expect(sha256(canonicalBytes(rootWithoutDigest))).toBe(pin.root_sha256);
    expect(document.package_identity).toBe(pin.package_identity);
    expect(document.package_version).toBe(pin.package_version);
    expect(document.root_manifest.package_identity).toBe(pin.package_identity);
    expect(document.root_manifest.package_version).toBe(pin.package_version);

    await expect(contractPackage.verifyBundle()).resolves.toBeDefined();
  }, 15_000);

  it("imports only the public document projection while retaining internal variants for composition", () => {
    expect(contractPackage).toMatchObject({
      allSchemaIds: expect.any(Function),
      fixture: expect.any(Function),
      schema: expect.any(Function),
      schemaIds: expect.any(Function),
      validateDocument: expect.any(Function),
    });

    const rootRegistry = contractPackage.rootManifest().schema_registry;
    const expectedAllSchemaIds = rootRegistry.map((entry) => entry.schema_id);
    const expectedPublicSchemaIds = rootRegistry
      .filter((entry) => entry.role === "public_document")
      .map((entry) => entry.schema_id);
    const expectedD22PublicSchemaFamilyPairs = [
      ["benchmark-bundle/v1", "benchmark-bundle"],
      ["release-gate-policy/v1", "release-gate-policy"],
      ["release-gate-report/v1", "release-gate-report"],
      ["release-gate-attestation/v1", "release-gate-attestation"],
    ];
    const expectedD22SchemaIds = new Set(
      expectedD22PublicSchemaFamilyPairs.map(([schemaId]) => schemaId)
    );
    const actualD22PublicSchemaFamilyPairs = rootRegistry
      .filter(
        (entry) =>
          entry.role === "public_document" && expectedD22SchemaIds.has(entry.schema_id)
      )
      .map((entry) => [entry.schema_id, entry.family_id]);
    const expectedInternalVariantIds = [
      "task-result-completed-variant/v1",
      "task-result-completed-with-waivers-variant/v1",
      "task-result-no-change-needed-variant/v1",
      "task-result-partial-variant/v1",
      "task-result-blocked-variant/v1",
      "task-result-cancelled-variant/v1",
      "task-result-cancelled-with-effects-variant/v1",
      "task-result-failed-variant/v1",
      "task-result-terminated-with-unknown-effects-variant/v1",
    ];
    const actualInternalVariantIds = rootRegistry
      .filter((entry) => entry.role === "internal_constraint")
      .map((entry) => entry.schema_id);

    expect(contractPackage.allSchemaIds()).toEqual(expectedAllSchemaIds);
    expect(contractPackage.schemaIds()).toEqual(expectedPublicSchemaIds);
    expect(actualD22PublicSchemaFamilyPairs).toEqual(expectedD22PublicSchemaFamilyPairs);
    expect(expectedPublicSchemaIds).toEqual(
      expect.arrayContaining([
        "task-result/v1",
        "task-result-core/v1",
        "worker-debug-file-manifest/v1",
        "worker-debug-redaction-report/v1",
        "worker-debug-fragment/v1",
        "worker-debug-fragment-descriptor/v1",
        "task-result-transport-envelope/v1",
        "task-result-transport-ack/v1",
      ])
    );
    expect(actualInternalVariantIds).toEqual(expectedInternalVariantIds);
    expect(expectedAllSchemaIds).toEqual(expect.arrayContaining(expectedInternalVariantIds));
    expect(expectedPublicSchemaIds).not.toEqual(
      expect.arrayContaining(expectedInternalVariantIds)
    );
    expect(expectedAllSchemaIds.some((schemaId) => schemaId.includes("legacy"))).toBe(false);

    const coreFixture = contractPackage.fixture("task_result_core_golden_completed");
    expect(contractPackage.validateDocument(coreFixture.schema_id, coreFixture.document)).toEqual(
      coreFixture.document
    );

    const internalDocument = contractPackage.fixture(
      "task_result_success_variant_golden_completed"
    ).document;
    let internalConstraintError;
    try {
      contractPackage.validateDocument("task-result-completed-variant/v1", internalDocument);
    } catch (error) {
      internalConstraintError = error;
    }
    expect(internalConstraintError).toMatchObject({
      code: "CONTRACT_DOCUMENT_INVALID",
      detail: "CONTRACT_INTERNAL_CONSTRAINT",
    });
  }, 15_000);

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
    const installedEntry = packageLock.packages?.["node_modules/@pullwise/agent-task-contract"];
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
