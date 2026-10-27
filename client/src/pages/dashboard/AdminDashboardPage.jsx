import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Wallet,
  TrendingUp,
  CreditCard,
  FileCheck,
  Shield,
  Activity,
  ArrowUpRight,
  Clock,
  DollarSign,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { loanService } from '../../services/loanService';
import { transactionService } from '../../services/transactionService';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getInitials,
  getStatusColor,
} from '../../lib/utils';

const COLOR_MAP = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-900/20', text: 'text-primary-600 dark:text-primary-400' },
  success: { bg: 'bg-success-50 dark:bg-success-700/20', text: 'text-success-500 dark:text-success-400' },
  warning: { bg: 'bg-warning-50 dark:bg-warning-700/20', text: 'text-warning-500 dark:text-warning-400' },
  danger:  { bg: 'bg-danger-50 dark:bg-danger-700/20', text: 'text-danger-500 dark:text-danger-400' },
};

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary', href }) => {
  const colors = COLOR_MAP[color] || COLOR_MAP.primary;
  const content = (
    <Card className={href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}
          >
            <Icon className={`h-6 w-6 ${colors.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link to={href}>{content}</Link> : content;
};

export const AdminDashboardPage = () => {
  const { user } = useAuth();

  // Fetch pending KYC
  const { data: kycData } = useQuery({
    queryKey: ['kyc-pending'],
    queryFn: () => api.get('/kyc/pending').then((r) => r.data),
  });

  // Fetch pending loans
  const { data: loansData } = useQuery({
    queryKey: ['admin-loans', { status: 'pending' }],
    queryFn: () => loanService.getAllLoans({ status: 'pending', limit: 100 }),
  });

  // Fetch users
  const { data: usersData } = useQuery({
    queryKey: ['admin-users', 'recent'],
    queryFn: () =>
      api.get('/users', { params: { limit: 5, sort: '-createdAt' } }).then((r) => r.data),
  });

  // Fetch all users count
  const { data: allUsersData } = useQuery({
    queryKey: ['admin-users', 'count'],
    queryFn: () => api.get('/users', { params: { limit: 1 } }).then((r) => r.data),
  });

  // Fetch all accounts
  const { data: accountsData } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: () =>
      api.get('/accounts', { params: { limit: 100 } }).then((r) => r.data),
  });

  // Fetch transaction stats
  const { data: txStats } = useQuery({
    queryKey: ['transactions', 'stats', 'admin'],
    queryFn: () => transactionService.getStats({ period: '30d' }),
  });

  // Fetch online users
  const { data: onlineData } = useQuery({
    queryKey: ['admin', 'online'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30000,
  });

  const pendingKYC = kycData?.data || [];
  const pendingLoans = loansData?.data || [];
  const recentUsers = usersData?.data || [];
  const totalUsers = allUsersData?.total || 0;
  const accounts = accountsData?.data || [];
  const onlineUsers = onlineData?.data?.onlineUsers || 0;

  // Compute stats
  const totalDeposits = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalAccounts = accountsData?.total || accounts.length;
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;

  // Chart data
  const dailyTrend = (txStats?.data?.dailyTrend || [])
    .slice(-14)
    .map((d) => ({
      date: new Date(d._id).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      amount: d.totalAmount,
      count: d.totalCount,
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {user?.firstName}. Here's the system overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/kyc-reviews">
            <Button variant="outline" leftIcon={FileCheck}>
              Review KYC
            </Button>
          </Link>
          <Link to="/dashboard/loans/approvals">
            <Button leftIcon={CreditCard}>Approve Loans</Button>
          </Link>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          subtitle={`${onlineUsers} online now`}
          icon={Users}
          color="primary"
          href="/dashboard/admin/users"
        />
        <StatCard
          title="Total Accounts"
          value={totalAccounts}
          subtitle={`${activeAccounts} active`}
          icon={Wallet}
          color="success"
          href="/dashboard/accounts"
        />
        <StatCard
          title="Total Deposits"
          value={formatCurrency(totalDeposits)}
          subtitle="Across all accounts"
          icon={DollarSign}
          color="warning"
        />
        <StatCard
          title="System Health"
          value="Operational"
          subtitle="All services running"
          icon={Activity}
          color="success"
        />
      </div>

      {/* Pending actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/dashboard/kyc-reviews">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-warning-200 dark:border-warning-800">
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-warning-50 dark:bg-warning-700/20 flex items-center justify-center">
                    <FileCheck className="h-6 w-6 text-warning-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium">
                      Pending KYC
                    </p>
                    <p className="text-2xl font-bold">{pendingKYC.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-primary-600 text-sm font-medium">
                  Review <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/dashboard/loans/approvals">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-warning-200 dark:border-warning-800">
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-medium">
                      Pending Loans
                    </p>
                    <p className="text-2xl font-bold">{pendingLoans.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-primary-600 text-sm font-medium">
                  Approve <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transaction Volume</CardTitle>
              <Badge variant="primary">Last 14 days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorAmount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No transactions yet"
                description="System activity will appear here"
              />
            )}
          </CardContent>
        </Card>

        {/* Recent registrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Users</CardTitle>
              <Link to="/dashboard/admin/users">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <EmptyState icon={Users} title="No users yet" />
            ) : (
              <div className="space-y-3">
                {recentUsers.map((u) => (
                  <div key={u._id} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {getInitials(u.firstName, u.lastName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {u.email}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={getStatusColor(u.kycStatus)}>
                        {u.kycStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending KYC preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Awaiting KYC Review</CardTitle>
              {pendingKYC.length > 0 && (
                <Badge variant="warning">{pendingKYC.length} pending</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingKYC.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="All caught up"
                description="No pending KYC submissions"
              />
            ) : (
              <div className="space-y-3">
                {pendingKYC.slice(0, 4).map((u) => (
                  <div
                    key={u._id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Submitted {formatRelativeTime(u.updatedAt)}
                      </p>
                    </div>
                    <Link to="/dashboard/kyc-reviews">
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </Link>
                  </div>
                ))}
                {pendingKYC.length > 4 && (
                  <Link
                    to="/dashboard/kyc-reviews"
                    className="block text-center text-xs text-primary-600 hover:underline pt-2"
                  >
                    +{pendingKYC.length - 4} more
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending loans preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Awaiting Loan Approval</CardTitle>
              {pendingLoans.length > 0 && (
                <Badge variant="primary">{pendingLoans.length} pending</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingLoans.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="All caught up"
                description="No pending loan applications"
              />
            ) : (
              <div className="space-y-3">
                {pendingLoans.slice(0, 4).map((loan) => (
                  <div
                    key={loan._id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {loan.userId?.firstName} {loan.userId?.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(loan.amount)} · {loan.loanType}
                      </p>
                    </div>
                    <Link to="/dashboard/loans/approvals">
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </Link>
                  </div>
                ))}
                {pendingLoans.length > 4 && (
                  <Link
                    to="/dashboard/loans/approvals"
                    className="block text-center text-xs text-primary-600 hover:underline pt-2"
                  >
                    +{pendingLoans.length - 4} more
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick admin links */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'User Management',
                href: '/dashboard/admin/users',
                icon: Users,
              },
              {
                label: 'All Loans',
                href: '/dashboard/admin/loans',
                icon: CreditCard,
              },
              {
                label: 'Reports',
                href: '/dashboard/reports',
                icon: TrendingUp,
              },
              {
                label: 'Security',
                href: '/dashboard/admin/security',
                icon: Shield,
              },
            ].map((tool) => (
              <Link key={tool.href} to={tool.href}>
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors text-center">
                  <tool.icon className="h-6 w-6 text-primary-600" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {tool.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};