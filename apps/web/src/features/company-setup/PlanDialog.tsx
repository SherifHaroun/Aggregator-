import { derivePlanCode, type PlanDto } from '@aggregator/shared';
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
import {
  useInsuranceTypes,
  useSaveInsuranceType,
  useSavePlan,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/** Sentinel for the "create a new insurance type" choice in the select. */
const NEW_TYPE = '__new__';

/**
 * Create or edit a plan, from inside the company screen.
 *
 * Every plan belongs to an insurance type, and insurance types have no screen of
 * their own in this workflow — so the type is chosen here, and a brand-new one
 * can be created inline without leaving the dialog. Types remain database
 * records; none are built into the UI.
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
  const insuranceTypes = useInsuranceTypes({ isActive: true });
  const savePlan = useSavePlan(plan?.id);
  const saveType = useSaveInsuranceType();

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: plan?.name ?? '',
    code: plan?.code ?? '',
    insuranceTypeId: plan?.insuranceTypeId ?? '',
    newTypeName: '',
    isActive: plan?.isActive ?? true,
  });

  const creatingType = values.insuranceTypeId === NEW_TYPE;
  const pending = savePlan.isPending || saveType.isPending;

  // The API requires a code; the shared rule derives one so the employee need not.
  const derivedCode = derivePlanCode(values.name);

  async function submit() {
    const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

    // A brand-new insurance type is created first, then the plan points at it.
    let insuranceTypeId = values.insuranceTypeId;
    if (creatingType) {
      try {
        const created = await saveType.mutateAsync({ name: values.newTypeName.trim() });
        insuranceTypeId = created.id;
      } catch (error) {
        applyError(error, 'the insurance type');
        return;
      }
    }

    savePlan.mutate(
      {
        name: values.name.trim(),
        code: values.code.trim() === '' ? derivedCode : values.code.trim(),
        isActive: values.isActive,
        // Company and type are fixed after creation, so only sent when creating.
        ...(plan ? {} : { companyId, insuranceTypeId }),
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

        {plan ? null : (
          <Field
            label="Insurance type"
            required
            error={fieldErrors.insuranceTypeId}
            hint="Groups plans and the benefits available to them."
          >
            {(props) => (
              <Select
                {...props}
                value={values.insuranceTypeId}
                onChange={(event) => setValue('insuranceTypeId', event.target.value)}
              >
                <option value="">Select an insurance type</option>
                {(insuranceTypes.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
                <option value={NEW_TYPE}>+ Create a new insurance type…</option>
              </Select>
            )}
          </Field>
        )}

        {creatingType ? (
          <Field label="New insurance type name" required error={fieldErrors.newTypeName}>
            {(props) => (
              <Input
                {...props}
                value={values.newTypeName}
                onChange={(event) => setValue('newTypeName', event.target.value)}
                placeholder="Name this category of insurance"
              />
            )}
          </Field>
        ) : null}

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
