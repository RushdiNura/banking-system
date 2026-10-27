import clsx from "clsx";

export const Spinner = ({ size = "md", className }) => {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  };

  return (
    <div className={clsx("flex items-center justify-center", className)}>
      <div
        className={clsx(
          "animate-spin rounded-full border-2 border-slate-200 border-t-primary-600 dark:border-slate-700 dark:border-t-primary-500",
          sizes[size],
        )}
      />
    </div>
  );
};

export const FullPageSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="text-center">
      <Spinner size="xl" />
      <p className="mt-4 text-sm text-slate-500">Loading...</p>
    </div>
  </div>
);
