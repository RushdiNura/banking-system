import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import { transactionService } from "../../services/transactionService";
import { loanService } from "../../services/loanService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { formatCurrency } from "../../lib/utils";

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export const ReportsPage = () => {
  const { data: txStats, isLoading: loadingTx } = useQuery({
    queryKey: ["reports", "transactions"],
    queryFn: () => transactionService.getStats({ period: "30d" }),
  });

  const { data: loanStats, isLoading: loadingLoans } = useQuery({
    queryKey: ["reports", "loans"],
    queryFn: () => loanService.getStats(),
  });

  if (loadingTx || loadingLoans) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const byType = (txStats?.data?.statsByType || []).map((s) => ({
    name: s._id.replace("_", " "),
    value: s.totalAmount,
    count: s.count,
  }));

  const dailyTrend = (txStats?.data?.dailyTrend || []).slice(-14).map((d) => ({
    date: new Date(d._id).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    amount: d.totalAmount,
  }));

  const loansByType = (loanStats?.data?.byType || []).map((l) => ({
    name: l._id,
    value: l.totalAmount,
    count: l.count,
  }));

  const totalTx = byType.reduce((s, t) => s + t.value, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Reports & Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View system-wide financial insights
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Volume</p>
                <p className="text-lg font-bold">{formatCurrency(totalTx)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success-50 dark:bg-success-700/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Transactions</p>
                <p className="text-lg font-bold">
                  {byType.reduce((s, t) => s + t.count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning-50 dark:bg-warning-700/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-warning-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Active Loans</p>
                <p className="text-lg font-bold">
                  {(loanStats?.data?.byStatus || [])
                    .filter((l) => l._id === "active")
                    .reduce((s, l) => s + l.count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-danger-50 dark:bg-danger-700/20 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-danger-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending Loans</p>
                <p className="text-lg font-bold">
                  {(loanStats?.data?.byStatus || [])
                    .filter((l) => l._id === "pending")
                    .reduce((s, l) => s + l.count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Volume by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) =>
                      `${entry.name}: ${formatCurrency(entry.value)}`
                    }
                  >
                    {byType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-slate-500 py-12">
                No data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Transaction Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-slate-500 py-12">
                No data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan Distribution by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {loansByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={loansByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-slate-500 py-12">
              No loan data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
