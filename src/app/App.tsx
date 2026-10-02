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
