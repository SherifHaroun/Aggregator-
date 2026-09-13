/**
 * CUSTOMERS, AND THE COMPARISONS KEPT FOR THEM.
 *
 * The broker's employees take calls. A caller becomes a customer record and
 * the comparisons run for them go into the customer's CART — a working list,
 * first to last, until the customer settles on one and it is marked chosen.
 *
 * WHAT IS KEPT is honest about where it came from. An entry is made by
 * running the customer's comparison again on the server and reading the
 * plan out of the result: the premium written down is the one the engine
 * worked out for these ages and this workforce, never a figure the screen
 * sent in. The selection is kept with it, so the results open again exactly
 * as the customer saw them.
 *
 * Nothing here is insurance data. No record is seeded.
 */

import {
  cartItemName,
  nextCartNameSequence,
  type CartSummaryDto,
  type ComparisonRequestInput,
  type CustomerCartItemDto,
  type CustomerDto,
  type CustomerWithCartDto,
} from '@aggregator/shared';
import type { Customer, CustomerCartItem, Prisma } from '@prisma/client';
import { toIso, toNumber } from '../../lib/decimal.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getPrisma } from '../../lib/prisma.js';
import { runComparison } from '../comparison/comparison.service.js';
import type {
  AddCartItemPayload,
  CreateCustomerInput,
  UpdateCartItemInput,
  UpdateCustomerInput,
} from './customers.schemas.js';

/** A customer read with what the list needs to say about their cart. */
type CustomerWithCounts = Customer & {
  cartItems: Pick<CustomerCartItem, 'id' | 'chosenAt'>[];
};

/** Items first to last: the order the comparisons were run in. */
const itemsInOrder = { orderBy: { createdAt: 'asc' as const } } as const;

const withCounts = {
  cartItems: { select: { id: true, chosenAt: true }, ...itemsInOrder },
} as const;

const withCart = { cartItems: itemsInOrder } as const;

function toCustomerDto(customer: CustomerWithCounts): CustomerDto {
  return {
    id: customer.id,
    name: customer.name,
    source: customer.source === 'WEBSITE' ? 'WEBSITE' : 'STAFF',
    phone: customer.phone,
    email: customer.email,
    companyName: customer.companyName,
    createdAt: toIso(customer.createdAt),
    updatedAt: toIso(customer.updatedAt),
    cartCount: customer.cartItems.length,
    chosenItemId: customer.cartItems.find((item) => item.chosenAt !== null)?.id ?? null,
  };
}

/**
 * The selection, back in the shape the screens send. Stored as the engine
 * validated it, so reading it is a cast rather than a second validation —
 * nothing gets in here that did not pass `comparisonRequestSchema`.
 */
function toCriteria(value: Prisma.JsonValue): ComparisonRequestInput {
  return value as unknown as ComparisonRequestInput;
}

export function toCartItemDto(item: CustomerCartItem): CustomerCartItemDto {
  return {
    id: item.id,
    customerId: item.customerId,
    name: item.name,
    note: item.note,
    planConfigurationId: item.planConfigurationId,
    planId: item.planId,
    companyId: item.companyId,
    companyName: item.companyName,
    planName: item.planName,
    customerTypeId: item.customerType,
    annualPrice: toNumber(item.annualPrice),
    currency: item.currency,
    criteria: toCriteria(item.criteria),
    isChosen: item.chosenAt !== null,
    chosenAt: item.chosenAt === null ? null : toIso(item.chosenAt),
    createdAt: toIso(item.createdAt),
  };
}

function toCustomerWithCartDto(
  customer: Customer & { cartItems: CustomerCartItem[] },
): CustomerWithCartDto {
  return {
    ...toCustomerDto(customer),
    items: customer.cartItems.map(toCartItemDto),
  };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function listCustomers({ search }: { search?: string } = {}): Promise<CustomerDto[]> {
  const customers = await getPrisma().customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {},
    include: withCounts,
    orderBy: { name: 'asc' },
  });
  return customers.map(toCustomerDto);
}

export async function getCustomer(id: string): Promise<CustomerWithCartDto> {
  const customer = await getPrisma().customer.findUnique({ where: { id }, include: withCart });
  if (!customer) throw notFound('Customer');
  return toCustomerWithCartDto(customer);
}

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerDto> {
  const customer = await getPrisma().customer.create({
    data: {
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      companyName: input.companyName ?? null,
    },
    include: withCounts,
  });
  return toCustomerDto(customer);
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerDto> {
  const prisma = getPrisma();
  const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Customer');

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
    },
    include: withCounts,
  });
  return toCustomerDto(customer);
}

