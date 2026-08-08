"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as zxcvbnCommon from "@zxcvbn-ts/language-common";
import * as zxcvbnEn from "@zxcvbn-ts/language-en";

// Mirrors this Clerk instance's password policy (min_zxcvbn_strength: 2,
// no composition rules) so the live feedback below matches what Clerk will
// actually accept, instead of guessing at character-class rules.
const MIN_ZXCVBN_STRENGTH = 2;

const zxcvbnEngine = new ZxcvbnFactory({
  dictionary: { ...zxcvbnCommon.dictionary, ...zxcvbnEn.dictionary },
  graphs: zxcvbnCommon.adjacencyGraphs,
  translations: zxcvbnEn.translations,
});

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "errors" in err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstError = (err as any).errors?.[0];
    const message = firstError?.longMessage ?? firstError?.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
const STRENGTH_COLORS = ["var(--color-danger)", "#e0824f", "#e0c14f", "var(--color-green-primary)", "#4fae5c"];

function PasswordStrengthMeter({ password }: { password: string }) {
  const result = useMemo(() => (password ? zxcvbnEngine.check(password) : null), [password]);

  if (!password) return null;

  const score = result?.score ?? 0;
  const meetsMinimum = score >= MIN_ZXCVBN_STRENGTH;

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ backgroundColor: i <= score ? STRENGTH_COLORS[score] : "var(--color-border)" }}
          />
        ))}
      </div>
      <p className="text-[11px]" style={{ color: meetsMinimum ? "var(--color-green-primary)" : "var(--color-text-secondary)" }}>
        {STRENGTH_LABELS[score]}
        {!meetsMinimum && " — needs to be a bit stronger"}
      </p>
      {result?.feedback.warning && (
        <p className="text-[11px]" style={{ color: "#e0824f" }}>{result.feedback.warning}</p>
      )}
      {result?.feedback.suggestions.map((suggestion) => (
        <p key={suggestion} className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{suggestion}</p>
      ))}
    </div>
  );
}

function PasswordInput({
  label,
  placeholder,
  value,
  onChange,
  minLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          className="w-full rounded-md px-3 py-2.5 pr-10 text-sm outline-none transition-colors"
          style={{
            backgroundColor: "var(--color-bg-base)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 h-full px-3 flex items-center"
          style={{ color: "var(--color-text-muted)" }}
        >
          {visible ? (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 5.09A9.77 9.77 0 0112 5c5 0 9 4 10 7-.32.99-1.06 2.31-2.18 3.53M6.53 6.53C4.4 7.9 2.8 9.9 2 12c1 3 5 7 10 7 1.28 0 2.5-.24 3.6-.67" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [stage, setStage] = useState<"details" | "verify">("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);

  async function handleOAuth(strategy: "oauth_google") {
    if (!isLoaded) return;
    setError(null);
    setOauthLoading("google");
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      setError(errorMessage(err, "Unable to continue with that provider."));
      setOauthLoading(null);
    }
  }

  async function handleDetailsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const [firstName, ...rest] = fullName.trim().split(/\s+/);
      const lastName = rest.join(" ");
      await signUp.create({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        emailAddress: email,
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify");
    } catch (err) {
      setError(errorMessage(err, "Unable to create an account with those details."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/dashboard");
      } else {
        setError("That code didn't work. Check your email and try again.");
      }
    } catch (err) {
      setError(errorMessage(err, "That code didn't work. Check your email and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg-base)", color: "var(--color-text-primary)" }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-xl px-8 py-5"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
      >
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-2">
          <Image src="/logo.svg" alt="pipntick" width={180} height={180} priority />
        </Link>

        {stage === "details" ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Create your account</h1>
            <p className="text-sm mb-8" style={{ color: "var(--color-text-secondary)" }}>
              Start tracking your trades today.
            </p>

            <form className="flex flex-col gap-4" onSubmit={handleDetailsSubmit}>
              {/* Full name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-bg-base)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-bg-base)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <PasswordInput
                  label="Password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={setPassword}
                  minLength={8}
                />
                <PasswordStrengthMeter password={password} />
              </div>

              {/* Confirm password */}
              <PasswordInput
                label="Confirm password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                minLength={8}
              />

              {error && (
                <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                  {error}
                </p>
              )}

              {/* Clerk bot-protection widget mounts here for signUp.* calls
                  (details submit and the OAuth buttons below) */}
              <div id="clerk-captcha" />

              {/* Submit */}
              <button
                type="submit"
                disabled={!isLoaded || submitting}
                className="neon-btn w-full rounded-md py-2.5 text-sm font-semibold mt-2 disabled:opacity-60"
              >
                {submitting ? "Creating account..." : "Get started"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>or continue with</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
            </div>

            {/* Social */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleOAuth("oauth_google")}
                disabled={!isLoaded || oauthLoading !== null}
                className="ghost-btn w-full flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium disabled:opacity-60"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}
              </button>
            </div>

            {/* Login link */}
            <p className="text-center text-sm mt-6" style={{ color: "var(--color-text-secondary)" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-medium" style={{ color: "var(--color-green-primary)" }}>
                Log in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Check your email</h1>
            <p className="text-sm mb-8" style={{ color: "var(--color-text-secondary)" }}>
              We sent a verification code to {email}.
            </p>

            <form className="flex flex-col gap-4" onSubmit={handleVerifySubmit}>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-bg-base)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              {error && (
                <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!isLoaded || submitting}
                className="neon-btn w-full rounded-md py-2.5 text-sm font-semibold mt-2 disabled:opacity-60"
              >
                {submitting ? "Verifying..." : "Verify email"}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs mt-8" style={{ color: "var(--color-text-muted)" }}>
        © 2026 pipntick.trade
      </p>
    </div>
  );
}
