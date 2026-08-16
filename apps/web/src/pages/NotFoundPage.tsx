import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        title="This page does not exist"
        action={<ButtonLink to={ROUTES.dashboard}>Go to dashboard</ButtonLink>}
      />
    </>
  );
}
