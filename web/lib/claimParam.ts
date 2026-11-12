/** The claim carried in a page address ("?claim=..."): trimmed and cut to the input's 300 characters, or null. */
export function claimParam(search: string): string | null {
  return new URLSearchParams(search).get("claim")?.trim().slice(0, 300) || null;
}
