import { AVERAGE_AGE_LABEL_PREFIX, type ResolvedComparisonCriteria } from '@aggregator/shared';
import { Card, CardBody, CardHeader, SummaryList, type SummaryItem } from '@/components/ui';

/**
 * Read-back of the resolved selections.
 *
 * The average age line is rendered from `resolved.averageAge`, which the shared
 * rules produce — this component contains no age logic of its own.
 */
export function ComparisonCriteriaSummary({
  resolved,
}: {
  resolved: ResolvedComparisonCriteria;
}) {
  const items: SummaryItem[] = [
    { label: 'Insured', value: resolved.customerTypeLabel },
    { label: 'Geographical coverage', value: resolved.geographicalCoverageLabel },
  ];

  // Rendered whenever the rules resolved an age — currently SME's fixed average.
  if (resolved.averageAge.value !== null) {
    items.push({ label: AVERAGE_AGE_LABEL_PREFIX, value: resolved.averageAge.value });
  }

  return (
    <Card>
      <CardHeader title="Selection summary" description="These criteria will be compared." />
      <CardBody>
        <SummaryList items={items} />
      </CardBody>
    </Card>
  );
}
