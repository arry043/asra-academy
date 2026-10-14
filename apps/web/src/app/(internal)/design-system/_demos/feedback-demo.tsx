'use client';

import { HelpCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.success('Saved', { description: 'Your changes are live (demo).' })}
      >
        Success toast
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          toast.error('Could not save', {
            description: 'Check your connection and try again (demo).',
          })
        }
      >
        Error toast
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.warning('Session ends in 5 minutes (demo)')}
      >
        Warning toast
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info('New announcement available (demo)')}
      >
        Info toast
      </Button>
    </div>
  );
}

export function TooltipDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Help with progress">
            <HelpCircle className="size-5" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Progress counts completed lessons in this course.</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">
            Hover or focus me
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Tooltips open on keyboard focus too.</TooltipContent>
      </Tooltip>
    </div>
  );
}
