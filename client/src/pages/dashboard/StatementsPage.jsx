import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import { accountService } from "../../services/accountService";
import { exportService } from "../../services/exportService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { formatCurrency } from "../../lib/utils";

export const StatementsPage = () => {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAccounts(),
  });

  const accounts = accountsData?.data || [];

  const handleDownload = async () => {
    if (!selectedAccount) {
      toast.error("Please select an account");
      return;
    }

    setLoading(true);
    try {
      const params = { accountId: selectedAccount };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      await exportService.transactions(params);
      toast.success("Statement downloaded");
    } catch (error) {
      console.error("Statement download error:", error);
      toast.error(
        error.response?.data?.message || "Failed to download statement"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Account Statements
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Download detailed statements for your accounts as CSV
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Generate Statement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="label">Select Account</label>
            <select
              className="input"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="">Choose an account</option>
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.accountType} • {acc.accountNumber} •{" "}
                  {formatCurrency(acc.balance, acc.currency)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date (Optional)"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date (Optional)"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-4 text-sm">
            <p className="text-slate-500">
              Your statement will include all completed transactions within the
              selected date range. If no dates are specified, all transactions
              will be included.
            </p>
          </div>

          <Button
            className="w-full"
            leftIcon={Download}
            onClick={handleDownload}
            isLoading={loading}
            disabled={!selectedAccount}
          >
            Download Statement (CSV)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500 space-y-2">
          <p>• Leave dates blank to include all transactions</p>
          <p>• CSV format is best for spreadsheets and data analysis</p>
          <p>• Statements include opening and closing balances</p>
        </CardContent>
      </Card>
    </div>
  );
};