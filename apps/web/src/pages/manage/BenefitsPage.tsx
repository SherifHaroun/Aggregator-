import { isCoreMedicalBenefit, type InsuranceOptionDto } from '@aggregator/shared';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  EmptyState,
  IconAdd,
  IconEdit,
  IconLayers,
  IconTrash,
  Input,
  PageHeader,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import {
  useDeleteInsuranceOption,
  useInsuranceOptions,
} from '@/features/insurance-data/insurance-data.api';
import { EditBenefitDialog } from '@/features/plan-configuration/EditBenefitDialog';
import { NewBenefitDialog } from '@/features/plan-configuration/NewBenefitDialog';

/** What a benefit takes with it if it goes. */
function countDependants(option: InsuranceOptionDto): {
  subBenefits: number;
  variants: number;
  total: number;
} {
  const subBenefits = (option.children ?? []).length;
  /**
   * The benefit's OWN usage, never the sum across a group: a group and its
   * parts are attached together, so adding the children's counts would report
   * the same variant several times over.
   */
  const variants = option.usageCount ?? 0;
  return { subBenefits, variants, total: subBenefits + variants };
}

/** The consequence of the deletion, in the employee's own terms. */
function describeDeletion(option: InsuranceOptionDto): string {
  const { subBenefits, variants } = countDependants(option);

  const takes = [
    subBenefits > 0
      ? `${subBenefits} sub-benefit${subBenefits === 1 ? '' : 's'} filed under it`
      : null,
    variants > 0
      ? `${variants} variant${variants === 1 ? '' : 's'} that carr${variants === 1 ? 'ies' : 'y'} it`
      : null,
  ].filter(Boolean);

  if (takes.length === 0) {
    return 'This removes the benefit from the catalogue for every company. Nothing is using it, and it cannot be undone.';
  }

  return `This removes the benefit from the catalogue for every company, along with ${takes.join(' and ')}. Their recorded values are lost and this cannot be undone. To take it off one variant only, remove it from that variant instead.`;
}

/**
 * THE BENEFITS EVERY COMPANY SHARES.
 *
 * One list, defined once and offered everywhere. "Dental" is a record here;
 * what a particular plan PAYS for dental is a value on that plan's variant, set
 * in the variant's own editor. Nothing on this screen belongs to a company.
 *
 * It exists because a benefit has to be here before any plan can point at it —
 * a catalogue with nothing in it leaves every variant editor with nothing to
 * fill in. Most employees will use this at the start and rarely again.
 *
 * A benefit filed under a group is shown beneath it, because deleting the group
 * takes them with it and that has to be visible before it happens.
 */
