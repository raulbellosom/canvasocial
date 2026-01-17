import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // const [loading, setLoading] = useState(false) // use context loading if desired, or local
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <Card className="w-full max-w-md p-5">
        <h1 className="text-lg font-semibold">Login</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Access your workspaces and canvases.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <div className="text-xs text-[var(--muted)] mb-1">Email</div>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] mb-1">Password</div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>
          {err && <div className="text-sm text-[var(--danger)]">{err}</div>}
          <Button disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-[var(--muted)]">
          No account?{" "}
          <Link className="text-[var(--accent)] hover:underline" to="/register">
            Create one
          </Link>
        </div>
      </Card>
    </div>
  );
}
