import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api } from "../lib/api.js";

interface OverviewStats {
  totalSignups: number;
  todaySignups: number;
  totalReferrals: number;
  todayReferrals: number;
  conversionRate: number;
  kFactor: number;
}

interface TimeseriesRow {
  date: string;
  signups: number;
  referrals: number;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export function Overview({ projectId }: { projectId: string }) {
  const { data: stats, isLoading: statsLoading } = useQuery<OverviewStats>({
    queryKey: ["overview", projectId],
    queryFn: () => api<OverviewStats>(`/api/v1/admin/analytics/overview?projectId=${projectId}`),
    refetchInterval: 30_000,
    enabled: !!projectId,
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: timeseries, isLoading: tsLoading } = useQuery<TimeseriesRow[]>({
    queryKey: ["timeseries", projectId],
    queryFn: () =>
      api<TimeseriesRow[]>(
        `/api/v1/admin/analytics/timeseries?projectId=${projectId}&from=${thirtyDaysAgo}&to=${today}`
      ),
    refetchInterval: 30_000,
    enabled: !!projectId,
  });

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array<null>(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  const chartData = (timeseries ?? []).map((row) => ({
    date: row.date.slice(5),
    Signups: row.signups,
    Referrals: row.referrals,
  }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Signups"
          value={stats?.totalSignups.toLocaleString() ?? "—"}
          sub={`+${stats?.todaySignups ?? 0} today`}
        />
        <StatCard
          label="Today's Signups"
          value={stats?.todaySignups ?? "—"}
        />
        <StatCard
          label="Total Referrals"
          value={stats?.totalReferrals.toLocaleString() ?? "—"}
          sub={`+${stats?.todayReferrals ?? 0} today`}
        />
        <StatCard
          label="K-Factor"
          value={stats ? stats.kFactor.toFixed(3) : "—"}
          sub="Viral coefficient"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">30-Day Signups & Referrals</h2>
        {tsLoading ? (
          <div className="h-56 flex items-center justify-center">
            <p className="text-gray-500 text-sm">Loading chart...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center">
            <p className="text-gray-500 text-sm">No data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
              />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
              <Line type="monotone" dataKey="Signups" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Referrals" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