export function BenefitsPage() {
  const { notify } = useToast();
  const benefits = useInsuranceOptions({ isActive: true });
  const deleteBenefit = useDeleteInsuranceOption();

  const [search, setSearch] = useState('');
  /** `undefined` closed, `null` a new top-level benefit, a record a sub-benefit. */
  const [creating, setCreating] = useState<{ id: string; name: string } | null | undefined>(
    undefined,
  );
  const [editing, setEditing] = useState<InsuranceOptionDto | null>(null);
  const [deleting, setDeleting] = useState<InsuranceOptionDto | null>(null);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = benefits.data ?? [];
    if (needle === '') return all;
    /** A group stays when one of its members matches, or nothing would be findable. */
    return all.filter(
      (option) =>
        option.name.toLowerCase().includes(needle) ||
        (option.children ?? []).some((child) => child.name.toLowerCase().includes(needle)),
    );
  }, [benefits.data, search]);

  function confirmDelete() {
    if (!deleting) return;
    const dependants = countDependants(deleting);
    deleteBenefit.mutate(
      { id: deleting.id, force: dependants.total > 0 },
      {
        onSuccess: () => {
          notify(`${deleting.name} was deleted.`);
          setDeleting(null);
        },
        onError: (error) => {
          notify(describeError(error, 'the benefit'), 'error');
          setDeleting(null);
        },
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Benefits"
        description="One list, shared by every company. What a plan pays for each is set on the plan's own variants."
        breadcrumbs={[{ label: 'Dashboard', to: ROUTES.dashboard }, { label: 'Benefits' }]}
        actions={
          <Button onClick={() => setCreating(null)}>
            <IconAdd className="size-4" />
            New benefit
          </Button>
        }
      />

      <DataState
        isLoading={benefits.isLoading}
        error={benefits.error}
        data={benefits.data}
        subject="the benefits"
        onRetry={() => void benefits.refetch()}
        empty={{
          title: 'No benefits yet',
          description:
            'Create the first one — it becomes available to every company and every plan at once.',
          action: (
            <Button onClick={() => setCreating(null)}>
              <IconAdd className="size-4" />
              New benefit
            </Button>
          ),
        }}
      >
        {() => (
          <Card>
            <CardHeader
              title="All benefits"
              icon={<IconLayers className="size-5" />}
              description="Renaming one renames it everywhere; there is only one of each."
            />
            <CardBody className="space-y-3">
              <Input
                type="search"
                value={search}
                aria-label="Search benefits"
                placeholder="Search benefits…"
                onChange={(event) => setSearch(event.target.value)}
              />

              {visible.length === 0 ? (
                <EmptyState
                  variant="plain"
                  icon={<IconLayers className="size-6" />}
                  title={`No benefit matches “${search.trim()}”`}
                  description="Create it, and it will be available to every company."
                  action={
                    <Button onClick={() => setCreating(null)}>
                      <IconAdd className="size-4" />
                      New benefit
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-(--color-border)">
                  {visible.map((option) => (
                    <li key={option.id} className="py-3 first:pt-0 last:pb-0">
                      <BenefitRow
                        option={option}
                        onEdit={() => setEditing(option)}
                        onDelete={() => setDeleting(option)}
                        {...(option.isUmbrella
                          ? { onAddChild: () => setCreating({ id: option.id, name: option.name }) }
                          : {})}
                      />

                      {(option.children ?? []).length > 0 ? (
                        <ul className="border-border mt-2 space-y-2 border-l pl-4">
                          {(option.children ?? []).map((child) => (
                            <li key={child.id}>
                              <BenefitRow
                                option={child}
                                onEdit={() => setEditing(child)}
                                onDelete={() => setDeleting(child)}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
      </DataState>

      {creating !== undefined ? (
        <NewBenefitDialog
          {...(creating ? { parent: creating } : {})}
          onClose={() => setCreating(undefined)}
        />
      ) : null}

      {editing ? <EditBenefitDialog benefit={editing} onClose={() => setEditing(null)} /> : null}

      {/* Deleting is not removing it from one plan — it leaves the catalogue for
          every company, so the dialog spells out the damage first. */}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        busy={deleteBenefit.isPending}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete this benefit?'}
        description={deleting ? describeDeletion(deleting) : ''}
        confirmLabel={
          deleting && countDependants(deleting).total > 0 ? 'Delete everywhere' : 'Delete'
        }
        onConfirm={confirmDelete}
      />
    </>
  );
}

function BenefitRow({
  option,
  onEdit,
  onDelete,
  onAddChild,
}: {
  option: InsuranceOptionDto;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
}) {
  const usage = option.usageCount ?? 0;

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="text-content block truncate font-medium">{option.name}</span>
        <span className="text-content-subtle block truncate text-xs">
          {option.isUmbrella
            ? `Group · ${(option.children ?? []).length} inside`
            : /**
               * A core area is one of the six every plan is judged on. Saying so
               * here is what stops somebody deleting the record the variant
               * editor's "Dental" heading is pointing at.
               */
              isCoreMedicalBenefit(option.name)
              ? 'Core benefit'
              : 'Optional benefit'}
          {usage > 0 ? ` · used by ${usage} ${usage === 1 ? 'variant' : 'variants'}` : ''}
        </span>
      </span>

      {isCoreMedicalBenefit(option.name) ? <Badge tone="brand">Core</Badge> : null}

      {onAddChild ? (
        <button
          type="button"
          onClick={onAddChild}
          aria-label={`Add a benefit inside ${option.name}`}
          title={`Add a benefit inside ${option.name}`}
          className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-2"
        >
          <IconAdd className="size-4" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${option.name}`}
        title={`Edit ${option.name} — renames it everywhere`}
        className="text-content-muted hover:bg-surface-muted hover:text-content rounded-(--radius-control) p-2"
      >
        <IconEdit className="size-4" />
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${option.name}`}
        title={`Delete ${option.name} from every plan`}
        className="text-content-muted hover:bg-surface-muted hover:text-danger rounded-(--radius-control) p-2"
      >
        <IconTrash className="size-4" />
      </button>
    </div>
  );
}
