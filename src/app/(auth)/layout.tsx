export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-xl font-semibold tracking-tight">Roundabout</p>
        {children}
      </div>
    </main>
  );
}
