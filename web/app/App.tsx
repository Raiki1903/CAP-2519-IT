/**
 * App root: wraps the router in the state providers every screen relies on.
 * Layer: shared (app shell). Called by web/main.tsx.
 * Calls: state/session.tsx, state/browserOnly.tsx, state/serverData.tsx, app/routes.tsx.
 * Used by: every role.
 */
import { RouterProvider } from "react-router";
import { SessionProvider } from "@web/state/session";
import { BrowserOnlyProvider } from "@web/state/browserOnly";
import { ServerDataProvider } from "@web/state/serverData";
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
 * The order matters: ServerDataProvider calls useBrowserOnly() to reread the
 * browser-only lists after each server reload, so it must sit inside BrowserOnlyProvider.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserOnlyProvider>
          <ServerDataProvider>
            <RouterProvider router={router} />
          </ServerDataProvider>
        </BrowserOnlyProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
