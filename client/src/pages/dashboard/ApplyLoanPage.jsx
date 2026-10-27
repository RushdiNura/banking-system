import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Calculator } from "lucide-react";
import toast from "react-hot-toast";
import { accountService } from "../../services/accountService";
import { loanService } from "../../services/loanService";
import { loanApplicationSchema } from "../../lib/validations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { formatCurrency } from "../../lib/utils";

const interestRates = {
  personal: 12.5,
  home: 7.5,
  auto: 9.0,
  education: 8.5,
  business: 14.0,
  gold: 10.5,
};

const calculateEMI = (principal, annualRate, months) => {
  const monthlyRate = annualRate / 12 / 100;
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(emi * 100) / 100;
};

export const ApplyLoanPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [emiDetails, setEmiDetails] = useState(null);

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
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      loanType: "personal",
      amount: 10000,
      termMonths: 12,
      purpose: "",
      accountId: "",
    },
  });

  const loanType = watch("loanType");
  const amount = watch("amount");
  const termMonths = watch("termMonths");

  // Auto-calculate EMI when inputs change
  useState(() => {
    if (amount > 0 && termMonths > 0) {
      const rate = interestRates[loanType];
      const emi = calculateEMI(amount, rate, termMonths);
      const totalAmount = emi * termMonths;
      setEmiDetails({
        emi,
        totalInterest: totalAmount - amount,
        totalAmount,
      });
    }
  });

  const mutation = useMutation({
    mutationFn: loanService.applyForLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Loan application submitted successfully!");
      navigate("/dashboard/loans");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Application failed");
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Link
        to="/dashboard/loans"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to loans
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Apply for a Loan</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Fill in the details below to apply for a loan
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Loan Type</label>
              <select className="input" {...register("loanType")}>
                <option value="personal">Personal Loan (12.5%)</option>
                <option value="home">Home Loan (7.5%)</option>
                <option value="auto">Auto Loan (9.0%)</option>
                <option value="education">Education Loan (8.5%)</option>
                <option value="business">Business Loan (14.0%)</option>
                <option value="gold">Gold Loan (10.5%)</option>
              </select>
            </div>

            <Input
              label="Loan Amount"
              type="number"
              step="100"
              placeholder="10000"
              error={errors.amount}
              {...register("amount", { valueAsNumber: true })}
            />

            <Input
              label="Term (Months)"
              type="number"
              placeholder="12"
              error={errors.termMonths}
              {...register("termMonths", { valueAsNumber: true })}
            />

            <div>
              <label className="label">Disbursement Account</label>
              <select className="input" {...register("accountId")}>
                <option value="">Select account</option>
                {accounts.map((acc) => (
                  <option key={acc._id} value={acc._id}>
                    {acc.accountType} • {acc.accountNumber}
                  </option>
                ))}
              </select>
              {errors.accountId && (
                <p className="mt-1.5 text-xs text-danger-500">
                  {errors.accountId.message}
                </p>
              )}
            </div>

            <Input
              label="Purpose (Optional)"
              placeholder="What's this loan for?"
              error={errors.purpose}
              {...register("purpose")}
            />

            {/* EMI Calculator */}
            {amount > 0 && termMonths > 0 && (
              <div className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-4 w-4 text-primary-600" />
                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                    EMI Calculation
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Monthly EMI
                    </p>
                    <p className="text-lg font-bold text-primary-700 dark:text-primary-300">
                      {formatCurrency(
                        calculateEMI(
                          amount,
                          interestRates[loanType],
                          termMonths,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Interest Rate
                    </p>
                    <p className="text-lg font-bold text-primary-700 dark:text-primary-300">
                      {interestRates[loanType]}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Total Interest
                    </p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {formatCurrency(
                        calculateEMI(
                          amount,
                          interestRates[loanType],
                          termMonths,
                        ) *
                          termMonths -
                          amount,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Total Amount
                    </p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {formatCurrency(
                        calculateEMI(
                          amount,
                          interestRates[loanType],
                          termMonths,
                        ) * termMonths,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/dashboard/loans")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={mutation.isPending}
              >
                Submit Application
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
