const BASE = ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL);

export function getToken() {
  return localStorage.getItem("bn_token") || "";
}

export function setToken(token: string) {
  localStorage.setItem("bn_token", token);
}

export async function api(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers ?? {}) as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const DEV = Boolean(((import.meta as unknown) as { env?: { DEV?: boolean } }).env?.DEV);
  if (DEV) {
    // minimal runtime diagnostics for debugging auth-related loading failures
    console.debug("API", {
      url: `${BASE}${path}`,
      hasToken: Boolean(token),
      method: (opts.method || "GET"),
    });
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let text = "";
    try {
      text = await res.text();
    } catch (e) {
      text = "";
    }
    try {
      const json = text ? JSON.parse(text) : null;
      if (json && typeof json.message === "string") {
        message = json.message;
      } else if (text) {
        message = text;
      }
    } catch (e) {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}
