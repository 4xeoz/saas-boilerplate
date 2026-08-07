"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/ThemeContext";
import { UserProvider } from "@/lib/UserContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          {children}
        </UserProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
