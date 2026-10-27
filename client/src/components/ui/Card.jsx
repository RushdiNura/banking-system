import clsx from "clsx";

export const Card = ({ children, className, ...props }) => (
  <div className={clsx("card", className)} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ children, className }) => (
  <div
    className={clsx(
      "px-6 py-4 border-b border-slate-200 dark:border-slate-700",
      className,
    )}
  >
    {children}
  </div>
);

export const CardTitle = ({ children, className }) => (
  <h3
    className={clsx(
      "text-lg font-semibold text-slate-900 dark:text-slate-100",
      className,
    )}
  >
    {children}
  </h3>
);

export const CardDescription = ({ children, className }) => (
  <p
    className={clsx(
      "mt-1 text-sm text-slate-500 dark:text-slate-400",
      className,
    )}
  >
    {children}
  </p>
);

export const CardContent = ({ children, className }) => (
  <div className={clsx("px-6 py-4", className)}>{children}</div>
);

export const CardFooter = ({ children, className }) => (
  <div
    className={clsx(
      "px-6 py-4 border-t border-slate-200 dark:border-slate-700",
      className,
    )}
  >
    {children}
  </div>
);
