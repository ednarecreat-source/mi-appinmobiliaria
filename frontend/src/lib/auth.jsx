import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setWorkspaceId, getWorkspaceId } from "@/lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWs, setActiveWs] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    const { data } = await api.get("/workspaces");
    setWorkspaces(data);
    const stored = getWorkspaceId();
    const found = data.find((w) => w.id === stored) || data[0];
    if (found) {
      setActiveWs(found);
      setWorkspaceId(found.id);
    }
    return data;
  }, []);

  const checkAuth = useCallback(async () => {
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      await fetchWorkspaces();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchWorkspaces]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* ignore */ }
    setUser(null);
    setWorkspaceId(null);
    window.location.href = "/";
  };

  const switchWorkspace = (ws) => {
    setActiveWs(ws);
    setWorkspaceId(ws.id);
  };

  return (
    <Ctx.Provider value={{ user, setUser, workspaces, activeWs, switchWorkspace, fetchWorkspaces, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
