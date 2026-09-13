import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBuilding,
  IconCheck,
  IconGlobe,
  IconLayers,
  IconShield,
  IconSparkle,
  IconUsers,
} from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';

/**
 * THE BROKER'S OWN PAGES — who Hadbrok is and how to reach them.
 *
 * The old company site carried these as long columns of text; here they
 * are the same facts, told in the site's own voice and frame, so a visitor
 * never has to leave to learn who they are dealing with. Nothing on these
 * pages is read from the API: it is the broker's story, and it changes
 * about as often as the licence number.
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const PHONE_MOBILE = '+20 12 2235 2235';
export const PHONE_OFFICE = '+2 02 3304 4664';
export const FAX = '+2 02 3346 4810';
export const EMAIL = 'info@hadbrok.com';
export const ADDRESS = 'Degla Medical Center, Building 203, Dijla Square, Maadi, Cairo';
export const POST_BOX = 'P.O. Box 60, Imbaba, Giza, Egypt';
export const HOURS = '9am to 5pm, Sunday to Thursday';
export const tel = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;

// --- the frame every company page shares --------------------------------------

function CompanyPage({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <>
      <section className="bg-brand-gradient relative overflow-hidden text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="bg-accent/20 pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">{eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            {lede}
          </p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">{children}</div>
    </>
  );
}

function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-brand-strong scroll-mt-24 text-2xl font-extrabold tracking-tight sm:text-3xl"
    >
      {children}
    </h2>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="text-content mt-4 max-w-3xl space-y-4 text-base leading-relaxed">
      {children}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="bg-surface border-border-subtle flex flex-col rounded-(--radius-card) border p-6 shadow-(--shadow-card) transition-transform hover:-translate-y-1">
      <span className="bg-brand-gradient flex size-12 items-center justify-center rounded-(--radius-control) text-white">
        <Icon className="size-6" />
      </span>
      <h3 className="text-brand-strong mt-4 text-lg font-bold">{title}</h3>
      <div className="text-content-muted mt-2 text-sm leading-relaxed">{children}</div>
    </article>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed">
          <IconCheck className="text-brand mt-0.5 size-4 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface border-border-subtle rounded-(--radius-card) border p-5 text-center shadow-(--shadow-card)">
      <p className="text-brand-strong text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="text-content-muted mt-1 text-sm">{label}</p>
    </div>
  );
}

/** The closing band every page ends on: the two things a visitor can do next. */
function NextSteps() {
  return (
    <section className="bg-brand-strong mt-16 rounded-(--radius-card) p-8 text-white shadow-(--shadow-raised) sm:p-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Ready when you are</h2>
          <p className="mt-2 max-w-xl text-sm text-white/80">
            Compare the plans on the market in a minute, or talk to one of our agents.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`${ROUTES.home}#compare`}
            className="bg-accent text-brand-strong rounded-(--radius-control) px-5 py-2.5 text-sm font-bold shadow-(--shadow-card)"
          >
            Compare plans
          </Link>
          <a
            href={tel(PHONE_MOBILE)}
            className="rounded-(--radius-control) border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Call {PHONE_MOBILE}
          </a>
        </div>
      </div>
    </section>
  );
}

// --- About us ----------------------------------------------------------------------

