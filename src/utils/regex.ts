/** Escapes user input so it can be embedded in a RegExp as literal text. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
