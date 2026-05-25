import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, FileCheck2, Upload } from "lucide-react";

export function TopBar() {
  const { email, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <FileCheck2 className="h-5 w-5 text-brand-600" />
          DocVerify
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-brand-600"
          >
            <Upload className="h-4 w-4" />
            New upload
          </Link>
          <span>{email}</span>
          <button
            onClick={() => { logout(); nav("/login"); }}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
}