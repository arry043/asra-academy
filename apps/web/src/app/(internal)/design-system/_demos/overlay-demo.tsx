'use client';

import { Filter, PanelRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { toast } from '@/components/ui/toast';

/** Modal and drawer demos. Focus is trapped while open and returns to the trigger on close. */
export function OverlayDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open modal</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this class?</DialogTitle>
            <DialogDescription>
              Example confirmation. Press Escape, click outside, use Close, or choose an action.
            </DialogDescription>
          </DialogHeader>
          <p className="type-body-sm text-muted-foreground">
            Dialog content scrolls inside the viewport on small screens instead of overflowing.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Stay</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={() => toast.info('Confirmed (demo)')}>
                Leave class
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline">
            <PanelRight aria-hidden /> Open side drawer
          </Button>
        </DrawerTrigger>
        <DrawerContent side="right">
          <DrawerHeader>
            <DrawerTitle>Course details</DrawerTitle>
            <DrawerDescription>
              Side drawers suit detail panes and secondary tasks.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="grid content-start gap-3 type-body-sm text-muted-foreground">
            <p>Drawer body scrolls independently when content is long.</p>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button>Done</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="secondary">
            <Filter aria-hidden /> Open bottom sheet
          </Button>
        </DrawerTrigger>
        <DrawerContent side="bottom">
          <DrawerHeader>
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription>Bottom sheets work well for filters on phones.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="sm:flex-row sm:justify-end">
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button>Apply</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
