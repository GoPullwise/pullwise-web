import { describe, expect, it } from "vitest";
import {
  PROJECT_URL_MAX_BYTES,
  githubOrganizationHref,
  githubRepositoryHref,
  normalizeProjectUrl,
  projectUrlHref,
} from "./project-links.js";

describe("project URLs", () => {
  it.each([null, undefined, "", "   "])("normalizes absent input %s to null", (value) => {
    expect(normalizeProjectUrl(value)).toBeNull();
    expect(projectUrlHref(value)).toBeNull();
  });

  it.each([
    [" example.com ", "https://example.com/"],
    ["example.com/docs?view=costs#overview", "https://example.com/docs?view=costs#overview"],
    ["example.com:8443/docs", "https://example.com:8443/docs"],
    ["localhost:3000", "https://localhost:3000/"],
    ["192.168.1.20:8080", "https://192.168.1.20:8080/"],
    ["[::1]:3000/tools", "https://[::1]:3000/tools"],
    ["例子.测试/项目", "https://xn--fsqu00a.xn--0zwm56d/%E9%A1%B9%E7%9B%AE"],
    ["HTTP://LOCALHOST:80/dashboard", "http://localhost/dashboard"],
    ["http://intranet:8080/report", "http://intranet:8080/report"],
    ["http://10.0.0.8/report", "http://10.0.0.8/report"],
    ["https://[2001:db8::1]:8443/report", "https://[2001:db8::1]:8443/report"],
    ["https://例子.测试/项目", "https://xn--fsqu00a.xn--0zwm56d/%E9%A1%B9%E7%9B%AE"],
    [
      "https://example.com/a/../b?email=person@example.com",
      "https://example.com/b?email=person@example.com",
    ],
  ])("normalizes permitted address %s", (value, expected) => {
    expect(normalizeProjectUrl(value)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "ftp://example.com/report",
    "custom:3000",
    "http:example.com",
    "https:/example.com",
    "//example.com/report",
    "https:///example.com",
    "https://user:secret@example.com",
    "https://@example.com",
    "https://:secret@example.com",
    "user@example.com",
    "https://example.com\\evil",
    "https://example.com/a b",
    "https://example.com/\u00a0hidden",
    "\nhttps://example.com",
    "https://example.com\r",
    "https://example.com/\u0000hidden",
    "https://example.com/\u007fhidden",
    "https://example.com/\u0085hidden",
    "https://example.com/\u009fhidden",
    "https://exa mple.com",
    "https://example.com:65536",
    "https://example.com:abc",
    "https://[not-an-ipv6]/",
    "https://256.1.1.1",
    "https://",
    "/relative/path",
    42,
    {},
  ])("rejects invalid or unsafe input %s", (value) => {
    expect(() => normalizeProjectUrl(value)).toThrow("Invalid project URL.");
    expect(projectUrlHref(value)).toBeNull();
  });

  it("rejects raw controls before URL parsing or trimming can discard them", () => {
    for (const code of [
      ...Array(32).keys(),
      ...Array.from({ length: 33 }, (_, index) => 127 + index),
    ]) {
      const control = String.fromCharCode(code);
      for (const value of [`${control}https://example.com`, `https://example.com/a${control}b`]) {
        expect(() => normalizeProjectUrl(value), `control ${code}`).toThrow("Invalid project URL.");
        expect(projectUrlHref(value), `control ${code}`).toBeNull();
      }
    }
  });

  it("bounds the normalized URL by UTF-8 bytes, including added scheme and escaped Unicode", () => {
    const prefix = "https://example.com/";
    const exact = `${prefix}${"a".repeat(PROJECT_URL_MAX_BYTES - prefix.length)}`;
    expect(new TextEncoder().encode(exact).length).toBe(PROJECT_URL_MAX_BYTES);
    expect(normalizeProjectUrl(exact)).toBe(exact);
    expect(() => normalizeProjectUrl(`${exact}a`)).toThrow("Invalid project URL.");
    expect(() => normalizeProjectUrl(exact.slice("https://".length) + "a")).toThrow(
      "Invalid project URL."
    );

    const unicode = `${prefix}${"界".repeat(675)}`;
    expect(new TextEncoder().encode(unicode).length).toBeLessThan(PROJECT_URL_MAX_BYTES);
    expect(() => normalizeProjectUrl(unicode)).toThrow("Invalid project URL.");
    expect(projectUrlHref(unicode)).toBeNull();
  });

  it("only exposes existing absolute HTTP(S) DTO values as links", () => {
    expect(projectUrlHref(" HTTP://EXAMPLE.COM:80/a ")).toBe("http://example.com/a");
    expect(projectUrlHref("https://localhost:3000/report")).toBe("https://localhost:3000/report");
    expect(projectUrlHref("example.com")).toBeNull();
    expect(projectUrlHref("localhost:3000")).toBeNull();
  });
});

describe("GitHub association links", () => {
  it("links authorized repositories individually while preserving legal name characters", () => {
    const repositories = [
      { githubAccess: "authorized", githubFullName: "Pullwise-Team/Cost_Ledger.v2-test" },
      { githubAccess: "lost", githubFullName: "Pullwise-Team/private" },
      { githubAccess: "authorized", githubFullName: "other-team/visible" },
    ];
    expect(repositories.map(githubRepositoryHref)).toEqual([
      "https://github.com/Pullwise-Team/Cost_Ledger.v2-test",
      null,
      "https://github.com/other-team/visible",
    ]);
  });

  it.each([undefined, "partial", "lost", "unavailable", "reauthorization_required", "not_linked"])(
    "never links repository or organization metadata with access %s",
    (githubAccess) => {
      expect(githubRepositoryHref({ githubAccess, githubFullName: "team/project" })).toBeNull();
      expect(githubOrganizationHref({ githubAccess, login: "team" })).toBeNull();
    }
  );

  it.each([
    "",
    "team",
    "/project",
    "team/",
    "team/project/extra",
    "team/.",
    "team/..",
    "../project",
    "team/project?tab=readme",
    "team/project#readme",
    "team\\project",
    "team/ project",
    "team/project ",
    "team/project\n",
    "team/project\u007f",
    "team/project\u009f",
    "team/project%2Fextra",
    "team/project@evil.example",
    "team_with_underscore/project",
    "team.with.dot/project",
    "-team/project",
    "team-/project",
    "team--name/project",
    `${"a".repeat(40)}/project`,
    `team/${"a".repeat(101)}`,
  ])("omits malformed authorized repository metadata %s", (githubFullName) => {
    expect(githubRepositoryHref({ githubAccess: "authorized", githubFullName })).toBeNull();
  });

  it("does not infer links from project caches, identifiers or absent metadata", () => {
    expect(githubRepositoryHref(null)).toBeNull();
    expect(githubRepositoryHref({ githubAccess: "authorized", githubRepoId: 123 })).toBeNull();
    expect(githubRepositoryHref({ githubAccess: "authorized", githubFullName: 123 })).toBeNull();
    expect(githubOrganizationHref(null)).toBeNull();
    expect(githubOrganizationHref({ githubAccess: "authorized", id: 123 })).toBeNull();
    expect(githubOrganizationHref({ githubAccess: "authorized", login: 123 })).toBeNull();
  });

  it("accepts exact GitHub login and repository length bounds", () => {
    const owner = "a".repeat(39);
    const repository = "r".repeat(100);
    expect(
      githubRepositoryHref({ githubAccess: "authorized", githubFullName: `${owner}/${repository}` })
    ).toBe(`https://github.com/${owner}/${repository}`);
    expect(githubOrganizationHref({ githubAccess: "authorized", login: owner })).toBe(
      `https://github.com/${owner}`
    );
    expect(githubOrganizationHref({ githubAccess: "authorized", login: "Pullwise-Team" })).toBe(
      "https://github.com/Pullwise-Team"
    );
  });

  it.each([
    "",
    " team",
    "team ",
    "team/name",
    ".",
    "..",
    "team?tab=repositories",
    "team#about",
    "team\\name",
    "team\n",
    "team\u0000",
    "team\u007f",
    "team\u009f",
    "team_name",
    "team.name",
    "-team",
    "team-",
    "team--name",
    "a".repeat(40),
  ])("omits malformed authorized organization login %s", (login) => {
    expect(githubOrganizationHref({ githubAccess: "authorized", login })).toBeNull();
  });
});
