import { callModel } from '../model-router';

export type SentimentScore = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
  score: SentimentScore;
  confidence: number;
  signals: string[];
}

// Fast heuristic-based sentiment check
function heuristicSentiment(text: string): SentimentResult | null {
  const lower = text.toLowerCase();
  const positiveWords = ['thank', 'great', 'excellent', 'perfect', 'awesome', 'helpful', 'resolved', 'appreciate', 'love', 'fantastic', 'happy', 'good'];
  const negativeWords = ['terrible', 'awful', 'worst', 'useless', 'waste', 'horrible', 'angry', 'frustrated', 'ridiculous', 'unacceptable', 'disappointed', 'hate'];

  const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

  if (negativeCount >= 2) return { score: 'negative', confidence: 0.9, signals: negativeWords.filter(w => lower.includes(w)) };
  if (positiveCount >= 2) return { score: 'positive', confidence: 0.85, signals: positiveWords.filter(w => lower.includes(w)) };
  if (negativeCount === 1 && positiveCount === 0) return { score: 'negative', confidence: 0.7, signals: negativeWords.filter(w => lower.includes(w)) };
  if (positiveCount === 1 && negativeCount === 0) return { score: 'positive', confidence: 0.7, signals: positiveWords.filter(w => lower.includes(w)) };

  return null; // Use LLM
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  // Try heuristic first (no LLM cost)
  const heuristic = heuristicSentiment(text);
  if (heuristic && heuristic.confidence >= 0.85) return heuristic;

  // Fall back to LLM
  try {
    const res = await callModel(
      [
        { role: 'system', content: 'Classify customer message sentiment. Return JSON: {"score":"positive"|"neutral"|"negative","confidence":0.0-1.0,"signals":["word1","word2"]}. Be concise.' },
        { role: 'user', content: text.slice(0, 500) }, // limit to 500 chars
      ],
      { tier: 'small', jsonMode: true, maxTokens: 100 }
    );
    const parsed = JSON.parse(res.content ?? '{}');
    return {
      score: parsed.score ?? 'neutral',
      confidence: parsed.confidence ?? 0.5,
      signals: parsed.signals ?? [],
    };
  } catch {
    return heuristic ?? { score: 'neutral', confidence: 0.5, signals: [] };
  }
}
