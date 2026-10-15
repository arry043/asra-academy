'use client';

import {
  ENQUIRY_MESSAGE_MAX_LENGTH,
  ENQUIRY_TOPICS,
  enquirySchema,
  type EnquiryTopic,
} from '@asra/validation';
import { Mail } from 'lucide-react';
import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { buildEnquiryMailto, ENQUIRY_TOPIC_LABELS } from '@/lib/enquiry';
import { cn } from '@/lib/utils';

const FIELD_ORDER = ['fullName', 'email', 'phone', 'topic', 'message'] as const;

/**
 * Contact / enquiry form (REQ-COM-003).
 *
 * HONEST DELIVERY: there is no enquiry API yet, so this form cannot send or store anything by
 * itself. After validation (the same `enquirySchema` the future API will enforce), it opens the
 * visitor's email app with the message addressed to the academy. The page says so up front, and
 * it never reports that the enquiry was delivered. When `POST /api/v1/enquiries` exists, replace
 * `handOff` with an `apiRequest` call and show success only after the API confirms.
 */
export function ContactForm({
  recipient,
  defaultTopic,
}: {
  /** Client-confirmed academy email (siteConfig.contact.email). */
  recipient: string;
  defaultTopic?: EnquiryTopic;
}) {
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [topic, setTopic] = React.useState<string>(defaultTopic ?? '');
  const [messageLength, setMessageLength] = React.useState(0);
  const [mailto, setMailto] = React.useState<string | null>(null);
  const ids = {
    fullName: React.useId(),
    email: React.useId(),
    phone: React.useId(),
    topic: React.useId(),
    message: React.useId(),
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = validateForm(enquirySchema, {
      fullName: form.get('fullName'),
      email: form.get('email'),
      phone: form.get('phone') ?? '',
      topic: topic || undefined,
      message: form.get('message'),
    });

    if (parsed.errors) {
      setErrors(parsed.errors);
      setMailto(null);
      // Move focus to the first invalid field so keyboard and screen-reader users land on it.
      const first = FIELD_ORDER.find((field) => parsed.errors[field]);
      if (first) document.getElementById(ids[first])?.focus();
      return;
    }

    setErrors({});
    const href = buildEnquiryMailto(parsed.data, recipient);
    setMailto(href);
    handOff(href);
  }

  function handOff(href: string) {
    window.location.href = href;
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-describedby={`${ids.message}-delivery`}
      className="grid gap-5"
    >
      <Alert tone="info" id={`${ids.message}-delivery`} title="How this form works">
        <p>
          Online submission is not available yet. When you continue, your email app opens with your
          message addressed to <strong className="font-semibold">{recipient}</strong>. Your enquiry
          is sent only when you press Send there.
        </p>
      </Alert>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={ids.fullName} label="Full name" error={errors.fullName}>
          <Input name="fullName" autoComplete="name" maxLength={150} required />
        </Field>
        <Field id={ids.email} label="Email" error={errors.email}>
          <Input name="email" type="email" autoComplete="email" maxLength={320} required />
        </Field>
        <Field
          id={ids.phone}
          label="Phone number"
          optional
          hint="Include the country code if you are outside India."
          error={errors.phone}
        >
          <Input name="phone" type="tel" autoComplete="tel" maxLength={25} />
        </Field>
        {/* Select's root renders no element, so it wraps the Field; the trigger is the control. */}
        <Select value={topic} onValueChange={setTopic}>
          <Field id={ids.topic} label="Your enquiry is about" error={errors.topic}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a topic" />
            </SelectTrigger>
          </Field>
          <SelectContent>
            {ENQUIRY_TOPICS.map((value) => (
              <SelectItem key={value} value={value}>
                {ENQUIRY_TOPIC_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Field
        id={ids.message}
        label="Message"
        hint={`${messageLength} / ${ENQUIRY_MESSAGE_MAX_LENGTH} characters`}
        error={errors.message}
      >
        <textarea
          name="message"
          rows={6}
          maxLength={ENQUIRY_MESSAGE_MAX_LENGTH}
          required
          onChange={(event) => setMessageLength(event.target.value.length)}
          className={cn(
            'min-h-32 w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-base text-foreground transition-[color,border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground hover:border-asra-sage-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm',
          )}
        />
      </Field>

      {mailto ? (
        <Alert tone="success" title="Your email app should now be open">
          <p>
            Check the message and press <strong className="font-semibold">Send</strong> in your
            email app — we receive your enquiry only after you send it. If nothing opened,{' '}
            <a href={mailto} className="font-semibold underline underline-offset-2">
              try opening it again
            </a>{' '}
            or write to us directly at{' '}
            <a href={`mailto:${recipient}`} className="font-semibold underline underline-offset-2">
              {recipient}
            </a>
            .
          </p>
        </Alert>
      ) : null}

      <div>
        <Button type="submit" size="lg">
          <Mail aria-hidden /> Continue in email app
        </Button>
      </div>
    </form>
  );
}
