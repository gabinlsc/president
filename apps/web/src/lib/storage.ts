/** Storage may be unavailable (private mode, blocked cookies): degrade to memory silently. */
function safe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

const TOKEN_KEY = 'president-token';
const NAME_KEY = 'president-name';

export const storage = {
  token: (): string | null => safe(() => sessionStorage.getItem(TOKEN_KEY), null),
  setToken: (token: string | null): void =>
    safe(
      () =>
        token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY),
      undefined,
    ),
  name: (): string => safe(() => localStorage.getItem(NAME_KEY) ?? '', ''),
  setName: (name: string): void => safe(() => localStorage.setItem(NAME_KEY, name), undefined),
};
