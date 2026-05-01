import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Leaf, Sparkles, Building2, Wallet, Globe2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-cream">
      {/* Left side - brand */}
      <div className="lg:w-[55%] relative overflow-hidden p-8 lg:p-16 flex flex-col justify-between">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-sage-200 blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-sage-100 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sage-700 text-white grid place-items-center">
              <Leaf className="w-6 h-6" />
            </div>
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
            Inquilinos, facturas con IA, alquiler vacacional, conciliación bancaria y resúmenes financieros — todo en un solo lugar y compartido con tu familia.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mt-10">
            {[
              { i: Sparkles, t: "IA GPT-4o", d: "Lee tus facturas y reparte" },
              { i: Building2, t: "Multi-cartera", d: "Comparte con familia" },
              { i: Globe2, t: "Multi-divisa", d: "EUR, USD, GBP y +" },
            ].map((f) => (
              <div key={f.t} className="card-soft p-4">
                <f.i className="w-4 h-4 text-sage-700 mb-2" />
                <div className="font-serif font-bold text-sm">{f.t}</div>
                <div className="text-xs text-ink-soft mt-0.5">{f.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-ink-muted mono">v2.0 · Powered by Emergent</div>
      </div>

      {/* Right side - login card */}
      <div className="lg:w-[45%] p-8 lg:p-16 flex items-center justify-center">
        <div className="card-soft p-10 w-full max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-sage-100 grid place-items-center text-sage-700 mb-6">
            <Wallet className="w-7 h-7" />
          </div>
          <h2 className="font-serif font-bold text-3xl tracking-tight">Inicia sesión</h2>
          <p className="text-sm text-ink-soft mt-2">
            Entra con tu cuenta de Google. Tu familia puede entrar con sus propias cuentas y compartir inmuebles contigo.
          </p>

          <Button
            onClick={login}
            className="mt-8 w-full h-12 bg-white border border-border hover:bg-sage-50 text-ink rounded-xl text-sm font-semibold flex items-center justify-center gap-3"
            data-testid="btn-google-login"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            Continuar con Google
          </Button>

          <div className="mt-6 text-xs text-ink-soft text-center leading-relaxed">
            Al continuar aceptas que tus datos se almacenen de forma segura. Cookie de sesión por 7 días.
          </div>
        </div>
      </div>
    </div>
  );
}
