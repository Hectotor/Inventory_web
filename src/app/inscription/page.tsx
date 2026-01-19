"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { registerCompanyAdmin } from "@/services/registration";

export default function Inscription() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    try {
      await registerCompanyAdmin({
        company: {
          name: companyName.trim(),
          phone: companyPhone.trim(),
        },
        admin: {
          email: email.trim(),
          role: "ADMIN",
        },
        password,
      });
      setShowSuccess(true);
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
              <p className="text-sm font-medium text-[#6B7280]">
                Bienvenue
              </p>
              <h3 className="text-2xl font-semibold">Créer un compte</h3>
              <p className="text-sm text-[#6B7280]">
                Renseignez vos informations pour rejoindre la plateforme.
              </p>
            </div>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="companyName"
                  className="text-sm font-medium text-[#111827]"
                >
                  Nom de l&apos;entreprise
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="ex: Acme Logistics"
                  value={companyName}
                  onChange={(event) =>
                    setCompanyName(event.target.value.toUpperCase())
                  }
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm uppercase text-[#111827] placeholder:text-zinc-400 shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="companyPhone"
                  className="text-sm font-medium text-[#111827]"
                >
                  Téléphone
                </label>
                <input
                  id="companyPhone"
                  name="companyPhone"
                  type="tel"
                  placeholder="ex: +33 6 12 34 56 78"
                  value={companyPhone}
                  onChange={(event) => setCompanyPhone(event.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-[#111827] placeholder:text-zinc-400 shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  required
                />
              </div>
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
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[#111827]"
                >
                  Mot de passe
                </label>
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
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-[#111827]"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 pr-12 text-sm text-[#111827] placeholder:text-zinc-400 shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6B7280] transition hover:text-[#111827]"
                    aria-label={
                      showConfirmPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showConfirmPassword ? (
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
                {isLoading ? "Création..." : "Créer mon compte"}
              </button>
              <p className="text-center text-sm text-[#6B7280]">
                Déjà un compte ?{" "}
                <a
                  href="/connexion"
                  className="font-medium text-[#111827] transition hover:text-black"
                >
                  Se connecter
                </a>
              </p>
            </form>
          </div>
        </section>
      </div>
      {showSuccess ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 px-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h4 className="text-xl font-semibold">
              Félicitations !
            </h4>
            <p className="mt-2 text-sm text-[#6B7280]">
              Votre compte a bien été créé.
            </p>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Suivant
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
