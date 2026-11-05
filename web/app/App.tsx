/**
 * App root: wraps the router in the state providers every screen relies on.
 * Layer: shared (app shell). Called by web/main.tsx.
 * Calls: state/session.tsx, state/serverData.tsx, state/pendingSignUps.tsx, app/routes.tsx.
 * Used by: every role.
 */
import { RouterProvider } from "react-router";
import { SessionProvider } from "@web/state/session";
import { ServerDataProvider } from "@web/state/serverData";
import { PendingSignUpsProvider } from "@web/state/pendingSignUps";
import { router } from "./routes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Renders the router inside the providers.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ServerDataProvider>
          <PendingSignUpsProvider>
            <RouterProvider router={router} />
          </PendingSignUpsProvider>
        </ServerDataProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
