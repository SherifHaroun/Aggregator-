import { UNSPECIFIED_OPTION_LABEL, derivePlanCode, type PlanDto } from '@aggregator/shared';
import {
  Button,
  Callout,
  Dialog,
  Field,
  Input,
  Select,
  StatusToggle,
  useToast,
} from '@/components/ui';
import { useMedicalNetworks, useSavePlan } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Create or edit a plan, from inside the company screen.
 *
 * The network is chosen HERE, on the plan: every variant beneath it gives
 * access to the same estate, and the customer is told the network's name and
 * offered its provider list. Chosen from the shared list, never typed.
 */
export function PlanDialog({
  companyId,
  plan,
  onClose,
}: {
  companyId: string;
  /** `null` creates a new plan. */
  plan: PlanDto | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const savePlan = useSavePlan(plan?.id);
  const networks = useMedicalNetworks();

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: plan?.name ?? '',
    code: plan?.code ?? '',
    medicalNetworkId: plan?.medicalNetworkId ?? '',
    isActive: plan?.isActive ?? true,
  });

  const pending = savePlan.isPending;

  /**
   * The API requires a code; the shared rule derives one so the employee need
   * not. It carries the customer type, because that is part of what identifies
   * a plan — a company's Individual and Family "Platinum" are two products.
   */
  const derivedCode = derivePlanCode(values.name, plan?.customerType ?? 'INDIVIDUAL');

  function submit() {
    savePlan.mutate(
      {
        name: values.name.trim(),
        code: values.code.trim() === '' ? derivedCode : values.code.trim(),
        medicalNetworkId: values.medicalNetworkId === '' ? null : values.medicalNetworkId,
        isActive: values.isActive,
        ...(plan ? {} : { companyId }),
      },
      {
        onSuccess: (saved) => {
          notify(`${saved.name} was saved.`);
          onClose();
        },
        onError: (error) => applyError(error, 'the plan'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={plan ? 'Edit plan' : 'Add a plan'}
      description={
        plan
          ? 'Prices and benefits live in this plan’s configurations.'
          : 'A plan is the product itself — you will set its prices and benefits next.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? 'Saving…' : 'Save plan'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? (
          <Callout tone="danger" title="Could not save">
            {formError}
          </Callout>
        ) : null}

        <Field label="Plan name" required error={fieldErrors.name}>
          {(props) => (
            <Input
              {...props}
              autoFocus
              value={values.name}
              onChange={(event) => setValue('name', event.target.value)}
              placeholder="e.g. the tier this company sells"
            />
          )}
        </Field>

        <Field
          label="Medical network"
          error={fieldErrors.medicalNetworkId}
          hint={
            (networks.data?.length ?? 0) === 0
              ? 'No networks yet. Add them on the Medical networks screen.'
              : 'Every variant of this plan is sold on it. Customers see the name and can download its provider list.'
          }
        >
          {(props) => (
            <Select
              {...props}
              value={values.medicalNetworkId}
              disabled={(networks.data?.length ?? 0) === 0}
              onChange={(event) => setValue('medicalNetworkId', event.target.value)}
            >
              <option value="">{UNSPECIFIED_OPTION_LABEL}</option>
              {(networks.data ?? []).map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/*
          HOW GOOD THE PLAN IS is not asked here, and cannot be.

          Basic, Standard and Premium are read off each variant's annual limit,
          so a plan gets its tier from the ceilings it actually pays out —
          nothing to pick, and nothing that can drift from the figures.
        */}
        <Field
          label="Plan code"
          error={fieldErrors.code}
          hint={
            values.code.trim() === '' && derivedCode
              ? `Will be saved as ${derivedCode}`
              : 'Optional.'
          }
        >
          {(props) => (
            <Input
              {...props}
              value={values.code}
              onChange={(event) => setValue('code', event.target.value)}
              placeholder={derivedCode || 'Auto-generated'}
            />
          )}
        </Field>

        <Field label="Status" error={fieldErrors.isActive}>
          {(props) => (
            <StatusToggle
              id={props.id}
              value={values.isActive}
              onChange={(isActive) => setValue('isActive', isActive)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
