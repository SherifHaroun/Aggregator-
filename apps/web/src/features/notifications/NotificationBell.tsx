import {
  LEAD_STAGE_LABELS,
  describeLeadActivity,
  describeLeadDetail,
  type LeadDto,
  type LeadStageId,
} from '@aggregator/shared';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Badge, IconCheck, IconChevronRight, IconClose, describeError } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { formatCartDate } from '@/features/customers/CartItemList';
import { initials } from '@/features/customers/initials';
import { cn } from '@/lib/cn';
import { claimGreeting, useAutoOpenPreference } from './notification-preferences';
import {
  useMarkAllNotificationsSeen,
  useMarkNotificationSeen,
  useNotifications,
} from './notifications.api';

/**
 * THE BELL, AND THE PANEL BEHIND IT.
 *
 * The number on the bell is how many leads the employee has not yet seen at
 * their current stage. Pressing it slides a narrow panel in from the right
 * — a column, never the whole screen — listing every recent visit to the
 * customer site, newest activity first: who, what they last did ("chose
 * Arope · Gold"), the price, whether the PDF reached them, and when.
 * Opening a row marks it seen and goes to the customer's page.
 *
 * WHEN THE ADMIN IS OPENED the panel slides in on its own if there is
 * anything new — once per tab, not on every page — unless the employee has
 * turned that off in the panel's own settings. The preference is this
 * browser's; the leads are everybody's.
 *
 * TWO BELLS, ONE PANEL. The shell draws the bell twice — in the phone's top
 * bar and in the desktop row — and only one is ever visible. Whether the
 * panel is open is therefore kept OUTSIDE the components, in one small
 * store both bells read, and the panel itself (`NotificationPanel`) is
 * rendered once by the shell. Otherwise the hidden bell would claim the
 * greeting and open a panel nobody can see.
 */

// --- the one open/closed flag both bells share -----------------------------

let panelOpen = false;
const panelListeners = new Set<() => void>();

function setPanelOpen(value: boolean): void {
  if (panelOpen === value) return;
  panelOpen = value;
  for (const listener of panelListeners) listener();
}

function subscribePanel(listener: () => void): () => void {
  panelListeners.add(listener);
  return () => panelListeners.delete(listener);
}

function usePanelOpen(): [boolean, (value: boolean) => void] {
  const open = useSyncExternalStore(
    subscribePanel,
    () => panelOpen,
    () => false,
  );
  return [open, setPanelOpen];
}

// --- the bell -----------------------------------------------------------------

export function NotificationBell({ className }: { className?: string }) {
  const feed = useNotifications();
  const [open, setOpen] = usePanelOpen();
  const [ringing, setRinging] = useState(false);
  const lastCount = useRef<number | null>(null);

  const unseen = feed.data?.unseenCount ?? 0;

  /* More than before: something new arrived while the admin was open. Ring. */
  useEffect(() => {
    if (!feed.data) return;
    if (lastCount.current !== null && feed.data.unseenCount > lastCount.current) {
      setRinging(true);
      const timer = window.setTimeout(() => setRinging(false), 1200);
      lastCount.current = feed.data.unseenCount;
      return () => window.clearTimeout(timer);
    }
    lastCount.current = feed.data.unseenCount;
    return undefined;
  }, [feed.data]);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`Notifications, ${unseen} new`}
      data-testid="notification-bell"
      className={cn(
        'border-border-subtle bg-surface text-content-muted hover:border-border-strong hover:text-content relative flex size-11 items-center justify-center rounded-(--radius-control) border shadow-(--shadow-card) transition-colors',
        open && 'border-brand text-brand',
        className,
      )}
    >
      <IconBell className={cn('size-5', ringing && 'animate-notification-bell')} />
      {feed.data ? (
        <span
          aria-hidden
          data-testid="notification-count"
          className={cn(
            'absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold tabular-nums',
            unseen > 0 ? 'bg-accent text-brand-strong' : 'bg-surface-muted text-content-subtle',
          )}
        >
          {unseen}
        </span>
      ) : null}
    </button>
  );
}

// --- the panel ----------------------------------------------------------------

