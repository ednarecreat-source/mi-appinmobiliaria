import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "rct_token";
const WS_KEY = "rct_ws";

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

let _wsId = null;
export function setWorkspaceId(id) {
  _wsId = id;
  if (id) localStorage.setItem(WS_KEY, id);
  else localStorage.removeItem(WS_KEY);
}
export function getWorkspaceId() {
  return _wsId || localStorage.getItem(WS_KEY) || null;
}

export const api = axios.create({ baseURL: API, withCredentials: true });

// Request interceptor → attach Authorization header + workspace id on every call
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const w = getWorkspaceId();
  if (w) config.headers["X-Workspace-Id"] = w;
  return config;
});

// Response interceptor → on 401, clear session and signal app to logout
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    // Skip auto-logout for /auth/me probe (used during initial check)
    if (status === 401 && !url.includes("/auth/me") && !url.includes("/auth/login") && !url.includes("/auth/register") && !url.includes("/auth/google")) {
      setAuthToken(null);
      setWorkspaceId(null);
      if (_onUnauthorized) _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const CURRENCIES = ["EUR", "USD", "GBP", "MXN", "ARS", "COP"];
const SYMBOLS = { EUR: "€", USD: "$", GBP: "£", MXN: "$", ARS: "$", COP: "$" };
const LOCALES = { EUR: "es-ES", USD: "en-US", GBP: "en-GB", MXN: "es-MX", ARS: "es-AR", COP: "es-CO" };

export const eur = (n, cur = "EUR") => {
  try {
    return new Intl.NumberFormat(LOCALES[cur] || "es-ES", { style: "currency", currency: cur }).format(Number(n || 0));
  } catch {
    return `${SYMBOLS[cur] || ""}${Number(n || 0).toFixed(2)}`;
  }
};
