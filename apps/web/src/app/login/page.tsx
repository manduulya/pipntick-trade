import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#05090f", color: "#f0f0f0" }}
    >
      {/* Logo */}
      <Link href="/" className="mb-0">
        <Image src="/logo.svg" alt="pipntick" width={160} height={160} priority />
      </Link>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}
      >
        <h1 className="text-2xl font-bold tracking-tight mb-1">Welcome back</h1>
        <p className="text-sm mb-8" style={{ color: "#8899aa" }}>
          Log in to your pipntick account.
        </p>

        <form className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "#8899aa" }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: "#05090f",
                border: "1px solid #1a2d4a",
                color: "#f0f0f0",
              }}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: "#8899aa" }}>
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs transition-colors"
                style={{ color: "#7bc13b" }}
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: "#05090f",
                border: "1px solid #1a2d4a",
                color: "#f0f0f0",
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="neon-btn w-full rounded-md py-2.5 text-sm font-semibold mt-2"
          >
            Log in
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ backgroundColor: "#1a2d4a" }} />
          <span className="text-xs" style={{ color: "#4a5d70" }}>or continue with</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#1a2d4a" }} />
        </div>

        {/* Google */}
        <button
          className="ghost-btn w-full flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Register link */}
        <p className="text-center text-sm mt-6" style={{ color: "#8899aa" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium" style={{ color: "#7bc13b" }}>
            Get started
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="text-xs mt-8" style={{ color: "#4a5d70" }}>
        © 2026 pipntick.trade
      </p>
    </div>
  );
}