export function AboutPage() {
  return (
    <CompanyPage
      eyebrow="About us"
      title="Egypt’s insurance broker since 1982"
      lede="Hadbrok puts the client first: cover designed around your life or your business, explained plainly, and backed by partnerships that put your well-being ahead of the policy."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile value="1982" label="Serving Egypt since" />
        <StatTile value="7+" label="Countries across the Middle East and Africa" />
        <StatTile value="50+" label="Years of insurance experience behind the founder" />
        <StatTile value="No. 17" label="Licensed broker with the FRA (formerly EFSA)" />
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-12">
          <section>
            <SectionTitle>Who we are</SectionTitle>
            <Prose>
              <p>
                Hadbrok Insurance Brokers has been part of the Egyptian insurance market since 1982
                and leads it today as the country’s premier broker, working with everyone from
                private individuals and families to large corporations in the public and private
                sectors.
              </p>
              <p>
                We are known for designing tailor-made policies, implementing global insurance
                programmes for international groups, and handling the “difference in conditions” and
                “difference in limits” cover those programmes need to work locally.
              </p>
            </Prose>
          </section>

          <section>
            <SectionTitle>Where we are</SectionTitle>
            <Prose>
              <p>
                From our base in Egypt, Hadbrok reaches across the Middle East and Africa. We
                operate today in more than seven countries, including the UAE, Saudi Arabia,
                Lebanon, Jordan, Palestine, Kenya and Ethiopia.
              </p>
            </Prose>
          </section>

          <section>
            <SectionTitle>The founder</SectionTitle>
            <Prose>
              <p>
                Hadbrok was founded by Paul Haddad, an insurance veteran with more than fifty years
                in the sector. Working with leading Lebanese and Saudi businessmen he helped build
                successful insurance and reinsurance companies in the Middle East and in Europe, in
                Paris and London.
              </p>
              <p>
                In the 1980s he expanded to the United States, establishing River Oaks Holding
                Company and taking full ownership of American Southern Insurance Co. and American
                Specialty Insurance Co. in Atlanta, and Tri Star Insurance Co. in Los Angeles.
              </p>
              <p>
                Returning to the Middle East in 1992, he turned to brokerage and risk management,
                where the region had an unmet need, and chose Egypt as the hub from which to build a
                family of specialist companies: general insurance brokerage and risk management,
                fleet management, medical third-party administration, insurance technology and
                reinsurance.
              </p>
            </Prose>
          </section>

          <section>
            <SectionTitle>What drives us</SectionTitle>
            <Prose>
              <p>
                The pioneering spirit that began in Saudi Arabia in the 1960s still sets our course.
                We develop solutions for markets that need them most, we stay at the front of the
                insurtech era, and we keep reshaping what an insurance broker can do for the people
                and businesses who rely on one.
              </p>
            </Prose>
          </section>
        </div>

        <aside className="space-y-4 lg:pt-2">
          <FeatureCard icon={IconShield} title="Client first">
            Cover chosen for your needs, not the insurer’s. We are paid to find you the right policy
            at the right price.
          </FeatureCard>
          <FeatureCard icon={IconGlobe} title="Global programmes, local hands">
            International cover that works in Egypt, arranged and serviced by people who know the
            market.
          </FeatureCard>
          <FeatureCard icon={IconSparkle} title="Insurtech ready">
            This site compares the market for you in a minute. It is the same engine our agents use
            on the phone.
          </FeatureCard>
        </aside>
      </div>

      <NextSteps />
    </CompanyPage>
  );
}

// --- Services ------------------------------------------------------------------------

const PILLARS: { icon: Icon; title: string; points: string[]; role: string }[] = [
  {
    icon: IconShield,
    title: 'Risk management',
    points: [
      'Risk profile: identification and evaluation',
      'Risk control: elimination, reduction and prevention',
      'Risk transfer: external and internal',
    ],
    role: 'Our role is to make sure the insured risks are covered at their replacement value.',
  },
  {
    icon: IconUsers,
    title: 'Claims management',
    points: [
      'The shortest line of communication between you, the insurer and any third-party administrator',
      'Daily claim handling through to a conclusion, facilitating and resolving disputes',
      'Statistics and comparisons for your renewal strategy, and losses handled below retention',
    ],
    role: 'Our role is to stand with you at claim time, through a comprehensive approach to settlement.',
  },
  {
    icon: IconLayers,
    title: 'Premium management',
    points: ['Premium invoicing', 'Supervision and payment', 'Local requirements and taxes'],
    role: 'Our role is to hold every insurer to our standard: financially sound, responsive, and good at service.',
  },
  {
    icon: IconBuilding,
    title: 'Policy management',
    points: [
      'A lighter administrative load: policies, wordings and procedures handled for you',
      'An effective renewal strategy from periodic reviews and up-to-date risk information',
      'New cover for new exposures or new sites',
    ],
    role: 'Our role is to find the best practice on the local market, or the international one through our worldwide network.',
  },
];

