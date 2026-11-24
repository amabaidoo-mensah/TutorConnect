export function isTutorVerificationActive(
  status: string,
  premiumUntil: string | null,
  now: number = Date.now(),
): boolean {
  return status === "approved"
    && premiumUntil !== null
    && Date.parse(premiumUntil) > now;
}

export function isStudentVerificationActive(
  role: string,
  accountStatus: string,
  hasPaidContactUnlock: boolean,
): boolean {
  return role === "student" && accountStatus === "active" && hasPaidContactUnlock;
}
