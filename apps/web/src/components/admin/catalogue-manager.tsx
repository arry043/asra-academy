'use client';

import type { AcademicLevelDto, Paginated } from '@asra/types';
import { Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import * as React from 'react';
import type { z } from 'zod';

import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';

import {
  CheckboxField,
  ConfirmDialog,
  ErrorPanel,
  InactiveBadge,
  LoadingPanel,
  SelectField,
} from './admin-ui';
import { errorMessage, useAdminApi, useApiResource } from './use-admin';

/**
 * Generic list + create/edit + activate/deactivate + delete screen for one catalogue resource
 * (academic levels, classes, streams, subjects, course categories). The API enforces every rule
 * (unique names, reference checks); this screen shows its answers next to the right field.
 */

export type FormValues = Record<string, string | boolean>;

export interface CatalogueField {
  name: string;
  label: string;
  kind: 'text' | 'textarea' | 'number' | 'level';
  optional?: boolean;
  hint?: string;
  placeholder?: string;
}

export interface CatalogueRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface CatalogueConfig<TRow extends CatalogueRow> {
  title: string;
  description: string;
  singular: string;
  /** e.g. `/admin/classes` */
  endpoint: string;
  createSchema: z.ZodType;
  updateSchema: z.ZodType;
  fields: CatalogueField[];
  columns: { header: string; cell: (row: TRow) => React.ReactNode; className?: string }[];
  /** Initial form values (blank for create). */
  toForm: (row?: TRow) => FormValues;
  /** Form values → request body (strings to numbers/null). */
  toPayload: (values: FormValues) => Record<string, unknown>;
  /** Show the academic-level filter and the level picker. */
  usesLevels?: boolean;
  /** How many records use this row (shown before delete). */
  usage?: (row: TRow) => string | null;
}

const PAGE_SIZE = 20;

/** "" → null, otherwise a number (NaN stays NaN so the schema reports it). */
export function optionalNumber(value: string | boolean | undefined): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return Number(value);
}

