import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { map, Observable } from 'rxjs';

// ─── Types ───────────────────────────────────────────────

export interface TicketAIAnalysis {
  cleanTicket: string;
  summary: string;
  category: string;
  priority: string;
  possibleRootCause: string;
  suggestedSolutions: string[];
  keywords: string[];
}

export interface SimilarTicket {
  id: number;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface RelatedArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string | null;
  viewCount: number;
  helpfulCount: number;
}

export interface SmartSuggestions {
  analysis: TicketAIAnalysis | null;
  similarTickets: SimilarTicket[];
  relatedArticles: RelatedArticle[];
  aiAvailable: boolean;
}

export interface ParsedTicketResult {
  department: 'MIS' | 'ITS';
  title: string;
  category?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
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

// ─── Queries ─────────────────────────────────────────────

const PARSE_NATURAL_LANGUAGE_TICKET = gql`
  query ParseNaturalLanguageTicket($input: String!) {
    parseNaturalLanguageTicket(input: $input) {
      department
      title
      category
      priority
      details
      mrn
      maintenanceDesktopLaptop
      maintenanceInternetNetwork
      maintenancePrinter
      maintenanceDetails
      borrowRequest
      borrowDetails
      websiteNewRequest
      websiteUpdate
      softwareNewRequest
      softwareUpdate
      softwareInstall
    }
  }
`;

const SMART_SUGGESTIONS_QUERY = gql`
  query SmartSuggestions($title: String!, $description: String!) {
    smartSuggestions(title: $title, description: $description) {
      analysis {
        cleanTicket
        summary
        category
        priority
        possibleRootCause
        suggestedSolutions
        keywords
      }
      similarTickets {
        id
        ticketNumber
        title
        status
        priority
        type
        createdAt
        resolvedAt
      }
      relatedArticles {
        id
        title
        category
        tags
        viewCount
        helpfulCount
      }
      aiAvailable
    }
  }
`;

const ANALYZE_TICKET_QUERY = gql`
  query AnalyzeTicket($title: String!, $description: String!) {
    analyzeTicket(title: $title, description: $description) {
      cleanTicket
      summary
      category
      priority
      possibleRootCause
      suggestedSolutions
      keywords
    }
  }
`;

// ─── Service ─────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AIService {
  private readonly apollo = inject(Apollo);

  /**
   * Get smart suggestions while creating a ticket.
   * Includes AI analysis (if available), similar tickets, and related KB articles.
   */
  getSmartSuggestions(title: string, description: string): Observable<SmartSuggestions> {
    return this.apollo
      .query<{ smartSuggestions: SmartSuggestions }>({
        query: SMART_SUGGESTIONS_QUERY,
        variables: { title, description },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data!.smartSuggestions));
  }

  /**
   * Get standalone AI analysis of a ticket description.
   */
  analyzeTicket(title: string, description: string): Observable<TicketAIAnalysis> {
    return this.apollo
      .query<{ analyzeTicket: TicketAIAnalysis }>({
        query: ANALYZE_TICKET_QUERY,
        variables: { title, description },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data!.analyzeTicket));
  }

  /**
   * Parse a raw natural language request into structured form values for ticket drafting.
   */
  parseNaturalLanguageTicket(input: string): Observable<ParsedTicketResult> {
    return this.apollo
      .query<{ parseNaturalLanguageTicket: ParsedTicketResult }>({
        query: PARSE_NATURAL_LANGUAGE_TICKET,
        variables: { input },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data!.parseNaturalLanguageTicket));
  }
}
