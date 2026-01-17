import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nav = useNavigate();
  const { register } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setIsSubmitting(true);
    try {
      await register(email, password, name);
      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Register failed");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <Card className="w-full max-w-md p-5">
        <h1 className="text-lg font-semibold">Create account</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Get started in seconds.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <div className="text-xs text-[var(--muted)] mb-1">Name</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
            {isSubmitting ? "Creating…" : "Create account"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-[var(--muted)]">
          Have an account?{" "}
          <Link className="text-[var(--accent)] hover:underline" to="/login">
            Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
