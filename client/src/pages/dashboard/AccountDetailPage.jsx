import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
  Download,
  Send,
  Copy,
  Check,
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
import toast from "react-hot-toast";
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
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  formatCurrency,
  formatAccountNumber,
  formatDateTime,
  getStatusColor,
  downloadFile,
} from "../../lib/utils";

export const AccountDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: accountData, isLoading: loadingAccount } = useQuery({
    queryKey: ["account", id],
    queryFn: () => accountService.getAccount(id),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["account-summary", id],
    queryFn: () => accountService.getAccountSummary(id),
  });

  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: ["account-transactions", id],
    queryFn: () =>
      transactionService.getTransactions({ accountId: id, limit: 10 }),
  });

  const account = accountData?.data;
  const summary = summaryData?.data;
  const transactions = txData?.data || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(account?.accountNumber || "");
    setCopied(true);
    toast.success("Account number copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadStatement = async () => {
    try {
      const response = await accountService.getAccountStatement(id, {
        format: "json",
      });
      const statement = response.data;

      const headers = [
        "Date",
        "Transaction ID",
        "Description",
        "Type",
        "Amount",
        "Status",
      ];
      const rows = statement.transactions.map((t) => [
        new Date(t.date).toISOString(),
        t.transactionId,
        `"${t.description || ""}"`,
        t.type,
        t.amount,
        t.status,
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n",
      );
      const blob = new Blob([csv], { type: "text/csv" });
      downloadFile(
        blob,
        `statement-${account.accountNumber}-${Date.now()}.csv`,
      );
      toast.success("Statement downloaded");
    } catch {
      toast.error("Failed to download statement");
    }
  };

  const chartData = (summary?.monthlySummary || [])
    .slice()
    .reverse()
    .map((m) => ({
      month: new Date(m._id.year, m._id.month - 1).toLocaleDateString("en-US", {
        month: "short",
      }),
      credits: m.credits,
      debits: m.debits,
    }));

  if (loadingAccount) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <EmptyState
        icon={Wallet}
        title="Account not found"
        description="The account you're looking for doesn't exist"
        action={
          <Button onClick={() => navigate("/dashboard/accounts")}>
            Back to Accounts
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => navigate("/dashboard/accounts")}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to accounts
      </button>

      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-slate-500 uppercase">
                  {account.accountType} Account
                </p>
                <Badge variant={getStatusColor(account.status)}>
                  {account.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  {formatAccountNumber(account.accountNumber)}
                </p>
                <button
                  onClick={handleCopy}
                  className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(account.balance, account.currency)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/dashboard/transfer">
                <Button leftIcon={Send}>Transfer</Button>
              </Link>
              <Button
                variant="outline"
                leftIcon={Download}
                onClick={handleDownloadStatement}
              >
                Statement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success-50 dark:bg-success-700/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Credits</p>
                <p className="text-lg font-bold">
                  {formatCurrency(summary?.statistics?.totalCredits || 0)}
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
                <p className="text-xs text-slate-500">Total Debits</p>
                <p className="text-lg font-bold">
                  {formatCurrency(summary?.statistics?.totalDebits || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Transactions</p>
                <p className="text-lg font-bold">
                  {summary?.statistics?.transactionCount || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="credits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="debits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                />
                <Area
                  type="monotone"
                  dataKey="credits"
                  stroke="#22c55e"
                  fill="url(#credits)"
                />
                <Area
                  type="monotone"
                  dataKey="debits"
                  stroke="#ef4444"
                  fill="url(#debits)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Link to={`/dashboard/transactions?accountId=${id}`}>
              <Button variant="ghost" size="sm">
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
            <EmptyState icon={Wallet} title="No transactions yet" />
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {transactions.map((tx) => {
                const isCredit =
                  tx.toAccount?._id === id || tx.toAccount === id;
                return (
                  <div
                    key={tx._id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {tx.type.replace("_", " ")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(tx.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          isCredit
                            ? "text-success-500"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </p>
                      <Badge
                        variant={getStatusColor(tx.status)}
                        className="mt-1"
                      >
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
