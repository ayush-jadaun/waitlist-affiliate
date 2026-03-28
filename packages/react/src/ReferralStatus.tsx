import { useEffect, useState, useMemo } from "react";
import { WaitlistClient, type SubscriberStatusResponse } from "@waitlist/sdk";
import { useWaitlistClient } from "./WaitlistProvider.js";

interface ReferralStatusProps {
  email: string;
  apiKey?: string;
  baseUrl?: string;
  className?: string;
}

export function ReferralStatus({ email, apiKey, baseUrl, className }: ReferralStatusProps) {
  const contextClient = useWaitlistClient();
  const client = useMemo(() => {
    if (contextClient) return contextClient;
    if (!apiKey || !baseUrl) throw new Error("Provide apiKey + baseUrl or use WaitlistProvider");
    return new WaitlistClient({ apiKey, baseUrl });
  }, [contextClient, apiKey, baseUrl]);

  const [status, setStatus] = useState<SubscriberStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.getStatus(email).then(setStatus).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load status");
    });
  }, [client, email]);

  if (error) return <div className={className}>Error: {error}</div>;
  if (!status) return <div className={className}>Loading...</div>;

  return (
    <div className={className}>
      {status.position !== null && <p>Position: #{status.position}</p>}
      <p>Referrals: {status.referralCount}</p>
      <p>Status: {status.status}</p>
      {status.rewards.length > 0 && <p>Rewards: {status.rewards.join(", ")}</p>}
      <p>Your referral code: <code>{status.referralCode}</code></p>
    </div>
  );
}
