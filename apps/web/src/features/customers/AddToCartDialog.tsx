import {
  presentPremium,
  type ComparisonPlanResult,
  type ComparisonRequestInput,
  type CustomerDto,
} from '@aggregator/shared';
import { useState } from 'react';
import {
  Button,
  Callout,
  Dialog,
  Field,
  Select,
  Textarea,
  describeError,
  useToast,
} from '@/components/ui';
import { useAddCartItem } from './customers.api';

/**
 * ADD A COMPARISON TO THE CUSTOMER'S CART.
 *
 * The customer was chosen before the comparison was run, so there is nobody
 * to pick here: say which of the plans the comparison is being kept with —
 * the recommended one unless the employee says otherwise — write a note if
 * there is one, and press Add. The entry is named by the system ("Arope
 * SME 1") and dated when it lands.
 */
export function AddToCartDialog({
  customer,
  plans,
  criteria,
  defaultPlanId,
  onClose,
}: {
  /** Whose cart it goes into — the customer the comparison was run for. */
  customer: CustomerDto;
  /** Every plan in the results, best value first. */
  plans: ComparisonPlanResult[];
  /** The selection the comparison was run from. */
  criteria: ComparisonRequestInput;
  /** Which plan to offer first — the one the employee was looking at. */
  defaultPlanId?: string | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const addItem = useAddCartItem();

  const [planId, setPlanId] = useState(
    defaultPlanId ??
      plans.find((plan) => plan.isRecommended)?.configurationId ??
      plans[0]?.configurationId ??
      '',
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!planId) {
      setError('Choose the plan to keep this comparison with.');
      return;
    }
    addItem.mutate(
      { customerId: customer.id, planConfigurationId: planId, criteria, note: note.trim() || null },
      {
        onSuccess: (item) => {
          notify(`${item.name} was added to ${customer.name}’s cart.`);
          onClose();
        },
        onError: (failure) => setError(describeError(failure, 'the cart')),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Add to ${customer.name}’s cart`}
      description="Keep this comparison for the customer until they decide. It is named for the insurer and section, and numbered."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={addItem.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={addItem.isPending}>
            {addItem.isPending ? 'Adding…' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error ? (
          <Callout tone="danger" title="Could not add to the cart">
            {error}
          </Callout>
        ) : null}

        <Field
          label="Plan"
          hint="The plan this comparison is kept with. The recommended one is offered first."
        >
          {(props) => (
            <Select {...props} value={planId} onChange={(event) => setPlanId(event.target.value)}>
              {plans.map((plan) => (
                <option key={plan.configurationId} value={plan.configurationId}>
                  {plan.companyName} · {plan.planName} · {presentPremium(plan)}
                  {plan.isRecommended ? ' (recommended)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Note" hint="Optional. Shown under the name when the cart is opened.">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={note}
              placeholder="e.g. Wants a private room; call back Thursday."
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
