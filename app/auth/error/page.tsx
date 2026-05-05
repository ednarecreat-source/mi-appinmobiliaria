import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Error de autenticacion</h1>
        <p className="text-muted-foreground mb-6">
          Ha ocurrido un error durante el proceso de autenticacion.
        </p>
        <Link 
          href="/auth/login"
          className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Volver a intentar
        </Link>
      </div>
    </div>
  )
}
