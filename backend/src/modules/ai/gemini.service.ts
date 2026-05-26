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

/** Structured output from the AI natural language ticket parsing */
export interface ParsedTicketResult {
  department: "MIS" | "ITS";
  title: string;
  category?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
  mrn?: string | null;
  maintenanceDesktopLaptop?: boolean | null;
  maintenanceInternetNetwork?: boolean | null;
  maintenancePrinter?: boolean | null;
  maintenanceDetails?: string | null;
  borrowRequest?: boolean | null;
  borrowDetails?: string | null;
  websiteNewRequest?: boolean | null;
  websiteUpdate?: boolean | null;
  softwareNewRequest?: boolean | null;
  softwareUpdate?: boolean | null;
  softwareInstall?: boolean | null;
}

const NLP_SYSTEM_PROMPT = `You are an AI assistant integrated into an ICT Support Ticketing System.
Your task is to analyze a natural language support request and extract structured output to fully pre-populate a support ticket form.

Analyze the user's input and classify it accurately:

1. DEPARTMENT SELECTION:
- Classify as ITS (Information Technology Services) if the issue involves hardware repair, maintenance of computers, printers, network connection, Wifi, physical cables, borrowing projectors/laptops or other equipment.
- Classify as MIS (Management Information System) if the issue involves portal accounts, university website edits, databases, local custom software bugs, request for custom web portals, or administrative software.

2. CATEGORY:
Generate a simplified category representing the request (e.g. Website, Software, Database, Hardware, Network, Printer, Account, Borrow Request, Wifi, Security, etc.)

3. DETAILS & CLEANING:
Write a clean, descriptive "details" field that rewrites the original issue description into a neat, technical, professional description.

4. SPECIFIC FIELDS:
- mrn: If the user mentions any Material Receipt Number, asset tag, or receipt code like "MRN-12345" or "MRN-3312", extract it exactly.
- Desktop/Laptop repair/checkup (for ITS Form): Set maintenanceDesktopLaptop to true if it involves computer, laptop, or desktop issue.
- Internet/Network (for ITS Form): Set maintenanceInternetNetwork to true if it involves bad wifi, no internet, ethernet offline.
- Printer checkup (for ITS Form): Set maintenancePrinter to true if it involves printer jam, toner repair, printer setup.
- Borrow Request (for ITS Form): Set borrowRequest to true if they are borrowing equipment (like projectors, speakers, etc.). Put details in borrowDetails (e.g. "Purpose: Lecture\\nDuration: 2 hours\\nVenue: Room 101\\nBorrowed Items: Projector").
- Website New Request (for MIS Form): Set websiteNewRequest to true if it is a request for a new website.
- Website Update (for MIS Form): Set websiteUpdate to true if they want to update/make content changes on an existing website/page.
- Software New Request (for MIS Form): Set softwareNewRequest to true if they ask to develop a new web application or custom local software system.
- Software Update (for MIS Form): Set softwareUpdate to true if they are reporting bugs or asking for updates/adjustments to existing custom software.
- Software Install (for MIS Form): Set softwareInstall to true if they are asking to install utility software, database software, or drivers on their system.

5. PRIORITY CLASSIFICATION:
Assign Priority: LOW, MEDIUM, HIGH, or CRITICAL based on:
- CRITICAL = Server offline, multiple offices blocked, severe security breach.
- HIGH = Single staff cannot do vital workflow (e.g., computer cannot boot, primary school printer offline).
- MEDIUM = Issue is present but work can continue.
- LOW = Suggestion, informational request, or minor aesthetic edit.

Return the result ONLY in JSON format utilizing this exact structure:
{
  "department": "MIS" or "ITS",
  "title": "Clean 3-7 words title for the ticket",
  "category": "Clean brief category",
  "priority": "LOW", "MEDIUM", "HIGH" or "CRITICAL",
  "details": "Professional cleaned up description",
  "mrn": "extracted MRN or null",
  "maintenanceDesktopLaptop": true/false,
  "maintenanceInternetNetwork": true/false,
  "maintenancePrinter": true/false,
  "maintenanceDetails": "Specific details for repair or null",
  "borrowRequest": true/false,
  "borrowDetails": {
    "purpose": "..." or null,
    "duration": "..." or null,
    "venueRoom": "..." or null,
    "borrowedItems": "..." or null
  },
  "websiteNewRequest": true/false,
  "websiteUpdate": true/false,
  "softwareNewRequest": true/false,
  "softwareUpdate": true/false,
  "softwareInstall": true/false
}`;

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
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    logger.info("[GeminiService] Raw AI response received");

    try {
      const parsed = JSON.parse(text);
      return this.mapAnalysis(parsed);
    } catch (parseError) {
      // Attempt to recover from truncated JSON by closing open brackets
      logger.warn(
        "[GeminiService] Initial JSON parse failed, attempting recovery...",
      );
      try {
        const repaired = this.repairTruncatedJson(text);
        const parsed = JSON.parse(repaired);
        logger.info("[GeminiService] Successfully recovered truncated JSON");
        return this.mapAnalysis(parsed);
      } catch {
        logger.error("[GeminiService] Failed to parse AI response:", text);
        throw new Error("Failed to parse AI analysis response");
      }
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

  /**
   * Parse a natural language ticket input into structured fields.
   */
  async parseNLPInput(input: string): Promise<ParsedTicketResult> {
    if (!this.isAvailable()) {
      logger.warn(
        "[GeminiService] Gemini is not configured. Falling back to default parser.",
      );
      return this.fallbackNLPParse(input);
    }

    try {
      const client = this.getClient();
      const model = client.getGenerativeModel({ model: config.gemini.model });

      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: NLP_SYSTEM_PROMPT }] },
          {
            role: "model",
            parts: [
              {
                text: "Understood. Send me the natural language query, and I will parse it and return the result in the specified JSON format.",
              },
            ],
          },
          { role: "user", parts: [{ text: `Input content: ${input}` }] },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      });

      const text = result.response.text();
      logger.info("[GeminiService] Raw NLP parse response received");

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        const repaired = this.repairTruncatedJson(text);
        parsed = JSON.parse(repaired);
      }

      let borrowDetailsStr = "";
      if (parsed.borrowDetails && typeof parsed.borrowDetails === "object") {
        const parts = [];
        if (parsed.borrowDetails.purpose)
          parts.push(`Purpose: ${parsed.borrowDetails.purpose}`);
        if (parsed.borrowDetails.duration)
          parts.push(`Duration: ${parsed.borrowDetails.duration}`);
        if (parsed.borrowDetails.venueRoom)
          parts.push(`Venue/Room: ${parsed.borrowDetails.venueRoom}`);
        if (parsed.borrowDetails.borrowedItems)
          parts.push(`Borrowed Items: ${parsed.borrowDetails.borrowedItems}`);
        borrowDetailsStr = parts.join("\n");
      } else if (typeof parsed.borrowDetails === "string") {
        borrowDetailsStr = parsed.borrowDetails;
      }

      return {
        department: parsed.department === "MIS" ? "MIS" : "ITS",
        title: parsed.title || this.deriveFallbackTitle(input),
        category: parsed.category || "Other",
        priority: this.normalizePriority(parsed.priority) as any,
        details: parsed.details || input,
        mrn: parsed.mrn || null,
        maintenanceDesktopLaptop: parsed.maintenanceDesktopLaptop || false,
        maintenanceInternetNetwork: parsed.maintenanceInternetNetwork || false,
        maintenancePrinter: parsed.maintenancePrinter || false,
        maintenanceDetails: parsed.maintenanceDetails || null,
        borrowRequest: parsed.borrowRequest || false,
        borrowDetails: borrowDetailsStr || null,
        websiteNewRequest: parsed.websiteNewRequest || false,
        websiteUpdate: parsed.websiteUpdate || false,
        softwareNewRequest: parsed.softwareNewRequest || false,
        softwareUpdate: parsed.softwareUpdate || false,
        softwareInstall: parsed.softwareInstall || false,
      };
    } catch (err: any) {
      logger.error(
        "[GeminiService] Failed to parse NLP input with Gemini:",
        err.message,
      );
      return this.fallbackNLPParse(input);
    }
  }

  private fallbackNLPParse(input: string): ParsedTicketResult {
    const lowerInput = input.toLowerCase();

    // Guess department
    let department: "MIS" | "ITS" = "ITS";
    if (
      lowerInput.includes("portal") ||
      lowerInput.includes("website") ||
      lowerInput.includes("software") ||
      lowerInput.includes("database") ||
      lowerInput.includes("mis") ||
      lowerInput.includes("grade") ||
      lowerInput.includes("enroll")
    ) {
      department = "MIS";
    }

    // Guess priority
    let priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
    if (
      lowerInput.includes("urgent") ||
      lowerInput.includes("critical") ||
      lowerInput.includes("broken") ||
      lowerInput.includes("down") ||
      lowerInput.includes("not working")
    ) {
      priority = "HIGH";
    }

    // Simple fields guesser
    const hasPrinter =
      lowerInput.includes("printer") ||
      lowerInput.includes("paper jam") ||
      lowerInput.includes("toner");
    const hasInternet =
      lowerInput.includes("wifi") ||
      lowerInput.includes("internet") ||
      lowerInput.includes("network") ||
      lowerInput.includes("ethernet");
    const hasComputer =
      lowerInput.includes("computer") ||
      lowerInput.includes("pc") ||
      lowerInput.includes("laptop") ||
      lowerInput.includes("desktop") ||
      lowerInput.includes("power");

    // Guess MRN if any
    const mrnMatch = input.match(/mrn-?\s*([0-9a-zA-Z]+)/i);
    const mrn = mrnMatch ? `MRN-${mrnMatch[1].toUpperCase()}` : null;

    return {
      department,
      title: this.deriveFallbackTitle(input),
      category:
        department === "MIS"
          ? "SOFTWARE"
          : hasPrinter
            ? "PRINTER"
            : hasInternet
              ? "NETWORK"
              : "HARDWARE",
      priority,
      details: input,
      mrn,
      maintenanceDesktopLaptop: hasComputer,
      maintenanceInternetNetwork: hasInternet,
      maintenancePrinter: hasPrinter,
      maintenanceDetails:
        hasComputer || hasInternet || hasPrinter
          ? "Identified via automatic keyword fallback parser."
          : null,
      borrowRequest:
        lowerInput.includes("borrow") ||
        lowerInput.includes("request projector") ||
        lowerInput.includes("projector"),
      borrowDetails: lowerInput.includes("borrow")
        ? "Please specify borrowed items, duration, and venue."
        : null,
      websiteNewRequest: department === "MIS" && lowerInput.includes("new"),
      websiteUpdate:
        department === "MIS" &&
        (lowerInput.includes("update") || lowerInput.includes("edit")),
      softwareNewRequest:
        department === "MIS" &&
        (lowerInput.includes("develop") || lowerInput.includes("system")),
      softwareUpdate:
        department === "MIS" &&
        (lowerInput.includes("bug") || lowerInput.includes("fix")),
      softwareInstall:
        lowerInput.includes("install") || lowerInput.includes("setup"),
    };
  }

  private deriveFallbackTitle(input: string): string {
    const raw = input.trim();
    if (!raw) return "Support Ticket Request";
    const sentences = raw.split(/[.!?]/);
    const firstPhrase = sentences[0].trim();
    const words = firstPhrase.split(/\s+/);
    if (words.length > 6) {
      return words.slice(0, 6).join(" ") + "...";
    }
    return firstPhrase || "Support Ticket Request";
  }

  private normalizePriority(raw: string): string {
    const upper = (raw || "").toUpperCase().trim();
    if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(upper)) return upper;
    return "MEDIUM";
  }

  private mapAnalysis(parsed: any): TicketAnalysis {
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
  }

  /** Try to repair truncated JSON by closing open brackets/braces */
  private repairTruncatedJson(text: string): string {
    let repaired = text.trim();
    // Remove trailing comma if present
    repaired = repaired.replace(/,\s*$/, "");
    // Remove incomplete string value (e.g. truncated in the middle of a string)
    repaired = repaired.replace(/"[^"]*$/, '""');

    // Count open/close brackets and braces
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escape = false;

    for (const ch of repaired) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") openBraces++;
      if (ch === "}") openBraces--;
      if (ch === "[") openBrackets++;
      if (ch === "]") openBrackets--;
    }

    // Close any unclosed brackets/braces
    while (openBrackets > 0) {
      repaired += "]";
      openBrackets--;
    }
    while (openBraces > 0) {
      repaired += "}";
      openBraces--;
    }

    return repaired;
  }
}

/** Singleton instance */
export const geminiService = new GeminiService();
