import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (data considers fresh)
      gcTime: 1000 * 60 * 10, // 10 minutes (garbage collection)
      refetchOnWindowFocus: true, // Auto-update on focus
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
