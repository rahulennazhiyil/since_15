/** Short, collision-resistant ids for client-side records and UI elements. */
export function uid(prefix = ''): string {
  const body =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix ? `${prefix}_${body}` : body;
}
