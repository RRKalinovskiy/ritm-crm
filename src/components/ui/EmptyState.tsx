import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon size={22} />
        </div>
      )}
      <div className="text-[15px] font-bold text-ink">{title}</div>
      {description && <div className="mt-1 max-w-[360px] text-[12px] leading-5 text-muted">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
