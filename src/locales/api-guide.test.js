import { describe, expect, it } from "vitest";
import { API_GUIDE_COPY } from "./api-guide.js";

describe("API integration guide translations", () => {
  it("provides every guide paragraph in all supported non-English languages", () => {
    for (const [key, [english, translations]] of Object.entries(API_GUIDE_COPY)) {
      expect(typeof english, key).toBe("string");
      expect(typeof translations, key).toBe("object");
      for (const locale of ["zh", "ja", "ko", "fr", "es"]) {
        expect(typeof translations[locale], `${key}.${locale}`).toBe("string");
        expect(translations[locale].trim().length, `${key}.${locale}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps target permissions, revision headers and account joining distinctions in every language", () => {
    for (const index of [0, "zh", "ja", "ko", "fr", "es"]) {
      const text = (key) => (index === 0 ? API_GUIDE_COPY[key][0] : API_GUIDE_COPY[key][1][index]);
      expect(text("history")).toContain("expenses:read");
      expect(text("history")).toContain("projects:read");
      expect(text("revision")).toContain('If-Match: "7"');
      expect(text("revision")).toContain("412");
      expect(text("revision")).toContain("428");
      expect(text("joining").toLowerCase()).toContain("cookie");
      expect(text("joining")).toContain("GitHub");
      expect(text("pagination")).toContain("hasMore");
      expect(text("pagination")).toContain("nextCursor");
      expect(text("memberKey")).toContain("projectIds");
      expect(text("memberKey")).toContain("members:write");
      expect(text("retentionAccount")).toContain("/api/v1/account/expense-retention");
      expect(text("retentionAccount")).toContain("autoRemoveOldestExpense");
      expect(text("retentionAccount")).toContain("If-Match");
      expect(text("retentionAccount")).toContain("Origin");
      expect(text("retentionAccount")).toContain("Referer");
      expect(text("retentionAuthority")).toContain("403 RETENTION_CLEANUP_REQUIRED");
      expect(text("retentionAuthority")).toContain("403 RETENTION_TARGET_FORBIDDEN");
      expect(text("error403")).toContain("RETENTION_CLEANUP_REQUIRED");
      expect(text("error409")).not.toContain("RETENTION_CLEANUP_REQUIRED");
    }
  });
});
