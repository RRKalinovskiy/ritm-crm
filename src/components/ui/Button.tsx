import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-sm hover:bg-primary-dark active:bg-primary-dark disabled:bg-primary/50',
  secondary:
    'border border-line bg-surface text-ink hover:bg-[#F8FAF8] active:bg-[#F1F4F2] disabled:text-muted',
  ghost: 'text-muted hover:bg-[#F1F4F2] hover:text-ink',
  danger: 'bg-danger text-white hover:bg-[#9E3A33]',
  soft: 'bg-primary-soft text-primary-dark hover:bg-[#DFECE5]',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[12px] font-semibold',
  md: 'h-10 gap-2 rounded-xl px-4 text-[13px] font-semibold',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex select-none items-center justify-center whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
