import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Eye } from "lucide-react";
import api from "../../lib/api";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { getInitials, formatDate, getStatusColor } from "../../lib/utils";

export const CustomersPage = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", { search, page }],
    queryFn: () =>
      api
        .get("/users", {
          params: { role: "customer", search, page, limit: 20 },
        })
        .then((r) => r.data),
  });

  const customers = data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Customers
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage and view customer information
        </p>
      </div>

      <Card>
        <CardContent>
          <Input
            icon={Search}
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers found"
              description="Try a different search term"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      KYC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {customers.map((c) => (
                    <tr
                      key={c._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold">
                            {getInitials(c.firstName, c.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {c.firstName} {c.lastName}
                            </p>
                            <p className="text-xs text-slate-500">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {c.phone}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusColor(c.kycStatus)}>
                          {c.kycStatus}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelected(c)}
                          className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Eye className="h-4 w-4 text-slate-400" />
                        </button>
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
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Customer Details"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
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
                <p className="text-slate-500">KYC Status</p>
                <Badge variant={getStatusColor(selected.kycStatus)}>
                  {selected.kycStatus}
                </Badge>
              </div>
              <div>
                <p className="text-slate-500">Joined</p>
                <p className="font-medium">{formatDate(selected.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <Badge variant={selected.isActive ? "success" : "danger"}>
                  {selected.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
