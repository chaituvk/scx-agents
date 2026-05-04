// L2 profile memory — customer profile lookup with LRU cache.

import { LRUCache } from "lru-cache";
import { conversationRepo } from "../repositories";
import type { MemoryContext } from "../agents/types";

type Profile = NonNullable<MemoryContext["profile"]>;

const profileCache = new LRUCache<string, Profile>({
  max: 500,
  ttl: 1000 * 300,
});

export async function loadProfile(
  conversationId: string,
  customerId?: string,
): Promise<Profile | undefined> {
  const cacheKey = customerId ? `cust:${customerId}` : `conv:${conversationId}`;
  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  const conv = await conversationRepo.findById(conversationId);
  if (!conv) return undefined;

  const profile: Profile = {
    id: customerId ?? conv.id,
    name: conv.customer_name,
    email: conv.customer_email,
  };
  profileCache.set(cacheKey, profile);
  return profile;
}
