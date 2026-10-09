import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in · Aangan Interiors" };

const ERRORS: Record<string, string> = {
  empty: "Enter the password to continue.",
  wrong: "That password didn't match. Try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? ERRORS.empty : null;

  return (
    <div className="login">
      <div className="orb sage" aria-hidden />
      <div className="orb lav" aria-hidden />
      <div className="orb butter" aria-hidden />

      <main className="login-card">
        <div className="login-brand">
          <img src="/aangan-logo.png" alt="Aangan Interiors" width={170} height={120} />
          <span className="brand-pill">Phone agent</span>
        </div>
        <div>
          <h1>Welcome back</h1>
          <p className="lede">Every call to the studio, in one place.</p>
        </div>
        <form method="post" action="/api/login">
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              placeholder="Studio dashboard password"
              autoComplete="current-password"
              autoFocus
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? "login-error" : undefined}
            />
          </label>
          {message && (
            <span className="error" id="login-error" role="alert">
              {message}
            </span>
          )}
          <button type="submit">Sign in</button>
        </form>
        <p className="foot">Front desk 10am–7pm · Pune city &amp; PCMC</p>
      </main>
    </div>
  );
}
