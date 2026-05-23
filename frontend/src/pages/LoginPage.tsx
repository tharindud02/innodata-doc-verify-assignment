import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { FileCheck2 } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("demo@meridianbay.test");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await login(email, password);
      nav("/");
    } catch (e: any) {
      setErr(e.response?.data?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <FileCheck2 className="h-6 w-6 text-brand-600" />
          <h1 className="text-xl font-semibold">DocVerify</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            disabled={loading}
            className="w-full rounded-md bg-brand-600 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          No account?{" "}
          <Link to="/signup" className="text-brand-600 hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-3 rounded-md bg-slate-50 p-2 text-center text-xs text-slate-500">
          Demo: demo@meridianbay.test / demo1234
        </p>
      </div>
    </div>
  );
}