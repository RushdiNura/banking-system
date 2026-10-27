import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  Percent,
  TrendingUp,
  CheckCircle,
  Clock,
  DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";
import { loanService } from "../../services/loanService";
import { accountService } from "../../services/accountService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { Modal } from "../../components/ui/Modal";
import { formatCurrency, formatDate, getStatusColor } from "../../lib/utils";

export const LoanDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    accountId: "",
    amount: "",
  });

  const { data: loanData, isLoading } = useQuery({
    queryKey: ["loan", id],
    queryFn: () => loanService.getLoan(id),
  });

  const { data: emiData } = useQuery({
    queryKey: ["loan-emi", id],
    queryFn: () => loanService.getEMISchedule(id),
    enabled: !!loanData?.data,
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAccounts({ status: "active" }),
  });

  const accounts = accountsData?.data || [];

  const paymentMutation = useMutation({
    mutationFn: (data) => loanService.makeLoanPayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan", id] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Payment successful");
      setIsPayModalOpen(false);
      setPaymentData({ accountId: "", amount: "" });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Payment failed");
    },
  });

  const loan = loanData?.data;
  const emiSchedule = emiData?.data?.schedule || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Loan not found</p>
        <Button className="mt-4" onClick={() => navigate("/dashboard/loans")}>
          Back to Loans
        </Button>
      </div>
    );
  }

  const paidInstallments = loan.paymentHistory?.length || 0;
  const totalPaid =
    loan.paymentHistory?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const progress = (paidInstallments / loan.termMonths) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/dashboard/loans"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to loans
      </Link>

      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 capitalize">
                    {loan.loanType} Loan
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {loan.loanNumber}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Badge variant={getStatusColor(loan.status)}>
                  {loan.status}
                </Badge>
              </div>
            </div>

            {loan.status === "active" && (
              <Button
                onClick={() => {
                  setPaymentData({
                    accountId: accounts[0]?._id || "",
                    amount: loan.emiAmount.toString(),
                  });
                  setIsPayModalOpen(true);
                }}
              >
                Make Payment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-slate-500">
              <DollarSign className="h-4 w-4" />
              <p className="text-xs font-medium">Loan Amount</p>
            </div>
            <p className="mt-2 text-lg font-bold">
              {formatCurrency(loan.amount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-slate-500">
              <Percent className="h-4 w-4" />
              <p className="text-xs font-medium">Interest Rate</p>
            </div>
            <p className="mt-2 text-lg font-bold">{loan.interestRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar className="h-4 w-4" />
              <p className="text-xs font-medium">Term</p>
            </div>
            <p className="mt-2 text-lg font-bold">{loan.termMonths} months</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="h-4 w-4" />
              <p className="text-xs font-medium">Monthly EMI</p>
            </div>
            <p className="mt-2 text-lg font-bold">
              {formatCurrency(loan.emiAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {loan.status === "active" && (
        <Card>
          <CardHeader>
            <CardTitle>Repayment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">
                {paidInstallments} of {loan.termMonths} installments paid
              </span>
              <span className="font-semibold">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Total Paid</p>
                <p className="font-semibold">{formatCurrency(totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Remaining</p>
                <p className="font-semibold">
                  {formatCurrency(Math.max(0, loan.totalAmount - totalPaid))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>EMI Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    EMI
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    Principal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    Interest
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {emiSchedule.map((emi) => (
                  <tr key={emi.installmentNumber}>
                    <td className="px-6 py-3 text-sm">
                      {emi.installmentNumber}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {formatDate(emi.dueDate)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium">
                      {formatCurrency(emi.emiAmount)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      {formatCurrency(emi.principalComponent)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      {formatCurrency(emi.interestComponent)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      {formatCurrency(emi.remainingPrincipal)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {emi.isPaid ? (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3" /> Paid
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Make Loan Payment"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Pay from Account</label>
            <select
              className="input"
              value={paymentData.accountId}
              onChange={(e) =>
                setPaymentData({ ...paymentData, accountId: e.target.value })
              }
            >
              <option value="">Select account</option>
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.accountType} • {acc.accountNumber} •{" "}
                  {formatCurrency(acc.balance)}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Payment Amount"
            type="number"
            step="0.01"
            value={paymentData.amount}
            onChange={(e) =>
              setPaymentData({ ...paymentData, amount: e.target.value })
            }
          />

          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 text-sm">
            <p className="text-slate-500">Suggested EMI amount:</p>
            <p className="font-semibold mt-1">
              {formatCurrency(loan.emiAmount)}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsPayModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              isLoading={paymentMutation.isPending}
              disabled={!paymentData.accountId || !paymentData.amount}
              onClick={() =>
                paymentMutation.mutate({
                  accountId: paymentData.accountId,
                  amount: parseFloat(paymentData.amount),
                })
              }
            >
              Pay Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
