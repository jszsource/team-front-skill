const KEY = 'access_token';

export function saveToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function readToken() {
  return localStorage.getItem(KEY);
}
