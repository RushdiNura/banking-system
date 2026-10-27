import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, CreditCard, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { loanService } from "../../../services/loanService";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";
import { EmptyState } from "../../../components/ui/EmptyState";
import { formatCurrency, formatDate, getStatusColor } from "../../../lib/utils";

export const AdminLoansPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: "",
    search: "",
    page: 1,
    limit: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-loans-all", filters],
    queryFn: () => loanService.getAllLoans(filters),
  });

  const loans = data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          All Loans
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View and manage all loans across the system
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                icon={Search}
                placeholder="Search by loan number..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value, page: 1 })
                }
              />
            </div>
            <select
              className="input sm:w-48"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value, page: 1 })
              }
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : loans.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No loans found"
              description="Try adjusting your filters"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Loan
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                      Applied
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {loans.map((loan) => (
                    <tr key={loan._id}>
                      <td className="px-6 py-4 text-sm">
                        {loan.userId?.firstName} {loan.userId?.lastName}
                        <div className="text-xs text-slate-500">
                          {loan.userId?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium capitalize">
                          {loan.loanType}
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          {loan.loanNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={getStatusColor(loan.status)}>
                          {loan.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-500">
                        {formatDate(loan.applicationDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
