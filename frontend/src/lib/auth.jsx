import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setWorkspaceId, getWorkspaceId } from "@/lib/api";

const Ctx = createContext(null);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

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

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async () => {
    if (!GOOGLE_CLIENT_ID) {
      alert("Falta VITE_GOOGLE_CLIENT_ID");
      return;
    }

    await loadGoogleScript();

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          await api.post("/auth/google", {
            credential: response.credential,
          });
          await checkAuth();
          window.location.href = "/dashboard";
        } catch (err) {
          console.error(err);
          alert("No se pudo iniciar sesión con Google");
        }
      },
    });

    window.google.accounts.id.prompt();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      // ignore
    }
    setUser(null);
    setWorkspaceId(null);
    window.location.href = "/";
  };

  const switchWorkspace = (ws) => {
    setActiveWs(ws);
    setWorkspaceId(ws.id);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        setUser,
        workspaces,
        activeWs,
        switchWorkspace,
        fetchWorkspaces,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);