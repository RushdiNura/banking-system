import clsx from "clsx";

const variants = {
  success: "badge-success",
  danger: "badge-danger",
  warning: "badge-warning",
  primary: "badge-primary",
  default:
    "badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

export const Badge = ({ children, variant = "default", className }) => (
  <span className={clsx(variants[variant], className)}>{children}</span>
);
