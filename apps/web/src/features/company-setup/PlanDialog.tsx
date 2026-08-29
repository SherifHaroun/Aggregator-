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
  useMedicalNetworks,
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
  // Only THIS company's networks. Another insurer's list is not on offer here.
  const networks = useMedicalNetworks(companyId);
  const savePlan = useSavePlan(plan?.id);
  const saveType = useSaveInsuranceType();

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: plan?.name ?? '',
    code: plan?.code ?? '',
    insuranceTypeId: plan?.insuranceTypeId ?? '',
    newTypeName: '',
    medicalNetworkId: plan?.medicalNetworkId ?? '',
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
        // The type can be corrected at any time; the company cannot change.
        insuranceTypeId,
        // Empty means the document does not say — never an invented network.
        medicalNetworkId: blankToNull(values.medicalNetworkId),
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

        {/* Offered when editing too: a plan filed under the wrong type is
            corrected here, and nothing it carries is affected. */}
        <Field
          label="Insurance type"
          required
          error={fieldErrors.insuranceTypeId}
          hint={
            plan
              ? 'Decides which comparison this plan answers. Its benefits and prices are unaffected.'
              : 'Groups plans and the benefits available to them.'
          }
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

        {/* Chosen from the company's own list, never typed: a network is the
            company's, and a name invented here would belong to nothing. */}
        <Field
          label="Medical network"
          error={fieldErrors.medicalNetworkId}
          hint={
            (networks.data?.length ?? 0) === 0
              ? 'This company has no networks yet. Add them on the company screen.'
              : 'The company network this plan is sold on. Leave blank where the document does not say.'
          }
        >
          {(props) => (
            <Select
              {...props}
              value={values.medicalNetworkId}
              disabled={(networks.data?.length ?? 0) === 0}
              onChange={(event) => setValue('medicalNetworkId', event.target.value)}
            >
              <option value="">Not stated</option>
              {(networks.data ?? []).map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

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
