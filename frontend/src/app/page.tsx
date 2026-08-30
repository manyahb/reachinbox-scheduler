"use client";

import { useState } from "react";
import { googleLoginUrl } from "@/lib/api";

export default function LoginPage() {
  const [showEmailNote, setShowEmailNote] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-hover/40">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-center text-text mb-6">Login</h1>

        <a
          href={googleLoginUrl()}
          className="flex items-center justify-center gap-2 rounded-md bg-green-soft-bg text-text font-medium text-sm py-2.5 hover:brightness-95 transition-all"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"/>
            <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"/>
          </svg>
          Login with Google
        </a>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-dim">or sign up through email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email ID"
            className="rounded-md border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-green"
          />
          <input
            type="password"
            placeholder="Password"
            className="rounded-md border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-green"
          />
        </div>

        <button
          onClick={() => setShowEmailNote(true)}
          className="mt-4 w-full rounded-md bg-green-dark text-white font-medium text-sm py-2.5 hover:opacity-90 transition-opacity"
        >
          Login
        </button>

        {showEmailNote && (
          <p className="mt-3 text-xs text-text-dim text-center">
            This assignment implements Google Sign-in only — use the button above.
          </p>
        )}
      </div>
    </div>
  );
}
