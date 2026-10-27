import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, Download, FileText, ArrowRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { transactionService } from "../../services/transactionService";
import { accountService } from "../../services/accountService";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import {
  formatCurrency,
  formatDateTime,
  getStatusColor,
} from "../../lib/utils";
import { exportService } from '../../services/exportService';
import { ExportButton } from '../../components/ui/ExportButton';
// Compute direction: 'credit' (money in), 'debit' (money out), or 'neutral' (admin viewing others)
const computeDirection = (tx, userAccountIds) => {
  const creditTypes = ["deposit", "loan_disbursement", "refund"];
  const debitTypes = ["withdrawal", "payment", "fee", "loan_repayment"];

  if (creditTypes.includes(tx.type)) return "credit";
  if (debitTypes.includes(tx.type)) return "debit";

  if (tx.type === "transfer" || tx.type === "adjustment") {
    const fromId = (tx.fromAccount?._id || tx.fromAccount)?.toString();
    const toId = (tx.toAccount?._id || tx.toAccount)?.toString();

    const isRecipient = toId && userAccountIds.includes(toId);
    const isSender = fromId && userAccountIds.includes(fromId);

    if (isRecipient && !isSender) return "credit";
    if (isSender && !isRecipient) return "debit";
    return "neutral";
  }

  return "neutral";
};

// Format account number for display: ****7890
const shortAccount = (num) => (num ? `****${String(num).slice(-4)}` : "—");

export const TransactionsPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    status: "",
    page: 1,
    limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => transactionService.getTransactions(filters),
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAccounts(),
  });

  const userAccountIds = (accountsData?.data || []).map((a) =>
    a._id.toString()
  );

  // Role-aware column visibility
  const showFromTo = user?.role === "admin" || user?.role === "employee";

  const transactions = data?.data || [];
  const totalPages = data?.pages || 1;

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {showFromTo
              ? "View all system transactions across users"
              : "View and track all your financial transactions"}
          </p>
        </div>
      <ExportButton
  exportFn={() => exportService.transactions(filters)}
  label="Export CSV"
  successMessage="Transactions exported"
/>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                icon={Search}
                placeholder="Search by reference, description..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              leftIcon={Filter}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={filters.type}
                  onChange={(e) => handleFilterChange("type", e.target.value)}
                >
                  <option value="">All types</option>
                  <option value="transfer">Transfer</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="payment">Payment</option>
                  <option value="loan_disbursement">Loan Disbursement</option>
                  <option value="loan_repayment">Loan Repayment</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="reversed">Reversed</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    setFilters({
                      search: "",
                      type: "",
                      status: "",
                      page: 1,
                      limit: 20,
                    })
                  }
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No transactions found"
              description="Try adjusting your filters"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Transaction
                    </th>
                    {showFromTo && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        From → To
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {transactions.map((tx) => {
                    const direction = computeDirection(tx, userAccountIds);

                    const sign =
                      direction === "credit" ? "+" : direction === "debit" ? "-" : "";

                    const colorClass =
                      direction === "credit"
                        ? "text-success-500"
                        : direction === "debit"
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-500 dark:text-slate-400";

                    const bgClass =
                      direction === "credit"
                        ? "bg-success-50 dark:bg-success-700/20"
                        : direction === "debit"
                        ? "bg-danger-50 dark:bg-danger-700/20"
                        : "bg-slate-100 dark:bg-slate-700/40";

                    const iconColor =
                      direction === "credit"
                        ? "text-success-500"
                        : direction === "debit"
                        ? "text-danger-500"
                        : "text-slate-400";

                    return (
                      <tr
                        key={tx._id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 rounded-lg flex items-center justify-center ${bgClass}`}
                            >
                              <span className={`text-xs font-bold ${iconColor}`}>
                                {direction === "credit"
                                  ? "+"
                                  : direction === "debit"
                                  ? "-"
                                  : "•"}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                                {tx.type.replace("_", " ")}
                              </p>
                              <p className="text-xs text-slate-500 truncate max-w-xs">
                                {tx.description || tx.referenceNumber}
                              </p>
                            </div>
                          </div>
                        </td>

                        {showFromTo && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 dark:text-slate-400">
                              <span>{shortAccount(tx.fromAccountNumber)}</span>
                              <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{shortAccount(tx.toAccountNumber)}</span>
                            </div>
                          </td>
                        )}

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-500">
                            {formatDateTime(tx.createdAt)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getStatusColor(tx.status)}>
                            {tx.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <span className={`text-sm font-semibold ${colorClass}`}>
                            {sign}
                            {formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500">
                Page {filters.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() => handleFilterChange("page", filters.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= totalPages}
                  onClick={() => handleFilterChange("page", filters.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};