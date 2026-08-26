import type { QueryClient } from '@tanstack/react-query';
import { CompanyService } from '@/generated/services/company-service';
import { BusinessGroupService } from '@/generated/services/business-group-service';
import type { Company } from '@/generated/models/company-model';
import type { BusinessGroup } from '@/generated/models/business-group-model';

/**
 * Dataverse alternate key violation. Returned as HTTP 412 with this OData code
 * when a create would duplicate an active alternate key.
 *
 * Two keys are active on this solution:
 *   cws_company        -> cws_companyname
 *   cws_businessgroup  -> cws_businessgroupname + cws_company
 *
 * Both are case-insensitive and ignore trailing whitespace, so "Contoso",
 * "contoso" and "Contoso " all collide.
 */
const DUPLICATE_KEY_CODE = '0x80060892';

/**
 * The SDK rethrows failures as `new Error(serializeClientError(err), { cause: err })`,
 * where the serialized message already contains the OData code and HTTP status.
 * Check the message first, then walk `cause` for the structured error in case a
 * future SDK version stops flattening it into the string.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'string') return error.includes(DUPLICATE_KEY_CODE);

  const candidate = error as {
    message?: unknown;
    code?: unknown;
    cause?: unknown;
    status?: unknown;
    response?: { status?: unknown; data?: { error?: { code?: unknown } } };
  };

  if (typeof candidate.message === 'string' && candidate.message.includes(DUPLICATE_KEY_CODE)) return true;
  if (candidate.code === DUPLICATE_KEY_CODE) return true;
  if (candidate.response?.data?.error?.code === DUPLICATE_KEY_CODE) return true;
  if (candidate.cause && candidate.cause !== error) return isDuplicateKeyError(candidate.cause);

  return false;
}

/** Matches the Dataverse key comparison: case-insensitive, whitespace-insensitive. */
const sameName = (a: string | undefined, b: string | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Create a record, and if the alternate key rejects it as a duplicate, adopt the
 * record that already exists instead of failing.
 *
 * This is the stale-cache path: the caller already checked its local list and
 * found nothing, but another client (model-driven app, canvas app, Copilot Studio
 * agent, or a flow) created the record since the last fetch. The user's intent is
 * satisfiable — the record exists, the cache just did not know about it yet.
 */
async function createOrAdopt<T>(
  create: () => Promise<T>,
  findOnServer: () => Promise<T | undefined>,
  onAdopted: () => void,
): Promise<{ record: T; adopted: boolean }> {
  try {
    return { record: await create(), adopted: false };
  } catch (error: unknown) {
    if (!isDuplicateKeyError(error)) throw error;

    const existing = await findOnServer();
    // A duplicate-key rejection means the record is there. If the refetch cannot
    // see it, something else is wrong (permissions, a race with a delete) and the
    // original error is the more useful one to surface.
    if (!existing) throw error;

    onAdopted();
    return { record: existing, adopted: true };
  }
}

export async function createCompanyOrAdopt(
  create: () => Promise<Company>,
  companyName: string,
  queryClient: QueryClient,
): Promise<{ record: Company; adopted: boolean }> {
  return createOrAdopt(
    create,
    async () => (await CompanyService.getAll()).find((company: Company) => sameName(company.companyName, companyName)),
    () => { queryClient.invalidateQueries({ queryKey: ['company-list'] }); },
  );
}

export async function createBusinessGroupOrAdopt(
  create: () => Promise<BusinessGroup>,
  businessGroupName: string,
  companyId: string,
  queryClient: QueryClient,
): Promise<{ record: BusinessGroup; adopted: boolean }> {
  return createOrAdopt(
    create,
    async () => (await BusinessGroupService.getAll()).find(
      (group: BusinessGroup) => sameName(group.businessGroupName, businessGroupName) && group.company?.id === companyId,
    ),
    () => { queryClient.invalidateQueries({ queryKey: ['businessGroup-list'] }); },
  );
}
