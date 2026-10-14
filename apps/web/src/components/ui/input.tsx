import { Search } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Shared control styling (Input, PasswordInput, SelectTrigger). */
const controlClasses = cn(
  'flex h-control w-full min-w-0 rounded-md border border-input bg-card px-3.5 py-2 text-base text-foreground transition-[color,border-color,box-shadow] duration-150 outline-none md:text-sm',
  'selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground',
  'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
  'hover:border-asra-sage-strong',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-destructive/30',
);

/**
 * Text-like input (text, email, number, tel, url…). One implementation for every type; pair it
 * with `<Field>` for the label, hint and error wiring.
 */
function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input type={type} data-slot="input" className={cn(controlClasses, className)} {...props} />
  );
}

/** Search input with a leading icon. Give it an accessible name (`aria-label` or a `<Field>`). */
function SearchInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <div className="relative" data-slot="search-input">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input type="search" className={cn('pl-10', className)} {...props} />
    </div>
  );
}

export { Input, SearchInput, controlClasses };