export function CatalogueManager<TRow extends CatalogueRow>({
  config,
}: {
  config: CatalogueConfig<TRow>;
}) {
  const api = useAdminApi();
  const [searchText, setSearchText] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState<'all' | 'true' | 'false'>('all');
  const [levelId, setLevelId] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<TRow | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<TRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Debounce typing into the search box.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (query) params.set('q', query);
  if (active !== 'all') params.set('isActive', active);
  if (config.usesLevels && levelId !== 'all') params.set('academicLevelId', levelId);
  const path = `${config.endpoint}?${params.toString()}`;

  const list = useApiResource(path, () => api.get<Paginated<TRow>>(path));
  const levels = useApiResource(config.usesLevels ? 'levels' : null, () =>
    api.get<Paginated<AcademicLevelDto>>('/admin/academic-levels?pageSize=100'),
  );

  const filtered = query !== '' || active !== 'all' || (config.usesLevels && levelId !== 'all');

  async function toggleActive(row: TRow) {
    setBusyId(row.id);
    try {
      await api.patch(`${config.endpoint}/${row.id}`, { isActive: !row.isActive });
      toast.success(`${config.singular} ${row.isActive ? 'deactivated' : 'activated'}`, {
        description: row.name,
      });
      list.reload();
    } catch (error) {
      toast.error(`Could not update ${row.name}`, { description: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: TRow) {
    try {
      await api.del(`${config.endpoint}/${row.id}`);
      toast.success(`${config.singular} deleted`, { description: row.name });
      list.reload();
    } catch (error) {
      toast.error(`Could not delete ${row.name}`, { description: errorMessage(error) });
      throw error;
    }
  }

  const items = list.data?.items ?? [];
  const colSpan = config.columns.length + 3;

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[{ label: 'Administration', href: '/admin' }, { label: config.title }]}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden /> Add {config.singular.toLowerCase()}
          </Button>
        }
      />

      <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_12rem] lg:grid-cols-[minmax(0,1fr)_12rem_14rem]">
        <div className="grid gap-2">
          <Label htmlFor="catalogue-search">Search</Label>
          <SearchInput
            id="catalogue-search"
            value={searchText}
            maxLength={100}
            placeholder={`Search ${config.title.toLowerCase()}`}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="catalogue-active">Status</Label>
          <Select
            value={active}
            onValueChange={(value) => {
              setActive(value as typeof active);
              setPage(1);
            }}
          >
            <SelectTrigger id="catalogue-active">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {config.usesLevels ? (
          <div className="grid gap-2">
            <Label htmlFor="catalogue-level">Academic level</Label>
            <Select
              value={levelId}
              onValueChange={(value) => {
                setLevelId(value);
                setPage(1);
              }}
            >
              <SelectTrigger id="catalogue-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {(levels.data?.items ?? []).map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {list.error ? (
        <ErrorPanel message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingPanel label={`Loading ${config.title.toLowerCase()}…`} />
      ) : (
        <div className="grid gap-4" aria-busy={list.loading || undefined}>
          <Table scrollLabel={config.title}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {config.columns.map((column) => (
                  <TableHead key={column.header} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={colSpan}
                  title={filtered ? 'No matches' : `No ${config.title.toLowerCase()} yet`}
                  description={
                    filtered
                      ? 'Try a different search or clear the filters.'
                      : `Add the first ${config.singular.toLowerCase()} to get started.`
                  }
                  action={
                    filtered ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchText('');
                          setQuery('');
                          setActive('all');
                          setLevelId('all');
                          setPage(1);
                        }}
                      >
                        <X aria-hidden /> Clear filters
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setEditing('new')}>
                        <Plus aria-hidden /> Add {config.singular.toLowerCase()}
                      </Button>
                    )
                  }
                />
              ) : (
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="grid">
                        <span className="font-medium text-heading">{row.name}</span>
                        <span className="type-caption text-muted-foreground">/{row.slug}</span>
                      </span>
                    </TableCell>
                    {config.columns.map((column) => (
                      <TableCell key={column.header} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    <TableCell>{row.isActive ? 'Active' : <InactiveBadge />}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => setEditing(row)}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`}
                          title={row.isActive ? 'Deactivate' : 'Activate'}
                          loading={busyId === row.id}
                          onClick={() => void toggleActive(row)}
                        >
                          {busyId === row.id ? null : <Power aria-hidden />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {list.data.pagination.pageCount > 1 ? (
            <Pagination
              page={list.data.pagination.page}
              pageCount={list.data.pagination.pageCount}
              onPageChange={setPage}
              label={`${config.title} pages`}
            />
          ) : null}
        </div>
      )}

      {editing ? (
        <CatalogueFormDialog
          config={config}
          row={editing === 'new' ? undefined : editing}
          levels={levels.data?.items ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="This permanently removes the record. Records that are in use cannot be deleted — deactivate them instead."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        destructive
        onConfirm={() => (deleting ? remove(deleting) : Promise.resolve())}
      >
        {deleting && config.usage?.(deleting) ? (
          <Alert tone="warning">
            <p>{config.usage(deleting)}</p>
          </Alert>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

function CatalogueFormDialog<TRow extends CatalogueRow>({
  config,
  row,
  levels,
  onClose,
  onSaved,
}: {
  config: CatalogueConfig<TRow>;
  row?: TRow;
  levels: AcademicLevelDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [values, setValues] = React.useState<FormValues>(() => config.toForm(row));
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const isNew = !row;

  const set = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = validateForm(
      isNew ? config.createSchema : config.updateSchema,
      config.toPayload(values),
    );
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      if (isNew) await api.post(config.endpoint, parsed.data);
      else await api.patch(`${config.endpoint}/${row.id}`, parsed.data);
      toast.success(`${config.singular} ${isNew ? 'created' : 'saved'}`, {
        description: String(values.name ?? ''),
      });
      onSaved();
    } catch (error) {
      const { message, fieldErrors } = describeError(error);
      setErrors(fieldErrors);
      setFormError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isNew ? `Add ${config.singular.toLowerCase()}` : `Edit ${row.name}`}
          </DialogTitle>
          <DialogDescription>
            Fields marked “optional” can be left empty. The slug is generated from the name when
            left empty and stays the same if you rename later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {formError ? (
            <Alert tone="error">
              <p>{formError}</p>
            </Alert>
          ) : null}
          {config.fields.map((field) => {
            const id = `catalogue-${field.name}`;
            const value = values[field.name];
            if (field.kind === 'level') {
              return (
                <SelectField
                  key={field.name}
                  id={id}
                  label={field.label}
                  error={errors[field.name]}
                  hint={levels.length === 0 ? 'Create an academic level first.' : field.hint}
                  placeholder="Choose an academic level"
                  value={typeof value === 'string' ? value : ''}
                  onValueChange={(next) => set(field.name, next)}
                  options={levels.map((level) => ({
                    value: level.id,
                    label: level.isActive ? level.name : `${level.name} (inactive)`,
                    disabled: !level.isActive && level.id !== value,
                  }))}
                />
              );
            }
            const common = {
              name: field.name,
              value: typeof value === 'string' ? value : '',
              placeholder: field.placeholder,
            };
            return (
              <Field
                key={field.name}
                id={id}
                label={field.label}
                optional={field.optional}
                hint={field.hint}
                error={errors[field.name]}
              >
                {field.kind === 'textarea' ? (
                  <Textarea
                    {...common}
                    rows={3}
                    onChange={(event) => set(field.name, event.target.value)}
                  />
                ) : (
                  <Input
                    {...common}
                    type={field.kind === 'number' ? 'number' : 'text'}
                    inputMode={field.kind === 'number' ? 'numeric' : undefined}
                    onChange={(event) => set(field.name, event.target.value)}
                  />
                )}
              </Field>
            );
          })}
          <CheckboxField
            id="catalogue-isActive"
            label="Active"
            checked={values.isActive === true}
            onChange={(checked) => set('isActive', checked)}
            hint="Inactive records stay attached to existing courses but cannot be chosen for new ones."
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} loadingText="Saving…">
              {isNew ? `Create ${config.singular.toLowerCase()}` : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
