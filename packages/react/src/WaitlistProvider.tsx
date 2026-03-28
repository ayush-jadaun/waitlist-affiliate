import { createContext, useContext, useMemo, type ReactNode } from "react";
import { WaitlistClient } from "@waitlist/sdk";

interface WaitlistContextValue {
  client: WaitlistClient;
}

export const WaitlistContext = createContext<WaitlistContextValue | null>(null);

export function useWaitlistClient(): WaitlistClient | null {
  return useContext(WaitlistContext)?.client ?? null;
}

interface WaitlistProviderProps {
  apiKey: string;
  baseUrl: string;
  children: ReactNode;
}

export function WaitlistProvider({ apiKey, baseUrl, children }: WaitlistProviderProps) {
  const client = useMemo(() => new WaitlistClient({ apiKey, baseUrl }), [apiKey, baseUrl]);

  return (
    <WaitlistContext.Provider value={{ client }}>
      {children}
    </WaitlistContext.Provider>
  );
}
