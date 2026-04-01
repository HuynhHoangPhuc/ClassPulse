import { createRoute } from "@tanstack/react-router";
import { SignIn } from "@clerk/clerk-react";
import { rootRoute } from "./root-route";

/**
 * Public login route.
 * Already-signed-in users are caught by the authed layout's redirect;
 * no beforeLoad guard needed here since Clerk state is async.
 */
export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #06B6D4 100%)" }}
    >
      {/* Background decorative blobs */}
      <div
        className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #818CF8, transparent)" }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #FB923C, transparent)" }}
      />

      {/* Glass card */}
      <div
        className="relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl border"
        style={{
          background: "rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderColor: "rgba(255, 255, 255, 0.2)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Platform branding */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "rgba(255, 255, 255, 0.2)" }}
          >
            <span className="text-white text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              T
            </span>
          </div>
          <h1
            className="text-3xl font-bold text-white mb-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Teaching Platform
          </h1>
          <p className="text-white/70 text-sm">
            Empowering educators and learners together
          </p>
        </div>

        {/* Clerk SignIn component */}
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent shadow-none p-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "border border-white/20 text-white bg-white/10 hover:bg-white/20",
              formFieldInput:
                "bg-white/10 border-white/20 text-white placeholder:text-white/50",
              formButtonPrimary:
                "bg-white text-indigo-600 hover:bg-white/90 font-semibold",
              footerActionLink: "text-white/80 hover:text-white",
            },
          }}
        />
      </div>
    </div>
  );
}
