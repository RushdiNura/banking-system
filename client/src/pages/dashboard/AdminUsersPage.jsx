import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, Ban, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../lib/api";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { getInitials, formatDate, getStatusColor } from "../../lib/utils";

export const AdminUsersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [loadingId, setLoadingId] = useState(null); // ← tracks which row is loading

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", { search, role, page }],
    queryFn: () =>
      api
        .get("/users", { params: { search, role, page, limit: 20 } })
        .then((r) => r.data),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }) =>
      api.put(`/users/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated");
      setLoadingId(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update user");
      setLoadingId(null);
    },
  });

  const handleToggle = (user) => {
    setLoadingId(user._id);
    toggleStatusMutation.mutate({
      id: user._id,
      isActive: !user.isActive,
    });
  };

  const users = data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          User Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage all system users and their permissions
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                icon={Search}
                placeholder="Search users..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="input sm:w-48"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              <option value="customer">Customer</option>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      KYC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {users.map((u) => (
                    <tr
                      key={u._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold">
                            {getInitials(u.firstName, u.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            u.role === "admin"
                              ? "danger"
                              : u.role === "employee"
                                ? "warning"
                                : "primary"
                          }
                        >
                          <Shield className="h-3 w-3" />
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusColor(u.kycStatus)}>
                          {u.kycStatus}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant={u.isActive ? "outline" : "primary"}
                          size="sm"
                          leftIcon={u.isActive ? Ban : CheckCircle}
                          isLoading={loadingId === u._id}
                          disabled={!!loadingId && loadingId !== u._id}
                          onClick={() => handleToggle(u)}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
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
