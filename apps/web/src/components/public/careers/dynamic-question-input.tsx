'use client';

import type { JobQuestionDto } from '@asra/types';
import * as React from 'react';

import { Input, controlClasses } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface DynamicQuestionInputProps {
  question: JobQuestionDto;
  value: string | string[] | boolean | number | undefined;
  onChange: (val: string | string[] | boolean | number) => void;
  error?: string;
  disabled?: boolean;
}

export function DynamicQuestionInput({
  question,
  value,
  onChange,
  error,
  disabled = false,
}: DynamicQuestionInputProps) {
  const { id, label, helpText, fieldType, required, options, validation } = question;
  const maxLength = validation?.maxLength;
  const minValue = validation?.min;
  const maxValue = validation?.max;

  const currentStringValue = typeof value === 'string' ? value : '';
  const charCount = currentStringValue.length;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm leading-none font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-1 text-destructive" title="Required">
              *
            </span>
          )}
        </Label>
        {maxLength && (fieldType === 'SHORT_TEXT' || fieldType === 'LONG_TEXT') && (
          <span className="text-xs text-muted-foreground">
            {charCount}/{maxLength}
          </span>
        )}
      </div>

      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}

      {fieldType === 'SHORT_TEXT' && (
        <Input
          id={id}
          value={currentStringValue}
          maxLength={maxLength ?? undefined}
          disabled={disabled}
          placeholder="Your answer"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {fieldType === 'LONG_TEXT' && (
        <Textarea
          id={id}
          value={currentStringValue}
          maxLength={maxLength ?? undefined}
          disabled={disabled}
          rows={3}
          placeholder="Type your response here..."
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {fieldType === 'SINGLE_SELECT' && (
        <select
          id={id}
          value={currentStringValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(controlClasses, 'cursor-pointer')}
        >
          <option value="">Select an option...</option>
          {options?.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {fieldType === 'MULTI_SELECT' && (
        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
          {options?.map((opt, i) => {
            const currentSelected = Array.isArray(value) ? (value as string[]) : [];
            const isChecked = currentSelected.includes(opt);
            return (
              <label
                key={i}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...currentSelected, opt]);
                    } else {
                      onChange(currentSelected.filter((item) => item !== opt));
                    }
                  }}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-foreground">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {fieldType === 'YES_NO' && (
        <div className="flex gap-4 pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={id}
              checked={value === true}
              disabled={disabled}
              onChange={() => onChange(true)}
              className="h-4 w-4 text-primary focus:ring-primary"
            />
            <span>Yes</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={id}
              checked={value === false}
              disabled={disabled}
              onChange={() => onChange(false)}
              className="h-4 w-4 text-primary focus:ring-primary"
            />
            <span>No</span>
          </label>
        </div>
      )}

      {fieldType === 'NUMBER' && (
        <Input
          id={id}
          type="number"
          min={minValue ?? undefined}
          max={maxValue ?? undefined}
          value={value !== undefined ? String(value) : ''}
          disabled={disabled}
          placeholder="e.g. 5"
          onChange={(e) => {
            const val = e.target.value === '' ? '' : Number(e.target.value);
            onChange(val);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {fieldType === 'DATE' && (
        <Input
          id={id}
          type="date"
          value={currentStringValue}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {fieldType === 'URL' && (
        <Input
          id={id}
          type="url"
          value={currentStringValue}
          disabled={disabled}
          placeholder="https://example.com/portfolio"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
