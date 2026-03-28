import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

interface RewardTier {
  id: string;
  name: string;
  threshold: number;
  rewardType: string;
  rewardValue: string;
  sortOrder: number;
}

const REWARD_TYPES = ["discount", "access", "badge", "custom"];

export function Rewards({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState("");
  const [rewardType, setRewardType] = useState("discount");
  const [rewardValue, setRewardValue] = useState("");
  const [formError, setFormError] = useState("");

  const { data: tiers = [], isLoading } = useQuery<RewardTier[]>({
    queryKey: ["rewards", projectId],
    queryFn: () => api<RewardTier[]>(`/api/v1/admin/rewards?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      api("/api/v1/admin/rewards", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rewards"] });
      setName("");
      setThreshold("");
      setRewardValue("");
      setFormError("");
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Failed to create reward");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/admin/rewards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rewards"] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!name || !threshold || !rewardValue) {
      setFormError("All fields are required");
      return;
    }
    createMutation.mutate({
      projectId,
      name,
      threshold: Number(threshold),
      rewardType,
      rewardValue,
      sortOrder: tiers.length,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Rewards</h1>

      {/* Add tier form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Add Reward Tier</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Early Adopter"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Referrals Required</label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              min={1}
              placeholder="e.g. 5"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reward Type</label>
            <select
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {REWARD_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reward Value</label>
            <input
              value={rewardValue}
              onChange={(e) => setRewardValue(e.target.value)}
              placeholder="e.g. 20% off"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          {formError && (
            <p className="sm:col-span-2 text-red-400 text-sm">{formError}</p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {createMutation.isPending ? "Adding..." : "Add Tier"}
            </button>
          </div>
        </form>
      </div>

      {/* Tiers list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Reward Tiers</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : tiers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No reward tiers yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 font-medium px-4 py-3">Name</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Threshold</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Type</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{tier.name}</td>
                  <td className="px-4 py-3 text-gray-300">{tier.threshold} referrals</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-900/40 text-blue-400 border border-blue-800 text-xs px-2 py-0.5 rounded">
                      {tier.rewardType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{tier.rewardValue}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(tier.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
