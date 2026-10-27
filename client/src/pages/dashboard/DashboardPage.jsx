import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  CreditCard,
  Plus,
  Eye,
  Send,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../../contexts/AuthContext";
import { accountService } from "../../services/accountService";
import { transactionService } from "../../services/transactionService";
import { Button } from "../../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import {
  formatCurrency,
  formatRelativeTime,
  getStatusColor,
  maskAccountNumber,
} from "../../lib/utils";

const COLOR_MAP = {
  primary: {
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    text: 'text-primary-600 dark:text-primary-400',
  },
  success: {
    bg: 'bg-success-50 dark:bg-success-700/20',
    text: 'text-success-500 dark:text-success-400',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-700/20',
    text: 'text-warning-500 dark:text-warning-400',
  },
  danger: {
    bg: 'bg-danger-50 dark:bg-danger-700/20',
    text: 'text-danger-500 dark:text-danger-400',
  },
};

const StatCard = ({ title, value, change, icon: Icon, color = 'primary', trend }) => {
  const colors = COLOR_MAP[color] || COLOR_MAP.primary;
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            {change && (
              <div
                className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                  trend === 'up' ? 'text-success-500' : 'text-danger-500'
                }`}
              >
                {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {change}
              </div>
            )}
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
            <Icon className={`h-6 w-6 ${colors.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const DashboardPage = () => {
  const { user } = useAuth();

  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAccounts(),
  });

  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => transactionService.getTransactions({ limit: 5 }),
  });

  const { data: statsData } = useQuery({
    queryKey: ["transactions", "stats"],
    queryFn: () => transactionService.getStats({ period: "30d" }),
  });

  const accounts = accountsData?.data || [];
  const transactions = txData?.data || [];
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // Transform data for chart
  const chartData = (statsData?.data?.dailyTrend || [])
    .slice(-14)
    .map((item) => ({
      date: new Date(item._id).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      amount: item.totalAmount,
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here's an overview of your financial activity
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/transfer">
            <Button leftIcon={Send}>Send Money</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Balance"
          value={loadingAccounts ? "..." : formatCurrency(totalBalance)}
          icon={Wallet}
          color="primary"
        />
        <StatCard
          title="Active Accounts"
          value={accounts.filter((a) => a.status === "active").length}
          icon={CreditCard}
          color="success"
        />
        <StatCard
          title="Monthly Transactions"
          value={
            statsData?.data?.statsByType?.reduce((s, t) => s + t.count, 0) || 0
          }
          icon={ArrowLeftRight}
          color="warning"
        />
        <StatCard
          title="Total Credits (30d)"
          value={
            loadingTx
              ? "..."
              : formatCurrency(
                  statsData?.data?.statsByType?.find((s) => s._id === "deposit")
                    ?.totalAmount || 0,
                )
          }
          icon={TrendingUp}
          color="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transaction Activity</CardTitle>
              <Badge variant="primary">Last 14 days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="colorAmount"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorAmount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No activity yet"
                description="Your transaction activity will appear here"
              />
            )}
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Accounts</CardTitle>
              <Link to="/dashboard/accounts">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingAccounts ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : accounts.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No accounts"
                description="Open your first account to get started"
                action={
                  <Link to="/dashboard/accounts">
                    <Button size="sm" leftIcon={Plus}>
                      Open Account
                    </Button>
                  </Link>
                }
              />
            ) : (
              accounts.slice(0, 4).map((account) => (
                <Link
                  key={account._id}
                  to={`/dashboard/accounts/${account._id}`}
                  className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-primary-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 uppercase">
                        {account.accountType}
                      </p>
                      <p className="text-sm font-mono text-slate-900 dark:text-white">
                        {maskAccountNumber(account.accountNumber)}
                      </p>
                    </div>
                    <Badge variant={getStatusColor(account.status)}>
                      {account.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Link to="/dashboard/transactions">
              <Button variant="ghost" size="sm" rightIcon={ArrowUpRight}>
                View all
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions"
              description="Your transaction history will appear here"
            />
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {transactions.map((tx) => (
                <Link
                  key={tx._id}
                  to={`/dashboard/transactions?id=${tx._id}`}
                  className="flex items-center justify-between py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        ["deposit", "loan_disbursement", "refund"].includes(
                          tx.type,
                        )
                          ? "bg-success-50 dark:bg-success-700/20"
                          : "bg-danger-50 dark:bg-danger-700/20"
                      }`}
                    >
                      {["deposit", "loan_disbursement", "refund"].includes(
                        tx.type,
                      ) ? (
                        <TrendingUp className="h-5 w-5 text-success-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-danger-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {tx.description || tx.type.replace("_", " ")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatRelativeTime(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-semibold ${
                        ["deposit", "loan_disbursement", "refund"].includes(
                          tx.type,
                        )
                          ? "text-success-500"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {["deposit", "loan_disbursement", "refund"].includes(
                        tx.type,
                      )
                        ? "+"
                        : "-"}
                      {formatCurrency(tx.amount, tx.currency)}
                    </p>
                    <Badge variant={getStatusColor(tx.status)} className="mt-1">
                      {tx.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
