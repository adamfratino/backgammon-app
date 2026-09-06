import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // How long a fetched result is trusted without re-checking. The default
        // is 0, which means every new mount refetches immediately — technically
        // correct, and the reason people conclude the cache "isn't working".
        staleTime: 60 * 1000,
      },
    },
  });
}
