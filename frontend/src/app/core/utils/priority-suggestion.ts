/**
 * Smart Priority Suggestion Engine
 *
 * Analyzes ticket title, description, and selected options to suggest
 * an appropriate priority level. Uses keyword matching with weighted
 * scoring to determine urgency.
 *
 * This is the first "intelligence" feature in the platform, providing
 * rule-based NLP for priority classification. A future ML model (Chunk B3)
 * can replace or supplement this logic.
 *
 * Scoring thresholds:
 *   - CRITICAL ≥ 8   (system down, data loss, security breach)
 *   - HIGH     ≥ 4   (broken functionality, urgent requests, deadlines)
 *   - MEDIUM   ≥ 1   (enhancements, moderate issues)
 *   - LOW      = 0   (informational, training, routine)
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface KeywordRule {
  /** Keywords/phrases to match (case-insensitive) */
  patterns: RegExp[];
  /** Score weight — higher = more urgent */
  weight: number;
  /** Human-readable reason for the suggestion */
  reason: string;
}

/** Result of the priority suggestion analysis */
export interface PrioritySuggestion {
  /** Suggested priority level */
  priority: Priority;
  /** Overall urgency score */
  score: number;
  /** Human-readable reasons why this priority was suggested */
  reasons: string[];
  /** Confidence: 'high' if multiple indicators match, 'medium' if few, 'low' if default */
  confidence: 'high' | 'medium' | 'low';
}

// ─── Keyword Rules ─────────────────────────────────────────

const CRITICAL_RULES: KeywordRule[] = [
  {
    patterns: [
      /\bdown\b/,
      /\bcrash(ed|ing|es)?\b/,
      /\boffline\b/,
      /\bnot (working|responding|accessible)\b/,
    ],
    weight: 5,
    reason: 'System/service appears to be down or unresponsive',
  },
  {
    patterns: [/\bdata\s*loss\b/, /\blost\s*(data|files|records)\b/, /\bcorrupt(ed|ion)?\b/],
    weight: 5,
    reason: 'Potential data loss or corruption detected',
  },
  {
    patterns: [
      /\bsecurity\b.*\b(breach|issue|vulnerability|hack)\b/,
      /\bhack(ed|ing)?\b/,
      /\bmalware\b/,
      /\bransomware\b/,
      /\bphishing\b/,
    ],
    weight: 6,
    reason: 'Security incident or vulnerability',
  },
  {
    patterns: [
      /\b(entire|whole|all)\s*(office|department|campus|building|university)\b.*\b(affected|impacted|down)\b/,
    ],
    weight: 4,
    reason: 'Wide-scale impact affecting multiple users/departments',
  },
  {
    patterns: [/\bno\s*(internet|network|connection|access)\b.*\b(entire|whole|all|everyone)\b/],
    weight: 5,
    reason: 'Complete network outage',
  },
];

