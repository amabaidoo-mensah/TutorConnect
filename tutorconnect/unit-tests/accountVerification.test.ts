import { describe, expect, it } from "vitest";
import { isStudentVerificationActive, isTutorVerificationActive } from "../src/accountVerification";

describe("tutor verification", () => {
  it("requires approval and an unexpired paid plan", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(isTutorVerificationActive("approved", "2026-01-02T00:00:00.000Z", now)).toBe(true);
    expect(isTutorVerificationActive("pending", "2026-01-02T00:00:00.000Z", now)).toBe(false);
    expect(isTutorVerificationActive("approved", "2025-12-31T23:59:59.999Z", now)).toBe(false);
  });

  it("does not grant a badge for missing, invalid, or exactly expired plans", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(isTutorVerificationActive("approved", null, now)).toBe(false);
    expect(isTutorVerificationActive("approved", "not-a-date", now)).toBe(false);
    expect(isTutorVerificationActive("approved", "2026-01-01T00:00:00.000Z", now)).toBe(false);
  });
});

describe("student verification", () => {
  it("requires an active account and a paid contact unlock", () => {
    expect(isStudentVerificationActive("student", "active", true)).toBe(true);
    expect(isStudentVerificationActive("student", "active", false)).toBe(false);
    expect(isStudentVerificationActive("student", "suspended", true)).toBe(false);
    expect(isStudentVerificationActive("tutor", "active", true)).toBe(false);
  });
});
