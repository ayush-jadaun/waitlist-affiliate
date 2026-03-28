import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

interface ExperimentVariant {
  name: string;
  weight: number;
}

interface Experiment {
  id: string;
  name: string;
  variants: ExperimentVariant[];
  active: boolean;
  createdAt: string;
}

export function Experiments({ projectId }: { projectId: string }) {
  const qc = useQueryClient();

  const { data: experiments = [], isLoading } = useQuery<Experiment[]>({
    queryKey: ["experiments", projectId],
    queryFn: () => api<Experiment[]>(`/api/v1/admin/experiments?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/admin/experiments/${id}`, { method: "PATCH" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/admin/experiments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Experiments</h1>

      {isLoading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          Loading...
        </div>
      ) : experiments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">No experiments configured</p>
          <p className="text-gray-500 text-xs mt-1">Experiments are created via the API</p>
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.map((exp) => (
            <div
              key={exp.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-medium">{exp.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border font-medium ${
                        exp.active
                          ? "bg-green-900/40 text-green-400 border-green-800"
                          : "bg-gray-800 text-gray-400 border-gray-700"
                      }`}
                    >
                      {exp.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Created {new Date(exp.createdAt).toLocaleDateString()}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(exp.variants) ? exp.variants : []).map((v, i) => (
                      <div
                        key={i}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs"
                      >
                        <span className="text-white font-medium">{v.name}</span>
                        <span className="text-gray-400 ml-2">{Math.round(v.weight * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate(exp.id)}
                    disabled={toggleMutation.isPending}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      exp.active
                        ? "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
                        : "bg-blue-600 hover:bg-blue-500 text-white border-blue-600"
                    }`}
                  >
                    {exp.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(exp.id)}
                    disabled={deleteMutation.isPending}
                    className="text-sm px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