export function ServicesPage() {
  return (
    <CompanyPage
      eyebrow="Services"
      title="Know-how, and what it adds"
      lede="Our objective is simple: every risk you carry is evaluated, quantified and covered, and every insurer we place you with earns the trust."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="bg-surface border-border-subtle rounded-(--radius-card) border p-7 shadow-(--shadow-card)">
          <SectionTitle>How we approach your risks</SectionTitle>
          <ol className="mt-5 space-y-4">
            {[
              'Identify the non-commercial risks that could do financial damage to your activity.',
              'Quantify them, using every tool of risk measurement.',
              'Rank them by potential damage and how likely they are to strike together.',
              'Reduce every risk that can be controlled.',
              'Decide, risk by risk, whether to retain it or transfer it to an insurer.',
            ].map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="bg-brand-strong flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-content pt-1 text-sm leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-surface border-border-subtle rounded-(--radius-card) border p-7 shadow-(--shadow-card)">
          <SectionTitle>Between you and the insurer</SectionTitle>
          <CheckList
            items={[
              'Insured risks are covered at their replacement value.',
              'The best practice on the market, locally or internationally through our worldwide network.',
              'Every insurer meets our standard for financial strength, service, quality and reactivity.',
              'You are never alone at claim time: a comprehensive approach to settlement.',
            ]}
          />
        </section>
      </div>

      <section className="mt-14">
        <SectionTitle>What we manage for you</SectionTitle>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {PILLARS.map(({ icon: Icon, title, points, role }) => (
            <article
              key={title}
              className="bg-surface border-border-subtle flex flex-col rounded-(--radius-card) border shadow-(--shadow-card)"
            >
              <div className="bg-brand-gradient flex items-center gap-4 rounded-t-(--radius-card) px-6 py-5 text-white">
                <Icon className="size-7" />
                <h3 className="text-lg font-bold">{title}</h3>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <CheckList items={points} />
                <p className="border-brand text-content-muted mt-5 border-l-4 pl-4 text-sm italic">
                  {role}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <NextSteps />
    </CompanyPage>
  );
}

// --- Regional capabilities -------------------------------------------------------------

const REGION = [
  'Algeria',
  'Bahrain',
  'Dubai',
  'Egypt',
  'Jordan',
  'Kuwait',
  'Lebanon',
  'Morocco',
  'Qatar',
  'Saudi Arabia',
  'Tunisia',
];

export function RegionalPage() {
  return (
    <CompanyPage
      eyebrow="Regional capabilities"
      title="Your projects outside Egypt, covered from here"
      lede="Global solutions, delivered locally: proximity brokerage across the Middle East and Africa, run from our Egyptian platform."
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-10">
          <section>
            <SectionTitle>Why we crossed the border</SectionTitle>
            <Prose>
              <p>
                Hadbrok shares a genuine, lasting interest in protecting all the assets of the
                international and local institutions it serves. It was our clients’ demand for
                service next door that took us beyond Egypt, to provide direct “proximity brokerage”
                in neighbouring countries.
              </p>
              <p>
                Egypt’s privileged position, our multilingual and multicultural staff and our
                technical know-how have placed us across the Middle East and the African continent.
                Today our Egyptian platform delivers its services through privileged regional
                contact offices.
              </p>
            </Prose>
          </section>

          <section>
            <SectionTitle>What the network does</SectionTitle>
            <Prose>
              <p>
                Our network of brokers serves clients throughout the region and the continent,
                providing risk services to regional and multinational entities that lack proper
                insurance representation, and acting as their in-house risk management department.
              </p>
              <p>
                We advise on the customs and regulations of each country, and make the most of
                economies of scale, both in how our clients buy insurance and in how their carriers
                see the risk.
              </p>
            </Prose>
          </section>
        </div>

        <aside>
          <div className="bg-brand-strong rounded-(--radius-card) p-7 text-white shadow-(--shadow-raised)">
            <div className="flex items-center gap-3">
              <IconGlobe className="text-accent size-7" />
              <h2 className="text-lg font-bold">Where we work</h2>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {REGION.map((country) => (
                <li
                  key={country}
                  className="rounded-full border border-white/25 bg-white/5 px-3 py-1 text-sm font-medium"
                >
                  {country}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-white/70">
              Plus the UAE, Palestine, Kenya and Ethiopia through the wider group.
            </p>
          </div>
        </aside>
      </div>

      <NextSteps />
    </CompanyPage>
  );
}

// --- Affiliated companies -------------------------------------------------------------

const AFFILIATES = ['Trust Risk Control', 'EOS RISQ', 'Tristar', 'Brokerslink'];

export function AffiliatedPage() {
  return (
    <CompanyPage
      eyebrow="Affiliated companies"
      title="The company we keep"
      lede="Hadbrok works alongside specialist partners and international broking networks, so that a policy placed in Cairo has the reach of a global programme."
    >
      <section>
        <SectionTitle>Our partners and networks</SectionTitle>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AFFILIATES.map((name) => (
            <li
              key={name}
              className="bg-surface border-border-subtle flex min-h-40 flex-col items-center justify-center rounded-(--radius-card) border p-6 text-center shadow-(--shadow-card) transition-transform hover:-translate-y-1"
            >
              <span className="bg-brand-gradient flex size-12 items-center justify-center rounded-full text-white">
                <IconBuilding className="size-6" />
              </span>
              <h3 className="text-brand-strong mt-4 text-lg font-bold">{name}</h3>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <SectionTitle>Part of a wider group</SectionTitle>
        <Prose>
          <p>
            Hadbrok is one of the specialist companies built from Egypt by founder Paul Haddad,
            spanning general insurance brokerage and risk management, fleet automobile management,
            medical third-party administration, insurance technology and reinsurance. Each does one
            thing well, and together they cover the whole of a client’s risk.
          </p>
        </Prose>
      </section>

      <NextSteps />
    </CompanyPage>
  );
}

// --- Contact us · Careers ----------------------------------------------------------------

function ContactCard({
  icon: Icon,
  title,
  children,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface border-border-subtle flex gap-4 rounded-(--radius-card) border p-6 shadow-(--shadow-card)">
      <span className="bg-brand-gradient flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-white">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-brand-strong text-base font-bold">{title}</h3>
        <div className="text-content mt-1 space-y-1 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

const contactLink = 'text-brand font-semibold hover:underline';

export function ContactPage() {
  return (
    <CompanyPage
      eyebrow="Contact us · Careers"
      title="We’re here to listen"
      lede="Call, write or drop by. An agent picks up Sunday to Thursday, 9am to 5pm, and every message gets a reply."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <ContactCard icon={IconUsers} title="Call us">
          <p>
            <a href={tel(PHONE_OFFICE)} className={contactLink}>
              {PHONE_OFFICE}
            </a>
          </p>
          <p>
            <a href={tel(PHONE_MOBILE)} className={contactLink}>
              {PHONE_MOBILE}
            </a>
          </p>
          <p className="text-content-muted">{HOURS}</p>
        </ContactCard>
        <ContactCard icon={IconSparkle} title="Drop a line">
          <p>
            <a href={`mailto:${EMAIL}`} className={contactLink}>
              {EMAIL}
            </a>
          </p>
          <p className="text-content-muted">We get back to you soon.</p>
        </ContactCard>
        <ContactCard icon={IconBuilding} title="Visit us">
          <p>{ADDRESS}</p>
          <p className="text-content-muted">Post: {POST_BOX}</p>
        </ContactCard>
        <ContactCard icon={IconLayers} title="Fax">
          <p>{FAX}</p>
          <p className="text-content-muted">Any time.</p>
        </ContactCard>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-8">
          <div>
            <SectionTitle>A note on doing business safely</SectionTitle>
            <Prose>
              <p>
                Hadbrok is a registered broker with Egypt’s Financial Regulatory Authority (licence
                no. 17), and our values and principles follow its code of ethics. Please do not
                conduct any insurance transaction that the authority has not authorised. Licensed
                entities give you the support and protection to submit an official claim or
                complaint; if you feel any action did not go through an official channel, contact us
                immediately.
              </p>
            </Prose>
          </div>
          <div>
            <h3 className="text-brand-strong text-lg font-bold">Fraud</h3>
            <Prose>
              <p>
                All communication from us comes from this site and from addresses ending in
                hadbrok.com. All payments are made directly to your insurance company. If you are
                asked to communicate or pay any other way, tell us at once.
              </p>
            </Prose>
          </div>
          <div>
            <h3 className="text-brand-strong text-lg font-bold">Complaints</h3>
            <Prose>
              <p>
                Your view matters to us. Send a complaint to{' '}
                <a href={`mailto:${EMAIL}`} className={contactLink}>
                  {EMAIL}
                </a>{' '}
                or call{' '}
                <a href={tel(PHONE_OFFICE)} className={contactLink}>
                  {PHONE_OFFICE}
                </a>
                , and we will take it up directly.
              </p>
            </Prose>
          </div>
        </section>

        <aside id="careers" className="scroll-mt-24">
          <div className="bg-brand-strong rounded-(--radius-card) p-7 text-white shadow-(--shadow-raised)">
            <div className="flex items-center gap-3">
              <IconSparkle className="text-accent size-7" />
              <h2 className="text-lg font-bold">Careers</h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/85">
              We are always glad to hear from people who want to build a career in insurance
              broking, risk management and claims. Send your CV and a few lines about yourself, and
              we will be in touch when there is a place for you.
            </p>
            <a
              href={`mailto:${EMAIL}?subject=Careers at Hadbrok`}
              className="bg-accent text-brand-strong mt-5 inline-flex rounded-(--radius-control) px-5 py-2.5 text-sm font-bold shadow-(--shadow-card)"
            >
              Send your CV
            </a>
          </div>
        </aside>
      </div>

      <NextSteps />
    </CompanyPage>
  );
}
