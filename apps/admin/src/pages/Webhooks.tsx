import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  createdAt: string;
}

function DeliveryLog({ endpointId }: { endpointId: string }) {
  const { data: deliveries = [], isLoading } = useQuery<WebhookDelivery[]>({
    queryKey: ["webhook-deliveries", endpointId],
    queryFn: () =>
      api<WebhookDelivery[]>(`/api/v1/admin/webhooks/${endpointId}/deliveries?page=1&limit=10`),
  });

  if (isLoading) {
    return <div className="px-4 py-3 text-xs text-gray-500">Loading deliveries...</div>;
  }

  if (deliveries.length === 0) {
    return <div className="px-4 py-3 text-xs text-gray-500">No deliveries yet</div>;
  }

  return (
    <div className="border-t border-gray-800">
      <div className="px-4 py-2 bg-gray-800/40">
        <p className="text-xs font-medium text-gray-400">Recent Deliveries</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800/50">
            <th className="text-left text-gray-500 font-medium px-4 py-2">Event</th>
            <th className="text-left text-gray-500 font-medium px-4 py-2">Status</th>
            <th className="text-left text-gray-500 font-medium px-4 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id} className="border-b border-gray-800/30">
              <td className="px-4 py-2 text-gray-300 font-mono">{d.event}</td>
              <td className="px-4 py-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-xs ${
                    d.success
                      ? "bg-green-900/40 text-green-400"
                      : "bg-red-900/40 text-red-400"
                  }`}
                >
                  {d.statusCode ?? (d.success ? "200" : "error")}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-500">
                {new Date(d.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Webhooks({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: endpoints = [], isLoading } = useQuery<WebhookEndpoint[]>({
    queryKey: ["webhooks", projectId],
    queryFn: () => api<WebhookEndpoint[]>(`/api/v1/admin/webhooks?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/admin/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Webhooks</h1>

      {isLoading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          Loading...
        </div>
      ) : endpoints.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">No webhook endpoints configured</p>
          <p className="text-gray-500 text-xs mt-1">Create endpoints via the API or SDK</p>
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <div key={ep.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-mono truncate">{ep.url}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ep.events.map((event) => (
                      <span
                        key={event}
                        className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Added {new Date(ep.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleExpanded(ep.id)}
                    className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    {expanded.has(ep.id) ? "Hide logs" : "View logs"}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(ep.id)}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:bg-red-900/30 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expanded.has(ep.id) && <DeliveryLog endpointId={ep.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
