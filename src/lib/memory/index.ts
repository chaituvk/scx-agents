// MemoryService — unified facade over the 4-layer memory hierarchy.

import { ephemeralStore, EphemeralStore } from "./ephemeral";
import { loadProfile } from "./profile";
import { loadHistory } from "./history";
import { loadKnowledge } from "./knowledge";
import type { MemoryQuery, MemoryContext, MemoryLayer } from "../agents/types";

const ALL_LAYERS: MemoryLayer[] = ["ephemeral", "profile", "history", "knowledge"];

export class MemoryService {
  readonly ephemeral: EphemeralStore = ephemeralStore;

  async load(query: MemoryQuery): Promise<MemoryContext> {
    const layers = query.layers ?? ALL_LAYERS;
    const want = (l: MemoryLayer) => layers.includes(l);

    const ephemeralP = want("ephemeral")
      ? this.ephemeral.get(query.tenantId, query.conversationId)
      : Promise.resolve({} as Record<string, unknown>);

    const profileP = want("profile")
      ? loadProfile(query.conversationId, query.customerId)
      : Promise.resolve(undefined);

    const historyP = want("history")
      ? loadHistory(query.conversationId)
      : Promise.resolve([]);

    const [ephemeral, profile, history] = await Promise.all([
      ephemeralP,
      profileP,
      historyP,
    ]);

    let knowledge: MemoryContext["knowledge"] = [];
    if (want("knowledge")) {
      const topicQuery = query.topics && query.topics.length > 0
        ? query.topics.join(" ")
        : history.length > 0
          ? history[history.length - 1].content
          : "";
      if (topicQuery) {
        knowledge = await loadKnowledge(topicQuery, query.tenantId);
      }
    }

    return { ephemeral, profile, history, knowledge };
  }
}

export const memoryService = new MemoryService();
