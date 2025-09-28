export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22)_0,_rgba(10,10,15,0)_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(249,115,22,0.12)_0,_rgba(10,10,15,0)_55%)]" />
      </div>
      <div className="w-full max-w-md px-6 py-12">
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By signing in you agree to the Flix Audio terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