/** Deleting a customer takes their cart with it — it was theirs alone. */
export async function deleteCustomer(id: string): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Customer');
  await prisma.customer.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// The cart
// ---------------------------------------------------------------------------

/**
 * Everything in every cart, for the button that shows how many comparisons
 * are waiting. Customers with an empty cart are left out: the button opens
 * onto who has something to discuss, not the whole address book.
 */
export async function getCartSummary(): Promise<CartSummaryDto> {
  const customers = await getPrisma().customer.findMany({
    where: { cartItems: { some: {} } },
    include: withCart,
    orderBy: { name: 'asc' },
  });
  const withCarts = customers.map(toCustomerWithCartDto);
  return {
    totalItems: withCarts.reduce((sum, customer) => sum + customer.items.length, 0),
    customers: withCarts,
  };
}

/**
 * Keep a comparison for a customer.
 *
 * The comparison is RUN AGAIN here and the plan read out of its result. That
 * is what makes the premium on the entry the customer's own: the engine
 * priced it for their ages or their workforce, and a screen cannot hand in
 * a different figure. A plan that is not in the result — changed since the
 * screen was drawn, or never in it — is refused rather than saved on trust.
 */
export async function addCartItem(
  customerId: string,
  input: AddCartItemPayload,
): Promise<CustomerCartItemDto> {
  const prisma = getPrisma();
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { cartItems: { select: { companyId: true, customerType: true, nameSequence: true } } },
  });
  if (!customer) throw notFound('Customer');

  const result = await runComparison(input.criteria);
  const plan = [...result.plans, ...result.overBudgetPlans].find(
    (candidate) => candidate.configurationId === input.planConfigurationId,
  );
  if (!plan) {
    throw badRequest('That plan is not in this comparison. Run the comparison again and retry.', {
      planConfigurationId: ['Not in this comparison.'],
    });
  }

  const sequence = nextCartNameSequence(
    customer.cartItems.map((item) => ({
      companyId: item.companyId,
      customerTypeId: item.customerType,
      nameSequence: item.nameSequence,
    })),
    plan.companyId,
    result.criteria.customerTypeId,
  );

  const item = await prisma.customerCartItem.create({
    data: {
      customerId,
      name: cartItemName(plan.companyName, result.criteria.customerTypeId, sequence),
      nameSequence: sequence,
      note: input.note ?? null,
      planConfigurationId: plan.configurationId,
      planId: plan.planId,
      companyId: plan.companyId,
      companyName: plan.companyName,
      planName: plan.planName,
      customerType: result.criteria.customerTypeId,
      annualPrice: plan.annualPrice,
      currency: plan.currency,
      criteria: input.criteria as unknown as Prisma.InputJsonValue,
    },
  });
  return toCartItemDto(item);
}

async function findCartItem(customerId: string, itemId: string): Promise<CustomerCartItem> {
  const item = await getPrisma().customerCartItem.findFirst({
    where: { id: itemId, customerId },
  });
  if (!item) throw notFound('Cart item');
  return item;
}

/**
 * Change the note, or mark the entry as the one the customer chose.
 *
 * A customer chooses ONE plan, so choosing this entry clears the choice from
 * any other in the same cart; un-choosing it leaves the cart with no choice
 * until another is made.
 */
export async function updateCartItem(
  customerId: string,
  itemId: string,
  input: UpdateCartItemInput,
): Promise<CustomerCartItemDto> {
  const prisma = getPrisma();
  await findCartItem(customerId, itemId);

  const item = await prisma.$transaction(async (tx) => {
    if (input.chosen === true) {
      await tx.customerCartItem.updateMany({
        where: { customerId, id: { not: itemId }, chosenAt: { not: null } },
        data: { chosenAt: null },
      });
    }
    return tx.customerCartItem.update({
      where: { id: itemId },
      data: {
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.chosen === true ? { chosenAt: new Date() } : {}),
        ...(input.chosen === false ? { chosenAt: null } : {}),
      },
    });
  });
  return toCartItemDto(item);
}

export async function removeCartItem(customerId: string, itemId: string): Promise<void> {
  await findCartItem(customerId, itemId);
  await getPrisma().customerCartItem.delete({ where: { id: itemId } });
}
