import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataState,
  IconCheck,
  IconLayers,
  IconPlan,
  PageHeader,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { PlanSetupForm } from '@/features/company-setup/PlanSetupForm';
import { useCompany, usePlans } from '@/features/insurance-data/insurance-data.api';

/**
 * Step two of the company workflow: add the plans this company sells.
 *
 * The employee stays here adding plans one after another, then presses Done.
 * Nothing about the company needs revisiting, so there is no other choice on
 * this screen.
 */
export function CompanySetupPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const company = useCompany(companyId);
  const plans = usePlans(companyId ? { companyId } : {});
  const [justAdded, setJustAdded] = useState<string[]>([]);

  const existing = plans.data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={company.data ? `Set up plans for ${company.data.name}` : 'Set up plans'}
        description="Step 2 of 2. Add each plan this company sells, with its price."
        breadcrumbs={[
          { label: 'Companies', to: ROUTES.companies.list },
          { label: company.data?.name ?? 'Company' },
          { label: 'Set up plans' },
        ]}
      />

      <DataState
        isLoading={company.isLoading}
        error={company.error}
        data={company.data ? [company.data] : undefined}
        subject="the company"
        onRetry={() => void company.refetch()}
        empty={{ title: 'Company not found' }}
      >
        {() => (
          <div className="space-y-5">
            {existing.length > 0 ? (
              <Card>
                <CardHeader
                  title="Plans added"
                  icon={<IconLayers className="size-5" />}
                  description="You can add as many as this company sells."
                />
                <CardBody className="space-y-2">
                  {existing.map((plan) => (
                    <div
                      key={plan.id}
                      className="border-border-subtle flex items-center gap-3 rounded-(--radius-control) border px-3 py-2.5"
                    >
                      <span className="bg-success-soft text-success flex size-7 shrink-0 items-center justify-center rounded-full">
                        <IconCheck className="size-4" />
                      </span>
                      <span className="text-content min-w-0 flex-1 truncate font-medium">
                        {plan.name}
                      </span>
                      {justAdded.includes(plan.name) ? <Badge tone="success">Added</Badge> : null}
                    </div>
                  ))}
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader
                title={existing.length === 0 ? 'Add the first plan' : 'Add another plan'}
                icon={<IconPlan className="size-5" />}
                description="Each plan gets a price for one customer type and coverage area. You can add more combinations later."
              />
              <CardBody>
                {companyId ? (
                  <PlanSetupForm
                    companyId={companyId}
                    onCreated={(name) => setJustAdded((current) => [...current, name])}
                  />
                ) : null}
              </CardBody>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => navigate(ROUTES.companies.list)}>
                Skip for now
              </Button>
              <Button onClick={() => navigate(ROUTES.companies.list)} disabled={existing.length === 0}>
                <IconCheck className="size-4" />
                Done
              </Button>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
