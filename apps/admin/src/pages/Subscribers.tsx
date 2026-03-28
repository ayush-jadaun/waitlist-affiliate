import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  position: number;
  status: string;
  createdAt: string;
}

interface SubscribersResponse {
  data: Subscriber[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const STATUS_OPTIONS = ["", "waiting", "approved", "rejected", "banned"];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    waiting: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
    approved: "bg-green-900/40 text-green-400 border-green-800",
    rejected: "bg-red-900/40 text-red-400 border-red-800",
    banned: "bg-gray-800 text-gray-400 border-gray-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status}
    </span>
  );
}

export function Subscribers({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<SubscribersResponse>({
    queryKey: ["subscribers", projectId, page, search, status],
    queryFn: () => {
      const params = new URLSearchParams({
        projectId,
        page: String(page),
        limit: "20",
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      });
      return api<SubscribersResponse>(`/api/v1/admin/subscribers?${params}`);
    },
    enabled: !!projectId,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api(`/api/v1/admin/subscribers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subscribers"] });
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const pagination = data?.pagination;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Subscribers</h1>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="text-gray-400 hover:text-white text-sm px-2 py-1.5 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "" ? "All statuses" : s}</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 font-medium px-4 py-3">Email</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Name</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Position</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Status</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Joined</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No subscribers found
                  </td>
                </tr>
              ) : (
                (data?.data ?? []).map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-mono text-xs">{sub.email}</td>
                    <td className="px-4 py-3 text-gray-300">{sub.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">#{sub.position}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {sub.status !== "approved" && (
                          <button
                            onClick={() => patchMutation.mutate({ id: sub.id, newStatus: "approved" })}
                            disabled={patchMutation.isPending}
                            className="text-xs bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-800 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {sub.status !== "rejected" && (
                          <button
                            onClick={() => patchMutation.mutate({ id: sub.id, newStatus: "rejected" })}
                            disabled={patchMutation.isPending}
                            className="text-xs bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
