import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";

const variants = {
  info: {
    container:
      "bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800",
    icon: "text-primary-500",
    Icon: Info,
  },
  success: {
    container: "bg-success-50 border-success-500/20 dark:bg-success-700/10",
    icon: "text-success-500",
    Icon: CheckCircle,
  },
  warning: {
    container: "bg-warning-50 border-warning-500/20 dark:bg-warning-700/10",
    icon: "text-warning-500",
    Icon: AlertTriangle,
  },
  error: {
    container: "bg-danger-50 border-danger-500/20 dark:bg-danger-700/10",
    icon: "text-danger-500",
    Icon: AlertCircle,
  },
};

export const Alert = ({
  variant = "info",
  title,
  children,
  dismissible = false,
  className,
}) => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const config = variants[variant];
  const Icon = config.Icon;

  return (
    <div className={clsx("rounded-lg border p-4", config.container, className)}>
      <div className="flex items-start gap-3">
        <Icon className={clsx("h-5 w-5 shrink-0 mt-0.5", config.icon)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h4>
          )}
          {children && (
            <div
              className={clsx(
                "text-sm text-slate-600 dark:text-slate-300",
                title && "mt-1",
              )}
            >
              {children}
            </div>
          )}
        </div>
        {dismissible && (
          <button
            onClick={() => setVisible(false)}
            className="shrink-0 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
