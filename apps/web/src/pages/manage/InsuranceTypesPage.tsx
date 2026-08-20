import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataState,
  DataTable,
  IconAdd,
  PageHeader,
  type Column,
} from '@/components/ui';
import { InsuranceTypeDialog } from '@/features/company-setup/InsuranceTypeDialog';
import { ROUTES } from '@/config/routes';
import { useInsuranceTypes, usePlans } from '@/features/insurance-data/insurance-data.api';
import type { InsuranceTypeDto } from '@aggregator/shared';

/**
 * The insurance categories that have been defined, e.g. whatever an employee
 * created when setting up a plan.
 *
 * A type can be added here, and is still created inline while adding a plan or
 * running a comparison — whichever the employee reaches first.
 */
export function InsuranceTypesPage() {
  const [adding, setAdding] = useState(false);
  const insuranceTypes = useInsuranceTypes();
  const plans = usePlans();

  /** How many plans each type carries, so the list shows what is actually used. */
  const planCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plan of plans.data ?? []) {
      counts.set(plan.insuranceTypeId, (counts.get(plan.insuranceTypeId) ?? 0) + 1);
    }
    return counts;
  }, [plans.data]);

  const columns: Column<InsuranceTypeDto>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Insurance type',
        render: (type) => <span className="text-content font-semibold">{type.name}</span>,
      },
      {
        key: 'code',
        header: 'Code',
        hideOnMobile: true,
        render: (type) => <span className="text-content-muted">{type.code}</span>,
      },
      {
        key: 'description',
        header: 'Description',
        hideOnMobile: true,
        render: (type) => <span className="text-content-muted">{type.description ?? '—'}</span>,
      },
      {
        key: 'plans',
        header: 'Plans',
        render: (type) => {
          const count = planCount.get(type.id) ?? 0;
          return (
            <span className="tabular-nums">
              {count === 0 ? <span className="text-content-subtle">None yet</span> : count}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (type) => (
          <Badge tone={type.isActive ? 'success' : 'neutral'}>
            {type.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [planCount],
  );

  return (
    <>
      <PageHeader
        title="Insurance types"
        description="The categories plans are grouped under. Add one here, or create it inline while adding a plan."
        breadcrumbs={[{ label: 'Dashboard', to: ROUTES.dashboard }, { label: 'Insurance types' }]}
        actions={
          <Button onClick={() => setAdding(true)}>
            <IconAdd className="size-4" />
            Add insurance type
          </Button>
        }
      />

      <DataState
        isLoading={insuranceTypes.isLoading}
        error={insuranceTypes.error}
        data={insuranceTypes.data}
        subject="insurance types"
        onRetry={() => void insuranceTypes.refetch()}
        empty={{
          title: 'No insurance types yet',
          description:
            'Add the first category plans will be grouped under, such as medical or motor.',
          action: (
            <Button onClick={() => setAdding(true)}>
              <IconAdd className="size-4" />
              Add insurance type
            </Button>
          ),
        }}
      >
        {(items) => <DataTable columns={columns} items={items} getRowKey={(type) => type.id} />}
      </DataState>

      {adding ? <InsuranceTypeDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}
