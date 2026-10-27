import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  FileText,
  CreditCard,
  Users,
  Settings,
  BarChart3,
  ShieldCheck,
  X,
  Receipt,
  FileCheck 
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import clsx from "clsx";

const customerNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Accounts", href: "/dashboard/accounts", icon: Wallet },
  { name: "Transfer", href: "/dashboard/transfer", icon: ArrowLeftRight },
  { name: "Transactions", href: "/dashboard/transactions", icon: FileText },
  { name: "Loans", href: "/dashboard/loans", icon: CreditCard },
  { name: "Statements", href: "/dashboard/statements", icon: Receipt },
];



const employeeNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "KYC Reviews", href: "/dashboard/kyc-reviews", icon: FileCheck }, // ← add
  { name: "Accounts", href: "/dashboard/accounts", icon: Wallet },
  { name: "Transactions", href: "/dashboard/transactions", icon: FileText },
  {
    name: "Loan Approvals",
    href: "/dashboard/loans/approvals",
    icon: ShieldCheck,
  },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
];
const adminNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/dashboard/admin/users", icon: Users },
  { name: "KYC Reviews", href: "/dashboard/kyc-reviews", icon: FileCheck }, // ← add this
  { name: "Accounts", href: "/dashboard/accounts", icon: Wallet },
  { name: "Transactions", href: "/dashboard/transactions", icon: FileText },
  { name: "Loans", href: "/dashboard/admin/loans", icon: CreditCard },
  {
    name: "Loan Approvals",
    href: "/dashboard/loans/approvals",
    icon: ShieldCheck,
  },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { name: "Security", href: "/dashboard/admin/security", icon: ShieldCheck },
  { name: "Settings", href: "/dashboard/admin/settings", icon: Settings },
];
export const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const getNavItems = () => {
    switch (user?.role) {
      case "admin":
        return adminNav;
      case "employee":
        return employeeNav;
      default:
        return customerNav;
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200 dark:border-slate-700 lg:hidden">
            <span className="font-bold text-slate-900 dark:text-white">
              Menu
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === "/dashboard"}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 p-4 text-white">
              <p className="text-xs font-medium opacity-90">Need help?</p>
              <p className="text-sm font-semibold mt-1">Contact Support</p>
         <a
  href="mailto:support@securebank.com?subject=Help%20Request&body=Hello%2C%20I%20need%20assistance%20with%3A%20"
  className="mt-3 block w-full text-center rounded-lg bg-white/20 py-1.5 text-xs font-medium hover:bg-white/30 transition-colors"
>
  Get Help
</a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
