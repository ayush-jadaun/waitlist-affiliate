import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, setToken, clearToken } from "./lib/api.js";
import { Overview } from "./pages/Overview.js";
import { Subscribers } from "./pages/Subscribers.js";
import { Rewards } from "./pages/Rewards.js";
import { Experiments } from "./pages/Experiments.js";
import { Webhooks } from "./pages/Webhooks.js";
import { Settings } from "./pages/Settings.js";

type Page = "overview" | "subscribers" | "rewards" | "experiments" | "webhooks" | "settings";

interface Project {
  id: string;
  name: string;
  mode: string;
  apiKey: string;
  createdAt: string;
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSetup, setIsSetup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isSetup ? "/api/v1/admin/auth/setup" : "/api/v1/admin/auth/login";
      const res = await api<{ token: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Waitlist Admin</h1>
        <p className="text-gray-400 mb-8 text-sm">
          {isSetup ? "Create your admin account" : "Sign in to continue"}
        </p>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {loading ? "Please wait..." : isSetup ? "Create Account" : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => { setIsSetup(!isSetup); setError(""); }}
          className="mt-4 text-sm text-gray-400 hover:text-gray-300 w-full text-center transition-colors"
        >
          {isSetup ? "Already have an account? Sign in" : "First time? Set up admin account"}
        </button>
      </div>
    </div>
  );
}

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "subscribers", label: "Subscribers", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "rewards", label: "Rewards", icon: "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" },
  { id: "experiments", label: "Experiments", icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" },
  { id: "webhooks", label: "Webhooks", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
  { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

function Sidebar({
  currentPage,
  onNavigate,
  onLogout,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-white font-bold text-lg">Waitlist Admin</h2>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
              currentPage === item.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-2 border-t border-gray-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-left"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("admin_token"));
  const [page, setPage] = useState<Page>("overview");
  const [projectId, setProjectId] = useState<string>("");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/api/v1/admin/project"),
    enabled: authed,
  });

  useEffect(() => {
    if (projects && projects.length > 0 && !projectId) {
      setProjectId(projects[0]!.id);
    }
  }, [projects, projectId]);

  function handleLogout() {
    clearToken();
    setAuthed(false);
    setProjectId("");
  }

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  function renderPage() {
    if (!projectId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-4">No projects found.</p>
            <button
              onClick={() => setPage("settings")}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Go to Settings to create a project
            </button>
          </div>
        </div>
      );
    }

    switch (page) {
      case "overview": return <Overview projectId={projectId} />;
      case "subscribers": return <Subscribers projectId={projectId} />;
      case "rewards": return <Rewards projectId={projectId} />;
      case "experiments": return <Experiments projectId={projectId} />;
      case "webhooks": return <Webhooks projectId={projectId} />;
      case "settings": return <Settings projectId={projectId} onProjectChange={setProjectId} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      <Sidebar currentPage={page} onNavigate={setPage} onLogout={handleLogout} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}
