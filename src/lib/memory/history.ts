// L3 history memory — recent conversation messages.

import { messageRepo } from "../repositories";
import type { Message } from "../repositories/message";

export async function loadHistory(
  conversationId: string,
  limit: number = 10,
): Promise<Message[]> {
  const all = await messageRepo.findByConversation(conversationId);
  if (all.length <= limit) return all;
  return all.slice(all.length - limit);
}
