import { useQuery } from "@tanstack/react-query";
import { Shield, Clock, Users, Activity } from "lucide-react";
import api from "../../../lib/api";
import { Card, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";

export const AdminSecurityPage = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-security-stats"],
    queryFn: () => api.get("/admin/stats").then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: users } = useQuery({
    queryKey: ["admin-security-users"],
    queryFn: () =>
      api
        .get("/users", { params: { limit: 5, sort: "-lastLogin" } })
        .then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Security & Monitoring
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          System health and recent activity
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success-50 dark:bg-success-700/20 flex items-center justify-center">
                <Activity className="h-5 w-5 text-success-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Online Users</p>
                <p className="text-lg font-bold">
                  {stats?.data?.onlineUsers || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Users</p>
                <p className="text-lg font-bold">{users?.total || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning-50 dark:bg-warning-700/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-warning-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Auth Status</p>
                <p className="text-lg font-bold text-success-500">Secure</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Recent Logins
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {(users?.data || []).map((u) => (
              <div
                key={u._id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <Badge variant={u.isActive ? "success" : "danger"}>
                  {u.isActive ? "active" : "inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
