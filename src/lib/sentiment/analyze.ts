// Rule-based sentiment analysis for real-time conversation sentiment tracking.
// Used to update conversation.sentiment after each turn without burning LLM
// tokens on a separate sentiment call.

export type Sentiment = "positive" | "neutral" | "negative";

interface SentimentResult {
  sentiment: Sentiment;
  score: number; // -1.0 to +1.0
  signals: string[];
}

const POSITIVE_PATTERNS = [
  /\b(thank(s| you)|great|perfect|awesome|excellent|helpful|amazing|love|appreciate|wonderful|fantastic|brilliant|happy|pleased|satisfied|good job|well done|nice|superb)\b/i,
  /😊|😁|👍|🙏|❤️|💯|✅/,
  /\b(resolved|fixed|sorted|works?|working|solved)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(terrible|horrible|awful|disgusting|hate|useless|worst|broken|not working|doesn't work|never works|frustrated|angry|annoyed|disappointed|unacceptable|ridiculous|waste|scam|fraud)\b/i,
  /😠|😡|🤬|👎|😤|😢|😭/,
  /\b(cancel|refund|complaint|escalat[ei]|speak to (a )?manager|supervisor|this is (a )?joke|absurd)\b/i,
  /\b(still (not|broken|wrong)|again|for the (third|fourth|fifth|\d+)(th)? time|hours? (later|waiting))\b/i,
];

const INTENSIFIERS = /\b(very|really|extremely|absolutely|completely|totally|utterly)\b/i;

export function analyzeSentiment(text: string): SentimentResult {
  const signals: string[] = [];
  let score = 0;

  for (const pat of POSITIVE_PATTERNS) {
    if (pat.test(text)) {
      signals.push(`+: ${pat.source.slice(0, 30)}`);
      score += 0.4;
    }
  }
  for (const pat of NEGATIVE_PATTERNS) {
    if (pat.test(text)) {
      signals.push(`-: ${pat.source.slice(0, 30)}`);
      score -= 0.4;
    }
  }
  if (INTENSIFIERS.test(text)) {
    score *= 1.25;
  }
  // Normalise
  score = Math.max(-1, Math.min(1, score));

  const sentiment: Sentiment =
    score >= 0.25 ? "positive" : score <= -0.25 ? "negative" : "neutral";

  return { sentiment, score, signals };
}

// Blend new sentiment with the existing one — one negative message shouldn't
// flip a whole positive session, but a trend of negative messages should.
export function blendSentiment(current: Sentiment, incoming: Sentiment): Sentiment {
  if (current === incoming) return current;
  if (incoming === "negative") return "negative";
  if (current === "negative" && incoming === "positive") return "neutral";
  if (current === "neutral" && incoming === "positive") return "positive";
  return current;
}
