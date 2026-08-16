# Insurance Aggregator (internal)

Internal web application for an insurance company. Employees enter and manage
real insurance information through the website and compare available plans.
There is no public, customer-facing side.

> **Status.** The insurance data model, its management API, and the employee
> management interface are implemented — an employee can enter and maintain all
> insurance data through the website. Authentication, reports and the comparison
> engine are not.

## Principles

1. **The database is the source of truth.** No insurance company, plan, price,
   benefit, coverage percentage or limit is ever hardcoded in the frontend, and
   there is no seed or demo data. Everything is entered by employees through the
   application.
2. **Business rules live in one place.** See
   [`packages/shared/src/config/business-rules.ts`](packages/shared/src/config/business-rules.ts).
   Never repeat a business constant inside a component or a route handler.
3. **Configuration drives the UI.** Selection screens render whatever the shared
   configuration describes, so options can be added, renamed, reordered or
   disabled without touching components.

## Stack

| Layer    | Technology                                             |
| -------- | ------------------------------------------------------ |
| Client   | React 18, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query |
| API      | Node.js, Express, TypeScript, Zod                       |
| Database | PostgreSQL via Prisma                                   |
| Repo     | npm workspaces monorepo                                 |

## Layout

```
packages/shared   business rules, configuration, types — used by API and client
apps/api          Express + Prisma API
apps/web          React web client
```

## Getting started

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in `DATABASE_URL` in `apps/api/.env`, then generate the Prisma client and
apply the migrations to an empty database:

```bash
npm run prisma:generate
```

```bash
npm run prisma:migrate
```

The database starts empty by design. There is no seed script — every company,
plan, option and benefit is entered by employees through the application.

Run everything (shared package in watch mode, API, web client):

```bash
npm run dev
```

- Web client: http://localhost:5173
- API: http://localhost:4000/api/v1

## Scripts

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `npm run dev`            | Shared watch build + API + web client           |
| `npm run build`          | Build all workspaces                            |
| `npm run typecheck`      | Type-check all workspaces                       |
| `npm run prisma:generate`| Regenerate the Prisma client                    |
| `npm run prisma:migrate` | Create and apply a migration                    |
| `npm run test`           | Run the test suites                             |
| `npm run format`         | Prettier                                        |

See [ARCHITECTURE.md](ARCHITECTURE.md) for where things belong and how to extend
them.
