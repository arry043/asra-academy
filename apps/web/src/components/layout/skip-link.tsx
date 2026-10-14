/** First focusable element on a page: lets keyboard users jump past repeated navigation. */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-full bg-primary px-4 py-2 type-label text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      Skip to main content
    </a>
  );
}
