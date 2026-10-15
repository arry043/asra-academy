import * as React from 'react';

import { controlClasses } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Multi-line text input with the shared control styling. Pair it with `<Field>`. */
function Textarea({ className, rows = 4, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(controlClasses, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  );
}

export { Textarea };
