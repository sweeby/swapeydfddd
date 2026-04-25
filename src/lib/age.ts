/** Minimumleeftijd: app is bedoeld voor 14+. */
export const MIN_AGE = 14

/**
 * Berekent leeftijd in volledige jaren t.o.v. `reference` (geen mutatie).
 */
export function ageFromBirthdate(birth: string, reference = new Date()): number {
  const d = new Date(birth)
  if (Number.isNaN(d.getTime())) return -1
  let age = reference.getFullYear() - d.getFullYear()
  const m = reference.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && reference.getDate() < d.getDate())) age--
  return age
}

export function isAgeEligible(age: number): boolean {
  return age >= MIN_AGE
}
