// Detects the user's language from message content using lightweight heuristics
// (script detection) + optional LLM classification for ambiguous cases.
// Returns BCP-47 language codes like "en", "ja", "fr", "es", "ar", "zh", etc.

export type SupportedLanguage = "en" | "ja" | "zh" | "ko" | "fr" | "es" | "de" | "ar" | "pt" | "hi" | "unknown";

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
  script: "latin" | "cjk" | "arabic" | "devanagari" | "unknown";
}

// Unicode character ranges for script detection
const HIRAGANA = /[ぁ-ゟ]/;
const KATAKANA = /[゠-ヿ]/;
const CJK_UNIFIED = /[一-鿿]/;
const HANGUL = /[가-힯]/;
const ARABIC_SCRIPT = /[؀-ۿ]/;
const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN = /[a-zA-Z]/;

function countMatches(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, "g")) ?? []).length;
}

// Lightweight Latin language keyword detection (common function words)
const LATIN_LANGUAGE_MARKERS: Array<{ language: SupportedLanguage; words: string[] }> = [
  {
    language: "fr",
    words: ["je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "est", "sont", "avec", "pour", "dans", "sur", "une", "les", "des", "du", "au", "aux", "pas", "ne", "que", "qui", "bonjour", "merci", "oui", "non", "votre", "notre", "mon", "ma", "mes"],
  },
  {
    language: "es",
    words: ["yo", "tu", "el", "ella", "nosotros", "ellos", "ellas", "es", "son", "con", "para", "en", "sobre", "una", "los", "las", "del", "al", "no", "que", "quien", "hola", "gracias", "si", "su", "mi", "me", "te", "se", "por", "muy", "pero"],
  },
  {
    language: "de",
    words: ["ich", "du", "er", "sie", "wir", "ihr", "ist", "sind", "mit", "für", "in", "auf", "ein", "eine", "die", "der", "das", "den", "dem", "des", "nicht", "dass", "bitte", "danke", "ja", "nein", "mein", "dein", "sein", "ihr", "auch", "noch", "aber"],
  },
  {
    language: "pt",
    words: ["eu", "tu", "ele", "ela", "nos", "eles", "elas", "com", "para", "em", "sobre", "uma", "os", "as", "não", "que", "quem", "ola", "obrigado", "obrigada", "sim", "meu", "minha", "me", "te", "se", "por", "muito", "mas", "como", "também"],
  },
];

function detectLatinLanguage(text: string): { language: SupportedLanguage; confidence: number } {
  const lower = text.toLowerCase();
  const words = lower.match(/\b\w+\b/g) ?? [];
  if (words.length === 0) return { language: "en", confidence: 0.4 };

  const scores: Map<SupportedLanguage, number> = new Map();

  for (const { language, words: markers } of LATIN_LANGUAGE_MARKERS) {
    const markerSet = new Set(markers);
    const hits = words.filter((w) => markerSet.has(w)).length;
    if (hits > 0) {
      scores.set(language, hits / words.length);
    }
  }

  if (scores.size === 0) {
    return { language: "en", confidence: 0.5 };
  }

  let bestLang: SupportedLanguage = "en";
  let bestScore = 0;
  for (const [lang, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  // Minimum score threshold to declare non-English
  if (bestScore < 0.05) {
    return { language: "en", confidence: 0.5 };
  }

  return { language: bestLang, confidence: Math.min(0.5 + bestScore * 5, 0.95) };
}

export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return { language: "unknown", confidence: 0, script: "unknown" };
  }

  const totalChars = text.replace(/\s/g, "").length;
  if (totalChars === 0) {
    return { language: "unknown", confidence: 0, script: "unknown" };
  }

  // Count script characters
  const hiraganaCount = countMatches(text, HIRAGANA);
  const katakanaCount = countMatches(text, KATAKANA);
  const cjkCount = countMatches(text, CJK_UNIFIED);
  const hangulCount = countMatches(text, HANGUL);
  const arabicCount = countMatches(text, ARABIC_SCRIPT);
  const devanagariCount = countMatches(text, DEVANAGARI);
  const latinCount = countMatches(text, LATIN);

  const japaneseKana = hiraganaCount + katakanaCount;

  // Script ratios relative to total non-whitespace chars
  const hangulRatio = hangulCount / totalChars;
  const arabicRatio = arabicCount / totalChars;
  const devanagariRatio = devanagariCount / totalChars;
  const cjkRatio = cjkCount / totalChars;
  const japaneseKanaRatio = japaneseKana / totalChars;
  const latinRatio = latinCount / totalChars;

  // Korean (Hangul)
  if (hangulRatio > 0.1) {
    return {
      language: "ko",
      confidence: Math.min(0.7 + hangulRatio * 0.3, 0.99),
      script: "cjk",
    };
  }

  // Arabic
  if (arabicRatio > 0.1) {
    return {
      language: "ar",
      confidence: Math.min(0.7 + arabicRatio * 0.3, 0.99),
      script: "arabic",
    };
  }

  // Devanagari → Hindi
  if (devanagariRatio > 0.1) {
    return {
      language: "hi",
      confidence: Math.min(0.7 + devanagariRatio * 0.3, 0.99),
      script: "devanagari",
    };
  }

  // Japanese (hiragana/katakana are unambiguous)
  if (japaneseKanaRatio > 0.05) {
    return {
      language: "ja",
      confidence: Math.min(0.75 + japaneseKanaRatio * 0.25, 0.99),
      script: "cjk",
    };
  }

  // CJK without kana — likely Chinese, but could be Japanese kanji-only text.
  // Use kana presence as tiebreaker; without kana we lean Chinese.
  if (cjkRatio > 0.1) {
    if (japaneseKana > 0) {
      return { language: "ja", confidence: 0.75, script: "cjk" };
    }
    return { language: "zh", confidence: Math.min(0.65 + cjkRatio * 0.3, 0.95), script: "cjk" };
  }

  // Latin-script text — do keyword matching
  if (latinRatio > 0.3) {
    const { language, confidence } = detectLatinLanguage(text);
    return { language, confidence, script: "latin" };
  }

  // Mixed or short text — not enough signal
  return { language: "unknown", confidence: 0.2, script: "unknown" };
}

// Language names for human-readable prompts
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  ja: "Japanese",
  zh: "Chinese (Mandarin)",
  ko: "Korean",
  fr: "French",
  es: "Spanish",
  de: "German",
  ar: "Arabic",
  pt: "Portuguese",
  hi: "Hindi",
  unknown: "Unknown",
};

export function getSystemLanguageInstruction(language: SupportedLanguage): string {
  if (language === "en" || language === "unknown") {
    return "";
  }
  const name = LANGUAGE_NAMES[language];
  return `IMPORTANT: The customer is communicating in ${name} (${language}). You MUST respond in ${name}. Do not switch to English unless the customer explicitly requests it.`;
}