/** Rendered ONCE by the shell. Owns the greeting, the settings and the list. */
export function NotificationPanel() {
  const feed = useNotifications();
  const [open, setOpen] = usePanelOpen();
  const [autoOpen, setAutoOpen] = useAutoOpenPreference();
  const [showSettings, setShowSettings] = useState(false);
  const greeted = useRef(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const markSeen = useMarkNotificationSeen();
  const markAll = useMarkAllNotificationsSeen();

  const unseen = feed.data?.unseenCount ?? 0;
  const notifications = feed.data?.notifications ?? [];

  /* The greeting: once the feed has answered, once per tab, only with news. */
  useEffect(() => {
    if (!feed.data || greeted.current) return;
    greeted.current = true;
    if (feed.data.unseenCount > 0 && autoOpen && claimGreeting()) setOpen(true);
  }, [feed.data, autoOpen, setOpen]);

  /* Close on navigation: a row leads somewhere, and the panel would be in the way. */
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setOpen(false);
    setShowSettings(false);
  }, [pathname, setOpen]);

  /* Gone with the shell — a sign-out, a test — it is closed for whoever comes next. */
  useEffect(() => () => setPanelOpen(false), []);

  /* Escape closes it. */
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  function openLead(lead: LeadDto) {
    if (lead.seenAt === null) markSeen.mutate(lead.id);
    navigate(ROUTES.customers.detail(lead.customerId));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      {/* The shade: a click anywhere on it closes the panel. */}
      <button
        type="button"
        aria-label="Close notifications"
        onClick={() => setOpen(false)}
        className="animate-notification-fade absolute inset-0 bg-black/25 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-label="Notifications"
        data-testid="notification-panel"
        className="animate-notification-panel bg-surface absolute top-3 right-3 bottom-3 flex w-[min(92vw,24rem)] flex-col overflow-hidden rounded-(--radius-card) shadow-(--shadow-raised)"
      >
        <header className="border-border-subtle bg-brand-strong flex items-center gap-3 border-b px-4 py-3 text-white">
          <IconBell className="size-5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="truncate text-xs text-white/70">
              {feed.data
                ? unseen === 0
                  ? 'Nothing new. You are up to date.'
                  : `${unseen} new ${unseen === 1 ? 'lead' : 'leads'} from the website`
                : 'Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((current) => !current)}
            aria-label="Notification settings"
            aria-pressed={showSettings}
            className={cn(
              'flex size-9 items-center justify-center rounded-(--radius-control) text-white/80 transition-colors hover:bg-white/10 hover:text-white',
              showSettings && 'bg-white/15 text-white',
            )}
          >
            <IconGear className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
            className="flex size-9 items-center justify-center rounded-(--radius-control) text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconClose className="size-4" />
          </button>
        </header>

        {showSettings ? (
          <div className="border-border-subtle bg-brand-soft/50 border-b px-4 py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={autoOpen}
                onChange={(event) => setAutoOpen(event.target.checked)}
                className="accent-brand mt-0.5 size-4"
              />
              <span>
                <span className="text-content block text-sm font-semibold">
                  Open this panel when I arrive
                </span>
                <span className="text-content-muted block text-xs leading-relaxed">
                  When the admin opens and there are new leads, the panel slides in on its own. Turn
                  it off and the bell only shows the count.
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="border-border-subtle flex items-center justify-between border-b px-4 py-2">
          <p className="text-content-subtle text-xs">
            {notifications.length} recent {notifications.length === 1 ? 'visit' : 'visits'}
          </p>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={unseen === 0 || markAll.isPending}
            className="text-brand-strong inline-flex items-center gap-1 text-xs font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconCheck className="size-3.5" />
            Mark all as seen
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {feed.isPending ? (
            <p className="text-content-subtle px-4 py-6 text-sm">Loading…</p>
          ) : feed.error ? (
            <p role="alert" className="text-danger px-4 py-6 text-sm">
              {describeError(feed.error, 'the notifications')}
            </p>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="bg-brand-soft text-brand-strong mx-auto flex size-12 items-center justify-center rounded-full">
                <IconBell className="size-5" />
              </span>
              <p className="text-content mt-4 text-sm font-semibold">No visits yet</p>
              <p className="text-content-muted mt-1 text-xs leading-relaxed">
                The moment somebody compares plans on the website and leaves their details, they
                appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-(--color-border-subtle)">
              {notifications.map((lead) => (
                <li key={lead.id}>
                  <NotificationRow lead={lead} onOpen={() => openLead(lead)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-border-subtle bg-surface-muted/60 border-t px-4 py-3">
          <Link
            to={ROUTES.customers.list}
            className="text-brand-strong inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            All customers
            <IconChevronRight className="size-4" />
          </Link>
        </footer>
      </aside>
    </div>
  );
}

const STAGE_TONE: Record<LeadStageId, 'neutral' | 'brand' | 'success'> = {
  COMPARED: 'neutral',
  VIEWED: 'brand',
  CHOSEN: 'success',
};

function NotificationRow({ lead, onOpen }: { lead: LeadDto; onOpen: () => void }) {
  const fresh = lead.seenAt === null;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="notification"
      data-unseen={fresh ? 'true' : 'false'}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
        fresh ? 'bg-brand-soft/40 hover:bg-brand-soft/70' : 'hover:bg-surface-muted',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          fresh ? 'bg-brand text-content-inverted' : 'bg-brand-soft text-brand-strong',
        )}
      >
        {initials(lead.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn('text-content min-w-0 flex-1 truncate text-sm', fresh && 'font-semibold')}
          >
            {describeLeadActivity(lead)}
          </span>
          {fresh ? (
            <span aria-label="New" className="bg-accent size-2 shrink-0 rounded-full" />
          ) : null}
        </span>
        <span className="text-content-muted mt-0.5 block truncate text-xs">
          {describeLeadDetail(lead) || lead.email}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge tone={STAGE_TONE[lead.stage]}>{LEAD_STAGE_LABELS[lead.stage]}</Badge>
          <span className="text-content-subtle text-[0.7rem]">
            {formatCartDate(lead.lastActivityAt)}
          </span>
        </span>
      </span>
      <IconChevronRight className="text-content-subtle mt-2 size-4 shrink-0" />
    </button>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
