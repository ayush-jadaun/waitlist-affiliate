import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

interface Project {
  id: string;
  name: string;
  mode: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export function Settings({
  projectId,
  onProjectChange,
}: {
  projectId: string;
  onProjectChange: (id: string) => void;
}) {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/api/v1/admin/project"),
  });

  const selectedProject = projects.find((p) => p.id === projectId);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-32" />
          <div className="h-48 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      {/* Project selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Select Project</h2>
        {projects.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">No projects found</p>
            <p className="text-gray-500 text-xs mt-1">
              Create a project via POST /api/v1/admin/project
            </p>
          </div>
        ) : (
          <select
            value={projectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.mode})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Project details */}
      {selectedProject && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300">Project Details</h2>

          <dl className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <dt className="text-sm text-gray-400">Name</dt>
              <dd className="text-sm text-white font-medium">{selectedProject.name}</dd>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <dt className="text-sm text-gray-400">Project ID</dt>
              <dd className="text-sm text-white font-mono text-xs">{selectedProject.id}</dd>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <dt className="text-sm text-gray-400">Mode</dt>
              <dd>
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-medium ${
                    selectedProject.mode === "open"
                      ? "bg-green-900/40 text-green-400 border-green-800"
                      : selectedProject.mode === "closed"
                      ? "bg-red-900/40 text-red-400 border-red-800"
                      : "bg-yellow-900/40 text-yellow-400 border-yellow-800"
                  }`}
                >
                  {selectedProject.mode}
                </span>
              </dd>
            </div>
            <div className="flex justify-between items-start py-2 border-b border-gray-800">
              <dt className="text-sm text-gray-400">API Key</dt>
              <dd className="text-sm text-white font-mono text-xs break-all max-w-xs text-right">
                {selectedProject.apiKey}
              </dd>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <dt className="text-sm text-gray-400">Created</dt>
              <dd className="text-sm text-gray-300">
                {new Date(selectedProject.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
            <div className="flex justify-between items-center py-2">
              <dt className="text-sm text-gray-400">Last Updated</dt>
              <dd className="text-sm text-gray-300">
                {new Date(selectedProject.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">API Endpoint</h2>
        <p className="text-xs text-gray-500 mb-2">
          Configure via <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">VITE_API_URL</code> environment variable
        </p>
        <code className="block bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 font-mono">
          {import.meta.env["VITE_API_URL"] ?? "http://localhost:3400"}
        </code>
      </div>
    </div>
  );
}
