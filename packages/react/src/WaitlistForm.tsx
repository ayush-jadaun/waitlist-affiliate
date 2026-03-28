import { useState, useMemo, type FormEvent } from "react";
import { WaitlistClient, type SubscribeResponse } from "@waitlist/sdk";
import { useWaitlistClient } from "./WaitlistProvider.js";

interface WaitlistFormProps {
  apiKey?: string;
  baseUrl?: string;
  onSuccess?: (result: SubscribeResponse) => void;
  onError?: (error: Error) => void;
  className?: string;
  referralCode?: string;
}

export function WaitlistForm({ apiKey, baseUrl, onSuccess, onError, className, referralCode }: WaitlistFormProps) {
  const contextClient = useWaitlistClient();
  const client = useMemo(() => {
    if (contextClient) return contextClient;
    if (!apiKey || !baseUrl) throw new Error("Provide apiKey + baseUrl or use WaitlistProvider");
    return new WaitlistClient({ apiKey, baseUrl });
  }, [contextClient, apiKey, baseUrl]);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubscribeResponse | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await client.subscribe({ email, name: name || undefined, referralCode });
      setResult(res);
      onSuccess?.(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      onError?.(err instanceof Error ? err : new Error(msg));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className={className}>
        <h3>You're in!</h3>
        {result.position !== null && <p>Your position: #{result.position}</p>}
        <p>Your referral code: <code>{result.referralCode}</code></p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Joining..." : "Join Waitlist"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
