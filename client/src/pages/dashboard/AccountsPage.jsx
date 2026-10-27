import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Wallet,
  CreditCard,
  TrendingUp,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { accountService } from "../../services/accountService";
import { createAccountSchema } from "../../lib/validations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import {
  formatCurrency,
  formatAccountNumber,
  getStatusColor,
} from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";

const accountTypeMeta = {
  savings: { label: "Savings", icon: TrendingUp, color: "success" },
  checking: { label: "Checking", icon: Wallet, color: "primary" },
  fixed_deposit: { label: "Fixed Deposit", icon: Lock, color: "warning" },
  recurring_deposit: {
    label: "Recurring Deposit",
    icon: CreditCard,
    color: "primary",
  },
};

export const AccountsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAccounts({ limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: accountService.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account created successfully");
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create account");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      accountType: "savings",
      currency: "USD",
      initialDeposit: 0,
    },
  });

  const accountType = watch("accountType");
  const minDeposits = {
    savings: 100,
    checking: 50,
    fixed_deposit: 1000,
    recurring_deposit: 500,
  };

  const onSubmit = (data) => createMutation.mutate(data);

  const accounts = data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage all your bank accounts in one place
          </p>
        </div>
        {user?.kycStatus === "verified" && (
          <Button leftIcon={Plus} onClick={() => setIsModalOpen(true)}>
            Open New Account
          </Button>
        )}
      </div>

      {user?.kycStatus !== "verified" && (
        <div className="rounded-lg border border-warning-500/20 bg-warning-50 dark:bg-warning-700/10 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-warning-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning-700 dark:text-warning-500">
              KYC Verification Required
            </p>
            <p className="text-sm text-warning-600 dark:text-warning-400 mt-1">
              Complete your KYC verification to open new accounts.
            </p>
            <Link to="/dashboard/profile" className="mt-2 inline-block">
              <Button variant="outline" size="sm">
                Complete KYC
              </Button>
            </Link>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            description="Open your first account to start managing your finances"
            action={
              <Button leftIcon={Plus} onClick={() => setIsModalOpen(true)}>
                Open Account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const meta =
              accountTypeMeta[account.accountType] || accountTypeMeta.savings;
            const Icon = meta.icon;
            return (
              <Link key={account._id} to={`/dashboard/accounts/${account._id}`}>
                <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {meta.label}
                          </p>
                          <p className="text-xs text-slate-500">
                            {account.currency}
                          </p>
                        </div>
                      </div>
                      <Badge variant={getStatusColor(account.status)}>
                        {account.status}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs text-slate-500">
                        Available Balance
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(account.balance, account.currency)}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500">Account Number</p>
                        <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                          {formatAccountNumber(account.accountNumber)}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Open New Account"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Account Type</label>
            <select className="input" {...register("accountType")}>
              <option value="savings">Savings Account (2.5% interest)</option>
              <option value="checking">Checking Account (0.1% interest)</option>
              <option value="fixed_deposit">
                Fixed Deposit (5.5% interest)
              </option>
              <option value="recurring_deposit">
                Recurring Deposit (4.5% interest)
              </option>
            </select>
          </div>

          <div>
            <label className="label">Currency</label>
            <select className="input" {...register("currency")}>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="INR">INR - Indian Rupee</option>
            </select>
          </div>

          <Input
            label="Initial Deposit"
            type="number"
            step="0.01"
            placeholder={`Minimum: ${minDeposits[accountType] || 0}`}
            error={errors.initialDeposit}
            {...register("initialDeposit", { valueAsNumber: true })}
          />
          <p className="text-xs text-slate-500 -mt-3">
            Minimum initial deposit:{" "}
            {formatCurrency(minDeposits[accountType] || 0)}
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={createMutation.isPending}
            >
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
