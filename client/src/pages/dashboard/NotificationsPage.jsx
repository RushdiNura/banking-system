import { Link } from "react-router-dom";
import {
  Bell,
  Wallet,
  CreditCard,
  AlertTriangle,
  Info,
  Trash2,
  CheckCheck,
  Circle,
} from "lucide-react";
import { useNotifications } from "../../contexts/NotificationContext";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatRelativeTime } from "../../lib/utils";
import clsx from "clsx";

const iconByType = {
  transaction: Wallet,
  loan: CreditCard,
  alert: AlertTriangle,
  system: Info,
};

const colorByVariant = {
  success: "text-success-500 bg-success-50 dark:bg-success-700/20",
  error: "text-danger-500 bg-danger-50 dark:bg-danger-700/20",
  warning: "text-warning-500 bg-warning-50 dark:bg-warning-700/20",
  info: "text-primary-500 bg-primary-50 dark:bg-primary-900/20",
};

export const NotificationsPage = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotifications();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${
                  unreadCount > 1 ? "s" : ""
                }`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={CheckCheck}
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={Trash2}
              onClick={clearAll}
            >
              Clear all
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You'll see real-time notifications here when events occur"
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {notifications.map((notif) => {
                const Icon = iconByType[notif.type] || Info;
                const colorClass =
                  colorByVariant[notif.variant] || colorByVariant.info;

                const inner = (
                  <div
                    className={clsx(
                      "flex gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer",
                      !notif.read && "bg-primary-50/40 dark:bg-primary-900/10",
                    )}
                    onClick={() => !notif.read && markAsRead(notif.id)}
                  >
                    <div
                      className={clsx(
                        "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center",
                        colorClass,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <Circle className="h-2 w-2 shrink-0 fill-primary-500 text-primary-500 mt-1.5" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {notif.message}
                      </p>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {formatRelativeTime(notif.timestamp)}
                      </p>
                    </div>
                  </div>
                );

                return notif.actionUrl ? (
                  <Link key={notif.id} to={notif.actionUrl} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={notif.id}>{inner}</div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
