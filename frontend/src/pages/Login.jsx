import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaf, Sparkles, Building2, Wallet, Globe2, Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.getElementById("google-gsi")) {
      const check = () => window.google?.accounts?.id ? resolve() : setTimeout(check, 50);
      return check();
    }
    const s = document.createElement("script");
    s.id = "google-gsi";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function Login() {
  const { loginWithEmail, registerWithEmail, loginWithGoogleCredential } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const googleBtnRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/config");
        setGoogleEnabled(!!data.google_enabled);
        setGoogleClientId(data.google_client_id || "");
      } catch (e) {
        // fallback: check env var baked into frontend
        const envId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
        if (envId) { setGoogleEnabled(true); setGoogleClientId(envId); }
      }
    })();
  }, []);

  useEffect(() => {
    if (!googleEnabled || !googleClientId) return;
    let mounted = true;
    (async () => {
      try {
        await loadGoogleScript();
        if (!mounted || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (resp) => {
            try {
              await loginWithGoogleCredential(resp.credential);
              toast.success("Bienvenido");
            } catch (e) {
              toast.error(e?.response?.data?.detail || "Error con Google");
            }
          },
        });
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline", size: "large", width: 360,
          text: mode === "register" ? "signup_with" : "continue_with",
          shape: "pill",
        });
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [googleEnabled, googleClientId, mode, loginWithGoogleCredential]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        if (!name.trim()) return toast.error("Escribe tu nombre");
        if (password.length < 6) return toast.error("La contraseña debe tener 6+ caracteres");
        await registerWithEmail({ name, email, password });
        toast.success("Cuenta creada. ¡Bienvenido!");
      } else {
        await loginWithEmail({ email, password });
        toast.success("Bienvenido");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-cream">
      {/* Left brand */}
      <div className="lg:w-[55%] relative overflow-hidden p-8 lg:p-16 flex flex-col justify-between">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-sage-200 blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-sage-100 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sage-700 text-white grid place-items-center"><Leaf className="w-6 h-6" /></div>
            <div>
              <div className="font-serif font-bold text-xl">RCT</div>
              <div className="text-xs text-ink-soft tracking-wider">Gestión Inmobiliaria</div>
            </div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-sage-600 mb-4">Bienvenido a tu cartera</div>
          <h1 className="font-serif text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            Gestiona tus inmuebles<br />como un <span className="text-sage-700">profesional.</span>
          </h1>
          <p className="text-base text-ink-soft mt-6 leading-relaxed">
            Inquilinos, facturas con IA, alquiler vacacional, conciliación bancaria y resúmenes financieros — todo en un lugar y compartido con tu familia.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 mt-10">
            {[
              { i: Sparkles, t: "IA GPT-4o", d: "Lee tus facturas" },
              { i: Building2, t: "Multi-cartera", d: "Comparte en familia" },
              { i: Globe2, t: "Multi-divisa", d: "EUR, USD, GBP +" },
            ].map((f) => (
              <div key={f.t} className="card-soft p-4">
                <f.i className="w-4 h-4 text-sage-700 mb-2" />
                <div className="font-serif font-bold text-sm">{f.t}</div>
                <div className="text-xs text-ink-soft mt-0.5">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-ink-muted mono">v2.0</div>
      </div>

      {/* Right card */}
      <div className="lg:w-[45%] p-8 lg:p-16 flex items-center justify-center">
        <div className="card-soft p-8 w-full max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-sage-100 grid place-items-center text-sage-700 mb-5">
            <Wallet className="w-7 h-7" />
          </div>
          <h2 className="font-serif font-bold text-3xl tracking-tight">
            {mode === "register" ? "Crea tu cuenta" : "Inicia sesión"}
          </h2>
          <p className="text-sm text-ink-soft mt-2">
            {mode === "register" ? "Con email y contraseña o con Google." : "Entra con email y contraseña, o con Google."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="auth-form">
            {mode === "register" && (
              <div>
                <Label>Nombre</Label>
                <div className="relative mt-1">
                  <User className="w-4 h-4 absolute left-3 top-3.5 text-ink-muted" />
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="pl-9 h-11" data-testid="auth-name" autoComplete="name" />
                </div>
              </div>
            )}
            <div>
              <Label>Email</Label>
              <div className="relative mt-1">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-ink-muted" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" className="pl-9 h-11" data-testid="auth-email" autoComplete="email" />
              </div>
            </div>
            <div>
              <Label>Contraseña</Label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-ink-muted" />
                <Input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="pl-9 pr-10 h-11" data-testid="auth-password" autoComplete={mode === "register" ? "new-password" : "current-password"} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-3 text-ink-muted" tabIndex={-1}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={busy} className="btn-primary w-full h-11 text-sm font-semibold" data-testid="auth-submit">
              {busy ? "..." : mode === "register" ? "Crear cuenta" : "Entrar"}
            </Button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-muted">o</div>
            <div className="h-px flex-1 bg-border" />
          </div>

          {googleEnabled ? (
            <div ref={googleBtnRef} className="mt-5 flex justify-center" data-testid="google-btn" />
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-sage-50/40 p-4 text-xs text-ink-soft text-center">
              Google OAuth no está configurado. Puedes usar email y contraseña o pedir al administrador que añada <code className="mono text-sage-700">GOOGLE_CLIENT_ID</code> en el servidor.
            </div>
          )}

          <div className="mt-6 text-sm text-center text-ink-soft">
            {mode === "register" ? (
              <>¿Ya tienes cuenta?{" "}
                <button onClick={() => setMode("login")} className="text-sage-700 font-semibold hover:underline" data-testid="switch-to-login">Entra</button>
              </>
            ) : (
              <>¿No tienes cuenta?{" "}
                <button onClick={() => setMode("register")} className="text-sage-700 font-semibold hover:underline" data-testid="switch-to-register">Crea una</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
