"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { getUserRole, signInWithEmail } from "@/services/auth";

export default function Connexion() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const credential = await signInWithEmail(email, password);
      const role = await getUserRole(credential.user.uid);
      router.push("/admin");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Une erreur est survenue.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center text-[#111827]">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-12">
        <section className="relative flex w-full flex-col items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg shadow-zinc-200/30 sm:p-8">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#6B7280]">Bienvenue</p>
              <h3 className="text-2xl font-semibold">Se connecter</h3>
              <p className="text-sm text-[#6B7280]">
                Utilisez vos identifiants pour accéder au tableau de bord.
              </p>
            </div>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[#111827]"
                >
                  Email professionnel
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="ex: camille@entreprise.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] placeholder:text-zinc-400 shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-[#111827]"
                  >
                    Mot de passe
                  </label>
                  <a
                    href="#"
                    className="text-xs font-medium text-[#6B7280] transition hover:text-[#111827]"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 pr-12 text-sm text-[#111827] placeholder:text-zinc-400 shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6B7280] transition hover:text-[#111827]"
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
                        <circle cx="12" cy="12" r="3.2" />
                        <path d="M4 4l16 16" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
                        <circle cx="12" cy="12" r="3.2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white shadow-lg shadow-zinc-900/30 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isLoading}
              >
                {isLoading ? "Connexion..." : "Accéder au tableau de bord"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
