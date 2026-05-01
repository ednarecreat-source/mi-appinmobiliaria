import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

let _wsId = null;
export function setWorkspaceId(id) {
  _wsId = id;
  if (id) localStorage.setItem("rct_ws", id);
  else localStorage.removeItem("rct_ws");
}
export function getWorkspaceId() {
  return _wsId || localStorage.getItem("rct_ws") || null;
}
api.interceptors.request.use((config) => {
  const w = getWorkspaceId();
  if (w) config.headers["X-Workspace-Id"] = w;
  return config;
});

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
