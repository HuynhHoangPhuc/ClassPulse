import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes/router";

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

// ---------------------------------------------------------------------------
// QueryClient — shared singleton for the app
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

// ---------------------------------------------------------------------------
// App root — provider stack: Clerk → QueryClient → Router
// ---------------------------------------------------------------------------

export function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
