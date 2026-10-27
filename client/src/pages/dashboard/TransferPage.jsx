import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send, CheckCircle, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { accountService } from "../../services/accountService";
import { transactionService } from "../../services/transactionService";
import { transferSchema } from "../../lib/validations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import {
  formatCurrency,
  formatAccountNumber,
  generateIdempotencyKey,
} from "../../lib/utils";

export const TransferPage = () => {
  const navigate = useNavigate();
  const [transferResult, setTransferResult] = useState(null);

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAccounts({ status: "active" }),
  });

  const accounts = accountsData?.data || [];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountNumber: "",
      amount: 0,
      description: "",
      saveBeneficiary: false,
    },
  });

  const fromAccountId = watch("fromAccountId");
  const selectedAccount = accounts.find((a) => a._id === fromAccountId);

  const transferMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }) =>
      transactionService.transfer(data, idempotencyKey),
    onSuccess: (response) => {
      setTransferResult(response.data);
      toast.success("Transfer completed successfully!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Transfer failed");
    },
  });

  const onSubmit = (data) => {
    const idempotencyKey = generateIdempotencyKey();
    transferMutation.mutate({ data, idempotencyKey });
  };

  if (transferResult) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <Card>
          <CardContent className="text-center py-8">
            <div className="mx-auto h-16 w-16 rounded-full bg-success-50 dark:bg-success-700/20 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-success-500" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              Transfer Successful
            </h2>
            <p className="mt-2 text-slate-500">
              Your transfer has been processed successfully
            </p>

            <div className="mt-6 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-4 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount</span>
                <span className="font-semibold">
                  {formatCurrency(transferResult.amount)}
                </span>
              </div>
              {transferResult.fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fee</span>
                  <span className="font-semibold">
                    {formatCurrency(transferResult.fee)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Recipient</span>
                <span className="font-mono text-xs">
                  {transferResult.recipient?.accountNumber}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Reference</span>
                <span className="font-mono text-xs">
                  {transferResult.referenceNumber}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">New Balance</span>
                <span className="font-semibold">
                  {formatCurrency(transferResult.newBalance)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setTransferResult(null);
                  window.location.reload();
                }}
              >
                New Transfer
              </Button>
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Funds</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Send money to any account instantly
          </p>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <Alert variant="warning">
              You need an active account to make transfers.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">From Account</label>
                <select className="input" {...register("fromAccountId")}>
                  <option value="">Select source account</option>
                  {accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.accountType} •{" "}
                      {formatAccountNumber(acc.accountNumber)} •{" "}
                      {formatCurrency(acc.balance, acc.currency)}
                    </option>
                  ))}
                </select>
                {errors.fromAccountId && (
                  <p className="mt-1.5 text-xs text-danger-500">
                    {errors.fromAccountId.message}
                  </p>
                )}
                {selectedAccount && (
                  <p className="mt-2 text-xs text-slate-500">
                    Available balance:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatCurrency(
                        selectedAccount.balance,
                        selectedAccount.currency,
                      )}
                    </span>
                  </p>
                )}
              </div>

              <Input
                label="Recipient Account Number"
                placeholder="10-digit account number"
                maxLength={10}
                error={errors.toAccountNumber}
                {...register("toAccountNumber")}
              />

              <Input
                label="Amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                error={errors.amount}
                {...register("amount", { valueAsNumber: true })}
              />

              <Input
                label="Description (Optional)"
                placeholder="What's this transfer for?"
                error={errors.description}
                {...register("description")}
              />

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="saveBeneficiary"
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  {...register("saveBeneficiary")}
                />
                <label
                  htmlFor="saveBeneficiary"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  Save recipient as beneficiary
                </label>
              </div>

              <Alert variant="info">
                A 0.1% fee applies for transfers to accounts of other customers.
                Internal transfers are free.
              </Alert>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={transferMutation.isPending}
                leftIcon={Send}
              >
                Send Money
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
