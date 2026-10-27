import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Clock,
  User as UserIcon,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { kycService } from "../../services/kycService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatDate, getInitials } from "../../lib/utils";

export const KYCReviewsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null); // 'approve' | 'reject'
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["kyc-pending"],
    queryFn: () => kycService.getPending(),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const reviewMutation = useMutation({
    mutationFn: ({ userId, decision, reason }) =>
      kycService.review(userId, decision, reason),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kyc-pending"] });
      toast.success(
        variables.decision === "approve"
          ? "KYC approved — user notified"
          : "KYC rejected — user notified",
      );
      setSelected(null);
      setAction(null);
      setReason("");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Review failed"),
  });

  const submissions = (data?.data || []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          KYC Reviews
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and approve customer KYC submissions
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning-50 dark:bg-warning-700/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending</p>
                <p className="text-lg font-bold">{submissions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent>
          <Input
            icon={Search}
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : submissions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No pending KYC submissions"
              description="New submissions will appear here for review"
            />
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {submissions.map((sub) => (
                <div
                  key={sub._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {getInitials(sub.firstName, sub.lastName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {sub.firstName} {sub.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {sub.email}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Submitted {formatDate(sub.updatedAt || sub.createdAt)} ·{" "}
                        {sub.documents?.length || 0} document
                        {(sub.documents?.length || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={Eye}
                      onClick={() => {
                        setSelected(sub);
                        setAction("view");
                      }}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-success-500 hover:bg-success-50"
                      leftIcon={CheckCircle}
                      onClick={() => {
                        setSelected(sub);
                        setAction("approve");
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger-500 hover:bg-danger-50"
                      leftIcon={XCircle}
                      onClick={() => {
                        setSelected(sub);
                        setAction("reject");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review modal */}
      <Modal
        isOpen={!!selected && !!action}
        onClose={() => {
          setSelected(null);
          setAction(null);
          setReason("");
        }}
        title={
          action === "view"
            ? "KYC Details"
            : action === "approve"
              ? "Approve KYC"
              : "Reject KYC"
        }
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Name</p>
                <p className="font-medium">
                  {selected.firstName} {selected.lastName}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="font-medium">{selected.email}</p>
              </div>
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-medium">{selected.phone}</p>
              </div>
              <div>
                <p className="text-slate-500">Submitted</p>
                <p className="font-medium">
                  {formatDate(selected.updatedAt || selected.createdAt)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                Documents ({selected.documents?.length || 0})
              </p>
              {selected.documents?.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {selected.documents.map((doc, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-sm">
                            {doc.originalName || `Document ${i + 1}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {doc.type?.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 text-sm hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {action === "reject" && (
              <div>
                <label className="label">Rejection Reason</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Explain why the KYC was rejected..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelected(null);
                  setAction(null);
                  setReason("");
                }}
              >
                Cancel
              </Button>
              {action === "approve" && (
                <Button
                  className="flex-1"
                  isLoading={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({
                      userId: selected._id,
                      decision: "approve",
                    })
                  }
                >
                  Approve KYC
                </Button>
              )}
              {action === "reject" && (
                <Button
                  variant="danger"
                  className="flex-1"
                  isLoading={reviewMutation.isPending}
                  disabled={!reason.trim()}
                  onClick={() =>
                    reviewMutation.mutate({
                      userId: selected._id,
                      decision: "reject",
                      reason,
                    })
                  }
                >
                  Reject KYC
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
