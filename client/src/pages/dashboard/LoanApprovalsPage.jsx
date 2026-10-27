import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Eye, Search, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import { loanService } from "../../services/loanService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency, formatDate, getStatusColor } from "../../lib/utils";

export const LoanApprovalsPage = () => {
  const queryClient = useQueryClient();
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [filters, setFilters] = useState({
    status: "pending",
    search: "",
    page: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-loans", filters],
    queryFn: () => loanService.getAllLoans(filters),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => loanService.approveLoan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
      toast.success("Loan approved successfully");
      setSelectedLoan(null);
      setActionType(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => loanService.rejectLoan(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
      toast.success("Loan rejected");
      setSelectedLoan(null);
      setActionType(null);
      setRejectionReason("");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed"),
  });

  const disburseMutation = useMutation({
    mutationFn: (id) => loanService.disburseLoan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loans"] });
      toast.success("Loan disbursed successfully");
      setSelectedLoan(null);
      setActionType(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed"),
  });

  const loans = data?.data || [];
  const stats = data?.stats || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Loan Approvals
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and process loan applications
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["pending", "approved", "active", "rejected"].map((status) => {
          const stat = stats.find((s) => s._id === status) || {
            count: 0,
            totalAmount: 0,
          };
          return (
            <Card key={status}>
              <CardContent>
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {status}
                </p>
                <p className="mt-1 text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatCurrency(stat.totalAmount)}
                </p>
              </CardContent>
            </Card>
          );
        })}
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
              title="No loan applications"
              description="There are no loans matching your filters"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Applicant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Loan Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {loans.map((loan) => (
                    <tr
                      key={loan._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium">
                            {loan.userId?.firstName} {loan.userId?.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {loan.userId?.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {loan.loanType} Loan
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {loan.loanNumber}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold">
                          {formatCurrency(loan.amount)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {loan.termMonths}m @ {loan.interestRate}%
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusColor(loan.status)}>
                          {loan.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLoan(loan);
                              setActionType("view");
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {loan.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedLoan(loan);
                                  setActionType("approve");
                                }}
                                className="text-success-500 hover:bg-success-50"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedLoan(loan);
                                  setActionType("reject");
                                }}
                                className="text-danger-500 hover:bg-danger-50"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {loan.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setActionType("disburse");
                              }}
                            >
                              Disburse
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={!!selectedLoan && !!actionType}
        onClose={() => {
          setSelectedLoan(null);
          setActionType(null);
          setRejectionReason("");
        }}
        title={
          actionType === "view"
            ? "Loan Details"
            : actionType === "approve"
              ? "Approve Loan"
              : actionType === "reject"
                ? "Reject Loan"
                : "Disburse Loan"
        }
      >
        {selectedLoan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Applicant</p>
                <p className="font-medium">
                  {selectedLoan.userId?.firstName}{" "}
                  {selectedLoan.userId?.lastName}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Loan Number</p>
                <p className="font-mono font-medium">
                  {selectedLoan.loanNumber}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Type</p>
                <p className="font-medium capitalize">
                  {selectedLoan.loanType}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Amount</p>
                <p className="font-semibold">
                  {formatCurrency(selectedLoan.amount)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Interest Rate</p>
                <p className="font-medium">{selectedLoan.interestRate}%</p>
              </div>
              <div>
                <p className="text-slate-500">Term</p>
                <p className="font-medium">{selectedLoan.termMonths} months</p>
              </div>
              <div>
                <p className="text-slate-500">EMI</p>
                <p className="font-medium">
                  {formatCurrency(selectedLoan.emiAmount)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Applied On</p>
                <p className="font-medium">
                  {formatDate(selectedLoan.applicationDate)}
                </p>
              </div>
            </div>

            {actionType === "reject" && (
              <div>
                <label className="label">Rejection Reason</label>
                <textarea
                  className="input min-h-[100px]"
                  placeholder="Provide a reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedLoan(null);
                  setActionType(null);
                  setRejectionReason("");
                }}
              >
                {actionType === "view" ? "Close" : "Cancel"}
              </Button>
              {actionType === "approve" && (
                <Button
                  className="flex-1"
                  isLoading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(selectedLoan._id)}
                >
                  Approve Loan
                </Button>
              )}
              {actionType === "reject" && (
                <Button
                  variant="danger"
                  className="flex-1"
                  isLoading={rejectMutation.isPending}
                  disabled={!rejectionReason.trim()}
                  onClick={() =>
                    rejectMutation.mutate({
                      id: selectedLoan._id,
                      reason: rejectionReason,
                    })
                  }
                >
                  Reject Loan
                </Button>
              )}
              {actionType === "disburse" && (
                <Button
                  className="flex-1"
                  isLoading={disburseMutation.isPending}
                  onClick={() => disburseMutation.mutate(selectedLoan._id)}
                >
                  Disburse Funds
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
