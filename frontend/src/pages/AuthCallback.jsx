import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, fetchWorkspaces } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    const sid = m ? decodeURIComponent(m[1]) : null;
    if (!sid) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id: sid });
        setUser(data);
        await fetchWorkspaces();
        // clear hash
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true });
      } catch (e) {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser, fetchWorkspaces]);

  return (
    <div className="min-h-screen grid place-items-center bg-cream">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-sage-700 mx-auto animate-pulse" />
        <div className="mt-4 text-sm text-ink-soft">Iniciando sesión…</div>
      </div>
    </div>
  );
}
