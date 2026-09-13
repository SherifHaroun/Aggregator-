/**
 * API v1 router.
 *
 * Every feature is a folder under `src/modules/<feature>` exposing its own
 * router; mount it here. Future modules (auth, comparison, audit) follow the
 * same pattern.
 */

import { Router } from 'express';
import { requireWriteAccess } from '../middleware/access.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { companiesRouter } from '../modules/companies/companies.routes.js';
import { medicalNetworksRouter } from '../modules/medical-networks/medical-networks.routes.js';
import { comparisonRouter } from '../modules/comparison/comparison.routes.js';
import { configurationRouter } from '../modules/configuration/configuration.routes.js';
import { customersRouter } from '../modules/customers/customers.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import {
  insuranceOptionsRouter,
  optionFieldsRouter,
} from '../modules/insurance-options/insurance-options.routes.js';
import { planConfigurationsRouter } from '../modules/plan-configurations/plan-configurations.routes.js';
import { planOptionsRouter } from '../modules/plan-options/plan-options.routes.js';
import { planImportsRouter } from '../modules/plan-imports/plan-imports.routes.js';
import { plansRouter } from '../modules/plans/plans.routes.js';
import { uploadsRouter } from '../modules/uploads/uploads.routes.js';

export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/configuration', configurationRouter);
/** Read-only, and public: running a comparison never writes. */
apiRouter.use('/comparison', comparisonRouter);
/** Signing in, and asking who is signed in. */
apiRouter.use('/auth', authRouter);
/**
 * Customers carry their own rules rather than the write gate's: an employee
 * sees everyone, a signed-in customer sees only themselves (`/customers/me`),
 * and nobody else sees anything. Mounted before the gate so a customer can
 * write to their own cart without being staff.
 */
apiRouter.use('/customers', customersRouter);

/**
 * Reads stay open so a future public aggregator can consume these same
 * resources; writes pass through one staff-only gate. Mounted here rather than
 * per-route so no new endpoint can accidentally skip it.
 */
apiRouter.use(requireWriteAccess);

// Insurance data — every record is created by employees; nothing is seeded.
apiRouter.use('/companies', companiesRouter);
/** The shared list of networks plans are sold on, and each one's provider list. */
apiRouter.use('/medical-networks', medicalNetworksRouter);
apiRouter.use('/insurance-options', insuranceOptionsRouter);
apiRouter.use('/option-fields', optionFieldsRouter);
apiRouter.use('/plans', plansRouter);
apiRouter.use('/plan-configurations', planConfigurationsRouter);
apiRouter.use('/plan-options', planOptionsRouter);
apiRouter.use('/uploads', uploadsRouter);
/** A Word document read into plans for review; publishing goes through the routes above. */
apiRouter.use('/plan-imports', planImportsRouter);
