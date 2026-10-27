export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-12 px-4">
    {Icon && (
      <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
    )}
    <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
      {title}
    </h3>
    {description && (
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        {description}
      </p>
    )}
    {action && <div className="mt-6">{action}</div>}
  </div>
);
