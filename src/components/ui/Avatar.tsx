import { cn } from '@/lib/utils';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Avatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[9px]',
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-[11px]',
    lg: 'h-11 w-11 text-[13px]',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color ?? '#376451' }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
