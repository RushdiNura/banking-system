import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CreditCard, Plus, TrendingUp } from "lucide-react";
import { loanService } from "../../services/loanService";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { formatCurrency, formatDate, getStatusColor } from "../../lib/utils";

export const LoansPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["loans"],
    queryFn: () => loanService.getLoans({ limit: 50 }),
  });

  const loans = data?.data || [];

  const stats = {
    total: loans.reduce((s, l) => s + l.amount, 0),
    active: loans.filter((l) => l.status === "active").length,
    pending: loans.filter((l) => l.status === "pending").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Loans
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your loans and applications
          </p>
        </div>
        <Link to="/dashboard/loans/apply">
          <Button leftIcon={Plus}>Apply for Loan</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-slate-500">Total Borrowed</p>
            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(stats.total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-slate-500">Active Loans</p>
            <p className="mt-2 text-2xl font-bold">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-slate-500">
              Pending Applications
            </p>
            <p className="mt-2 text-2xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : loans.length === 0 ? (
        <Card>
          <EmptyState
            icon={CreditCard}
            title="No loans yet"
            description="Apply for your first loan to get started"
            action={
              <Link to="/dashboard/loans/apply">
                <Button leftIcon={Plus}>Apply for Loan</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loans.map((loan) => (
            <Link key={loan._id} to={`/dashboard/loans/${loan._id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold capitalize">
                          {loan.loanType} Loan
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {loan.loanNumber}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(loan.status)}>
                      {loan.status}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Amount</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {formatCurrency(loan.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">EMI</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {formatCurrency(loan.emiAmount)}/mo
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Interest Rate</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {loan.interestRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Term</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {loan.termMonths} months
                      </p>
                    </div>
                  </div>

                  {loan.status === "active" && loan.nextPaymentDate && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500">Next payment due</p>
                      <p className="text-sm font-medium mt-0.5">
                        {formatDate(loan.nextPaymentDate)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
