import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config";
import { logger } from "../../lib/logger";

/** Structured output from the AI ticket analysis */
export interface TicketAnalysis {
  cleanTicket: string;
  summary: string;
  category: string;
  priority: string;
  possibleRootCause: string;
  suggestedSolutions: string[];
  keywords: string[];
}

const SYSTEM_PROMPT = `You are an AI assistant integrated into an ICT Support Ticketing System.
Your task is to analyze support tickets submitted by users in a university or office environment and produce structured outputs that help ICT staff respond efficiently.

You must perform the following tasks:

1. CLEAN AND REWRITE THE TICKET
Rewrite the ticket into a clear and professional problem description while keeping the original meaning.

2. SUMMARIZE THE ISSUE
Provide a short 1–2 sentence summary of the problem.

3. CLASSIFY THE CATEGORY
Classify the ticket into ONE of these categories:
- Network
- Hardware
- Software
- Account Access
- Printer
- Security
- Other

4. DETERMINE PRIORITY LEVEL
Assign a priority level:
- LOW
- MEDIUM
- HIGH
- CRITICAL

Use the following logic:
CRITICAL = affects many users, servers, or core systems
HIGH = prevents a user from working
MEDIUM = issue but work can continue
LOW = minor inconvenience

5. SUGGEST POSSIBLE SOLUTIONS
Provide 3–5 troubleshooting steps an ICT technician could try.

6. DETECT POSSIBLE ROOT CAUSE
Give a short explanation of the likely technical cause.

7. GENERATE HELPFUL KEYWORDS
Generate 5 keywords that can help search for similar issues later.

Return the result ONLY in JSON format using this structure:
{
  "clean_ticket": "",
  "summary": "",
  "category": "",
  "priority": "",
  "possible_root_cause": "",
  "suggested_solutions": ["", "", ""],
  "keywords": ["", "", ""]
}

Important rules:
- Do not invent information not present in the ticket.
- Focus on common ICT troubleshooting knowledge.
- Be concise and technical.
- Output valid JSON only.`;

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  private getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      if (!config.gemini.apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
      }
      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    }
    return this.genAI;
  }

  /** Check if Gemini is configured and available */
  isAvailable(): boolean {
    return Boolean(config.gemini.apiKey);
  }

  /**
   * Analyze a ticket description using Gemini AI.
   * Returns structured analysis with category, priority, solutions, etc.
   */
  async analyzeTicket(
    title: string,
    description: string,
    additionalContext?: string,
  ): Promise<TicketAnalysis> {
    const client = this.getClient();
    const model = client.getGenerativeModel({ model: config.gemini.model });

    const ticketContent = [
      title && `Title: ${title}`,
      `Description: ${description}`,
      additionalContext && `Additional Context: ${additionalContext}`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        {
          role: "model",
          parts: [
            {
              text: "Understood. Send me the support ticket and I will analyze it and return the result in JSON format.",
            },
          ],
        },
        { role: "user", parts: [{ text: ticketContent }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    logger.info("[GeminiService] Raw AI response received");

    try {
      const parsed = JSON.parse(text);
      return {
        cleanTicket: parsed.clean_ticket || "",
        summary: parsed.summary || "",
        category: parsed.category || "Other",
        priority: this.normalizePriority(parsed.priority),
        possibleRootCause: parsed.possible_root_cause || "",
        suggestedSolutions: Array.isArray(parsed.suggested_solutions)
          ? parsed.suggested_solutions
          : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      };
    } catch (parseError) {
      logger.error("[GeminiService] Failed to parse AI response:", text);
      throw new Error("Failed to parse AI analysis response");
    }
  }

  /**
   * Search for similar tickets based on a description.
   * Returns keywords for database search.
   */
  async extractSearchKeywords(description: string): Promise<string[]> {
    const client = this.getClient();
    const model = client.getGenerativeModel({ model: config.gemini.model });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract 5-8 specific technical search keywords from this ICT support ticket description. Return ONLY a JSON array of strings, nothing else.

Description: ${description}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      logger.error("[GeminiService] Failed to parse keywords response:", text);
      return [];
    }
  }

  private normalizePriority(raw: string): string {
    const upper = (raw || "").toUpperCase().trim();
    if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(upper)) return upper;
    return "MEDIUM";
  }
}

/** Singleton instance */
export const geminiService = new GeminiService();