const HIGH_RULES: KeywordRule[] = [
  {
    patterns: [/\burgent(ly)?\b/, /\basap\b/, /\bimmediately\b/, /\bcritical\b/, /\bemergency\b/],
    weight: 3,
    reason: 'Urgent language used in description',
  },
  {
    patterns: [/\bdeadline\b/, /\bdue\s*(date|today|tomorrow|soon)\b/, /\btime[- ]sensitive\b/],
    weight: 3,
    reason: 'Time-sensitive request with deadline',
  },
  {
    patterns: [
      /\bcannot\s*(access|login|log in|use|open|connect)\b/,
      /\bunable\s*to\b/,
      /\bblocked\b/,
      /\blocked\s*out\b/,
    ],
    weight: 2,
    reason: 'User is blocked from accessing a service',
  },
  {
    patterns: [/\berror\b/, /\bbug\b/, /\bfail(ed|ing|ure|s)?\b/, /\bbroken\b/],
    weight: 2,
    reason: 'Error or failure reported',
  },
  {
    patterns: [/\bvirus\b/, /\binfect(ed|ion)?\b/],
    weight: 3,
    reason: 'Virus or infection detected',
  },
  {
    patterns: [/\bno\s*power\b/, /\bwon'?t\s*(turn on|start|boot)\b/, /\bdead\b/],
    weight: 2,
    reason: 'Hardware not powering on',
  },
  {
    patterns: [/\bno\s*(internet|connection|wifi|network)\b/],
    weight: 2,
    reason: 'No internet/network connectivity',
  },
  {
    patterns: [/\bpaper\s*jam\b/],
    weight: 1,
    reason: 'Printer paper jam',
  },
  {
    patterns: [/\bmultiple\s*(users?|people|staff|employees)\b.*\b(affected|impacted|complain)\b/],
    weight: 2,
    reason: 'Multiple users affected',
  },
];

const LOW_RULES: KeywordRule[] = [
  {
    patterns: [/\btraining\b/, /\btutorial\b/, /\blearn(ing)?\b/, /\bhow\s*to\b/],
    weight: -2,
    reason: 'Training or learning request (non-urgent)',
  },
  {
    patterns: [
      /\bwhen\s*(you|available|free|possible)\b/,
      /\bno\s*rush\b/,
      /\blow\s*priority\b/,
      /\bwhenever\b/,
    ],
    weight: -2,
    reason: 'Non-urgent language used',
  },
  {
    patterns: [/\bbackup\b.*\b(routine|scheduled|regular)\b/],
    weight: -1,
    reason: 'Routine backup request',
  },
  {
    patterns: [/\bsuggestion\b/, /\bproposal\b/, /\bfuture\b/, /\beventually\b/],
    weight: -1,
    reason: 'Suggestion or future request',
  },
];

// ─── Category-Based Rules ──────────────────────────────────

/** Certain form checkbox selections inherently suggest higher/lower priority */
const CATEGORY_WEIGHTS: Record<string, number> = {
  // MIS - Software
  fixError: 2, // Fixing bugs = higher priority
  enhancement: 0, // Enhancements = medium
  newIS: 0, // New IS project = medium
  userTraining: -1, // Training = lower priority
  backupDatabase: 1, // Backup = slightly above medium
  installExisting: 0, // Installation = medium
  isImplementationSupport: 0,

  // MIS - Website
  addRemoveContent: 0,
  addRemoveFeatures: 0,
  addRemovePage: 0,

  // ITS - Maintenance
  desktopLaptop: 1,
  internetNetwork: 2, // Network issues tend to be higher priority
  printer: 0,

  // ITS - Borrow
  borrowRequest: -1, // Borrow requests are generally routine
};

// ─── Main Analysis Function ────────────────────────────────

/**
 * Analyze ticket content and suggest a priority level.
 *
 * @param title     - The ticket title (auto-generated or custom)
 * @param description - Full description including additional notes
 * @param selectedOptions - Array of selected checkbox option keys (e.g., ['fixError', 'internetNetwork'])
 * @returns PrioritySuggestion with priority, score, reasons, and confidence
 */
export function suggestPriority(
  title: string,
  description: string,
  selectedOptions: string[] = [],
): PrioritySuggestion {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // 1. Check CRITICAL rules
  for (const rule of CRITICAL_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }

  // 2. Check HIGH rules
  for (const rule of HIGH_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }

  // 3. Check LOW rules (negative weights reduce score)
  for (const rule of LOW_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }

  // 4. Factor in selected category options
  for (const opt of selectedOptions) {
    const weight = CATEGORY_WEIGHTS[opt];
    if (weight !== undefined && weight !== 0) {
      score += weight;
    }
  }

  // 5. Determine priority from score
  let priority: Priority;
  if (score >= 8) {
    priority = 'CRITICAL';
  } else if (score >= 4) {
    priority = 'HIGH';
  } else if (score >= 1) {
    priority = 'MEDIUM';
  } else {
    priority = 'LOW';
  }

  // 6. Determine confidence
  let confidence: PrioritySuggestion['confidence'];
  if (reasons.length >= 3) {
    confidence = 'high';
  } else if (reasons.length >= 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // If no keyword matches at all, default to MEDIUM with low confidence
  if (reasons.length === 0) {
    priority = 'MEDIUM';
    confidence = 'low';
    reasons.push('No specific urgency indicators detected — defaulting to Medium');
  }

  return { priority, score, reasons, confidence };
}
