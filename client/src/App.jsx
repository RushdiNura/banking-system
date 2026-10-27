import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

// Contexts
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";

// Route guards
import { ProtectedRoute, PublicRoute } from "./components/auth/ProtectedRoute";

// Layout
import { DashboardLayout } from "./components/layout/DashboardLayout";

// Auth pages
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";

// Dashboard pages
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { AdminDashboardPage } from "./pages/dashboard/AdminDashboardPage";
import { AccountsPage } from "./pages/dashboard/AccountsPage";
import { AccountDetailPage } from "./pages/dashboard/AccountDetailPage";
import { TransferPage } from "./pages/dashboard/TransferPage";
import { TransactionsPage } from "./pages/dashboard/TransactionsPage";
import { LoansPage } from "./pages/dashboard/LoansPage";
import { LoanDetailPage } from "./pages/dashboard/LoanDetailPage";
import { ApplyLoanPage } from "./pages/dashboard/ApplyLoanPage";
import { ProfilePage } from "./pages/dashboard/ProfilePage";
import { SettingsPage } from "./pages/dashboard/SettingsPage";
import { StatementsPage } from "./pages/dashboard/StatementsPage";
import { LoanApprovalsPage } from "./pages/dashboard/LoanApprovalsPage";
import { CustomersPage } from "./pages/dashboard/CustomersPage";
import { ReportsPage } from "./pages/dashboard/ReportsPage";
import { AdminUsersPage } from "./pages/dashboard/AdminUsersPage";
import { NotificationsPage } from "./pages/dashboard/NotificationsPage";
import { KYCReviewsPage } from "./pages/dashboard/KYCReviewsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Admin-only pages
import { AdminLoansPage } from "./pages/dashboard/admin/AdminLoansPage";
import { AdminSettingsPage } from "./pages/dashboard/admin/AdminSettingsPage";
import { AdminSecurityPage } from "./pages/dashboard/admin/AdminSecurityPage";
import { useAuth } from './contexts/AuthContext';

const AdminOrDashboard = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminDashboardPage /> : <DashboardPage />;
};
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <RegisterPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PublicRoute>
                      <ForgotPasswordPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/reset-password/:token"
                  element={
                    <PublicRoute>
                      <ResetPasswordPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/verify-email/:token"
                  element={<VerifyEmailPage />}
                />

                {/* Protected dashboard routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                 <Route
  index
  element={
    <ProtectedRoute>
      <AdminOrDashboard />
    </ProtectedRoute>
  }
/>
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="accounts/:id" element={<AccountDetailPage />} />
                  <Route path="transfer" element={<TransferPage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="statements" element={<StatementsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="loans" element={<LoansPage />} />
                  <Route path="loans/apply" element={<ApplyLoanPage />} />
                  <Route path="loans/:id" element={<LoanDetailPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />

                  {/* Employee + Admin routes */}
                  <Route
                    path="loans/approvals"
                    element={
                      <ProtectedRoute roles={["employee", "admin"]}>
                        <LoanApprovalsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="customers"
                    element={
                      <ProtectedRoute roles={["employee", "admin"]}>
                        <CustomersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute roles={["employee", "admin"]}>
                        <ReportsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="kyc-reviews"
                    element={
                      <ProtectedRoute roles={["employee", "admin"]}>
                        <KYCReviewsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin-only routes */}
                  <Route
                    path="admin/users"
                    element={
                      <ProtectedRoute roles={["admin"]}>
                        <AdminUsersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="admin/loans"
                    element={
                      <ProtectedRoute roles={["admin"]}>
                        <AdminLoansPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="admin/settings"
                    element={
                      <ProtectedRoute roles={["admin"]}>
                        <AdminSettingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="admin/security"
                    element={
                      <ProtectedRoute roles={["admin"]}>
                        <AdminSecurityPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>

              <Toaster
                position="top-right"
                toastOptions={{
                  className: "text-sm",
                  duration: 4000,
                  style: { borderRadius: "10px" },
                  success: {
                    iconTheme: { primary: "#22c55e", secondary: "white" },
                  },
                  error: {
                    iconTheme: { primary: "#ef4444", secondary: "white" },
                  },
                }}
              />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
