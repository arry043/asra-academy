import { MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { publicEnv } from '@/lib/env';
import { buildWhatsAppUrl, whatsAppEnquiryMessage } from '@/lib/whatsapp';

type WhatsAppLinkProps = {
  /** Topic for the prefilled message, e.g. "the English Language course". */
  topic?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'accent';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
};

/**
 * WhatsApp click-to-chat button (REQ-COM-001). Renders NOTHING until the client-confirmed number
 * is configured in `NEXT_PUBLIC_WHATSAPP_NUMBER` (CLIENT-CLARIFICATIONS P-02) — no invented or
 * placeholder number ever reaches the page.
 */
export function WhatsAppLink({
  topic,
  label = 'Chat on WhatsApp',
  variant = 'outline',
  size = 'default',
  className,
}: WhatsAppLinkProps) {
  const href = buildWhatsAppUrl(
    publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER,
    whatsAppEnquiryMessage(topic),
  );
  if (!href) return null;

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden />
        {label}
        <span className="sr-only">(opens WhatsApp in a new tab)</span>
      </a>
    </Button>
  );
}

/** True when a WhatsApp number is configured (for copy that mentions WhatsApp). */
export function isWhatsAppConfigured(): boolean {
  return buildWhatsAppUrl(publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER) !== null;
}
