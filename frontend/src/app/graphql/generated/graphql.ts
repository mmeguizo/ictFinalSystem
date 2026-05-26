import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: any; output: any; }
};

export type AcknowledgeAndAssignInput = {
  assignToUserId?: InputMaybe<Scalars['Int']['input']>;
  assignedDeveloperName: Scalars['String']['input'];
  comment?: InputMaybe<Scalars['String']['input']>;
  dateToVisit?: InputMaybe<Scalars['String']['input']>;
  targetCompletionDate?: InputMaybe<Scalars['String']['input']>;
};

export type AnalyticsFilterInput = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<TicketType>;
};

export type ArticleFilterInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ArticleStatus>;
};

export enum ArticleStatus {
  Archived = 'ARCHIVED',
  Draft = 'DRAFT',
  Published = 'PUBLISHED'
}

export type AssignTicketInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  dateToVisit?: InputMaybe<Scalars['String']['input']>;
  targetCompletionDate?: InputMaybe<Scalars['String']['input']>;
};

export type BackfillResult = {
  __typename?: 'BackfillResult';
  embeddingsFailed: Scalars['Int']['output'];
  embeddingsGenerated: Scalars['Int']['output'];
  solutionsCreated: Scalars['Int']['output'];
};

export type ChatMessage = {
  __typename?: 'ChatMessage';
  content: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  metadata?: Maybe<Scalars['String']['output']>;
  role: ChatMessageRole;
  sessionId: Scalars['Int']['output'];
};

export enum ChatMessageRole {
  Assistant = 'ASSISTANT',
  System = 'SYSTEM',
  User = 'USER'
}

export type ChatResponse = {
  __typename?: 'ChatResponse';
  metadata?: Maybe<Scalars['String']['output']>;
  reply: Scalars['String']['output'];
  session: ChatSession;
};

export type ChatSession = {
  __typename?: 'ChatSession';
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  messageCount?: Maybe<Scalars['Int']['output']>;
  messages: Array<ChatMessage>;
  status: ChatSessionStatus;
  ticket?: Maybe<Ticket>;
  ticketId?: Maybe<Scalars['Int']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['Int']['output'];
};

export enum ChatSessionStatus {
  Active = 'ACTIVE',
  Closed = 'CLOSED',
  TicketCreated = 'TICKET_CREATED'
}

export type ChatSessionWithUser = {
  __typename?: 'ChatSessionWithUser';
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  messageCount?: Maybe<Scalars['Int']['output']>;
  status: ChatSessionStatus;
  ticketId?: Maybe<Scalars['Int']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  user: User;
  userId: Scalars['Int']['output'];
};

export type CreateArticleInput = {
  category: Scalars['String']['input'];
  content: Scalars['String']['input'];
  status?: InputMaybe<ArticleStatus>;
  tags?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreateItsTicketInput = {
  borrowDetails?: InputMaybe<Scalars['String']['input']>;
  borrowRequest?: InputMaybe<Scalars['Boolean']['input']>;
  description: Scalars['String']['input'];
  estimatedDuration?: InputMaybe<Scalars['Int']['input']>;
  maintenanceDesktopLaptop?: InputMaybe<Scalars['Boolean']['input']>;
  maintenanceDetails?: InputMaybe<Scalars['String']['input']>;
  maintenanceInternetNetwork?: InputMaybe<Scalars['Boolean']['input']>;
  maintenancePrinter?: InputMaybe<Scalars['Boolean']['input']>;
  priority?: InputMaybe<Priority>;
  title: Scalars['String']['input'];
};

export type CreateMisTicketInput = {
  category: MisCategory;
  description: Scalars['String']['input'];
  estimatedDuration?: InputMaybe<Scalars['Int']['input']>;
  priority?: InputMaybe<Priority>;
  softwareInstall?: InputMaybe<Scalars['Boolean']['input']>;
  softwareNewRequest?: InputMaybe<Scalars['Boolean']['input']>;
  softwareUpdate?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
  websiteNewRequest?: InputMaybe<Scalars['Boolean']['input']>;
  websiteUpdate?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateSolutionInput = {
  category: Scalars['String']['input'];
  problem: Scalars['String']['input'];
  solution: Scalars['String']['input'];
  tags?: InputMaybe<Scalars['String']['input']>;
  ticketId?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateTicketFromChatInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  description: Scalars['String']['input'];
  priority?: InputMaybe<Scalars['String']['input']>;
  sessionId: Scalars['Int']['input'];
  title: Scalars['String']['input'];
  type: Scalars['String']['input'];
};

export type CreateTicketNoteInput = {
  content: Scalars['String']['input'];
  isInternal?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
  role: Role;
};

export type ItsTicket = {
  __typename?: 'ITSTicket';
  borrowDetails?: Maybe<Scalars['String']['output']>;
  borrowRequest: Scalars['Boolean']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  maintenanceDesktopLaptop: Scalars['Boolean']['output'];
  maintenanceDetails?: Maybe<Scalars['String']['output']>;
  maintenanceInternetNetwork: Scalars['Boolean']['output'];
  maintenancePrinter: Scalars['Boolean']['output'];
  ticketId: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
};

export type KnowledgeArticle = {
  __typename?: 'KnowledgeArticle';
  category: Scalars['String']['output'];
  content: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  createdBy: User;
  createdById: Scalars['Int']['output'];
  helpfulCount: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  status: ArticleStatus;
  tags?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  viewCount: Scalars['Int']['output'];
};

export type LoginPayload = {
  __typename?: 'LoginPayload';
  token: Scalars['String']['output'];
  user: User;
};

export enum MisCategory {
  Software = 'SOFTWARE',
  Website = 'WEBSITE'
}

export type MisTicket = {
  __typename?: 'MISTicket';
  category: MisCategory;
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  softwareInstall: Scalars['Boolean']['output'];
  softwareNewRequest: Scalars['Boolean']['output'];
  softwareUpdate: Scalars['Boolean']['output'];
  ticketId: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
  websiteNewRequest: Scalars['Boolean']['output'];
  websiteUpdate: Scalars['Boolean']['output'];
};

export type MarkAllReadResult = {
  __typename?: 'MarkAllReadResult';
  count: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  acknowledgeAndAssignDeveloper: Ticket;
  addTicketNote: TicketNote;
  approveTicketAsDirector: Ticket;
  assignTicket: Ticket;
  backfillSolutionEmbeddings: BackfillResult;
  createArticle: KnowledgeArticle;
  createChatSession: ChatSession;
  createITSTicket: Ticket;
  createMISTicket: Ticket;
  /** Create a new troubleshooting solution (staff only) */
  createSolution: TroubleshootingSolution;
  createTicketFromChat: Ticket;
  createUser: User;
  deleteArticle: Scalars['Boolean']['output'];
  deleteChatSession: Scalars['Boolean']['output'];
  /** Delete a solution (author or admin only) */
  deleteSolution: Scalars['Boolean']['output'];
  deleteTicketAttachment: Scalars['Boolean']['output'];
  deleteTicketNote: Scalars['Boolean']['output'];
  deleteUser: Scalars['Boolean']['output'];
  disapproveTicketAsDirector: Ticket;
  login: LoginPayload;
  markAllNotificationsAsRead: MarkAllReadResult;
  markArticleHelpful: KnowledgeArticle;
  markNotificationAsRead: Notification;
  rejectTicketAsSecretary: Ticket;
  reopenTicket: Ticket;
  reviewTicketAsSecretary: Ticket;
  sendChatMessage: ChatResponse;
  setLocalPassword: User;
  setMyPassword: User;
  setUserRole: User;
  submitSatisfaction: Ticket;
  toggleUserActive: User;
  unassignTicket: Ticket;
  updateArticle: KnowledgeArticle;
  updateMyProfile: User;
  updateResolution: Ticket;
  /** Update an existing solution (author or admin only) */
  updateSolution: TroubleshootingSolution;
  updateTicketDescription: Ticket;
  updateTicketNote: TicketNote;
  updateTicketStatus: Ticket;
  updateUserSkills: User;
  upsertMe: UpsertMePayload;
};


export type MutationAcknowledgeAndAssignDeveloperArgs = {
  input: AcknowledgeAndAssignInput;
  ticketId: Scalars['Int']['input'];
};


export type MutationAddTicketNoteArgs = {
  input: CreateTicketNoteInput;
  ticketId: Scalars['Int']['input'];
};


export type MutationApproveTicketAsDirectorArgs = {
  comment?: InputMaybe<Scalars['String']['input']>;
  ticketId: Scalars['Int']['input'];
};


export type MutationAssignTicketArgs = {
  input?: InputMaybe<AssignTicketInput>;
  ticketId: Scalars['Int']['input'];
  userId: Scalars['Int']['input'];
};


export type MutationCreateArticleArgs = {
  input: CreateArticleInput;
};


export type MutationCreateChatSessionArgs = {
  title?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateItsTicketArgs = {
  input: CreateItsTicketInput;
};


export type MutationCreateMisTicketArgs = {
  input: CreateMisTicketInput;
};


export type MutationCreateSolutionArgs = {
  input: CreateSolutionInput;
};


export type MutationCreateTicketFromChatArgs = {
  input: CreateTicketFromChatInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeleteArticleArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDeleteChatSessionArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDeleteSolutionArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDeleteTicketAttachmentArgs = {
  attachmentId: Scalars['Int']['input'];
};


export type MutationDeleteTicketNoteArgs = {
  noteId: Scalars['Int']['input'];
};


export type MutationDeleteUserArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDisapproveTicketAsDirectorArgs = {
  reason: Scalars['String']['input'];
  ticketId: Scalars['Int']['input'];
};


export type MutationLoginArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationMarkArticleHelpfulArgs = {
  id: Scalars['Int']['input'];
};


export type MutationMarkNotificationAsReadArgs = {
  id: Scalars['Int']['input'];
};


export type MutationRejectTicketAsSecretaryArgs = {
  reason: Scalars['String']['input'];
  ticketId: Scalars['Int']['input'];
};


export type MutationReopenTicketArgs = {
  input?: InputMaybe<ReopenTicketInput>;
  ticketId: Scalars['Int']['input'];
};


export type MutationReviewTicketAsSecretaryArgs = {
  comment?: InputMaybe<Scalars['String']['input']>;
  ticketId: Scalars['Int']['input'];
};


export type MutationSendChatMessageArgs = {
  message: Scalars['String']['input'];
  sessionId: Scalars['Int']['input'];
};


export type MutationSetLocalPasswordArgs = {
  id: Scalars['Int']['input'];
  password: Scalars['String']['input'];
};


export type MutationSetMyPasswordArgs = {
  password: Scalars['String']['input'];
};


export type MutationSetUserRoleArgs = {
  id: Scalars['Int']['input'];
  role: Role;
};


export type MutationSubmitSatisfactionArgs = {
  input: SubmitSatisfactionInput;
  ticketId: Scalars['Int']['input'];
};


export type MutationToggleUserActiveArgs = {
  id: Scalars['Int']['input'];
};


export type MutationUnassignTicketArgs = {
  ticketId: Scalars['Int']['input'];
  userId: Scalars['Int']['input'];
};


export type MutationUpdateArticleArgs = {
  id: Scalars['Int']['input'];
  input: UpdateArticleInput;
};


export type MutationUpdateMyProfileArgs = {
  input: UpdateProfileInput;
};


export type MutationUpdateResolutionArgs = {
  input: UpdateResolutionInput;
  ticketId: Scalars['Int']['input'];
};


export type MutationUpdateSolutionArgs = {
  id: Scalars['Int']['input'];
  input: UpdateSolutionInput;
};


export type MutationUpdateTicketDescriptionArgs = {
  input: UpdateTicketDescriptionInput;
  ticketId: Scalars['Int']['input'];
};


export type MutationUpdateTicketNoteArgs = {
  input: UpdateTicketNoteInput;
  noteId: Scalars['Int']['input'];
};


export type MutationUpdateTicketStatusArgs = {
  input: UpdateTicketStatusInput;
  ticketId: Scalars['Int']['input'];
};


export type MutationUpdateUserSkillsArgs = {
  skills: Array<Scalars['String']['input']>;
  userId: Scalars['Int']['input'];
};

export type Notification = {
  __typename?: 'Notification';
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  isRead: Scalars['Boolean']['output'];
  message: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  readAt?: Maybe<Scalars['String']['output']>;
  ticket?: Maybe<NotificationTicket>;
  ticketId?: Maybe<Scalars['Int']['output']>;
  title: Scalars['String']['output'];
  type: NotificationType;
  userId: Scalars['Int']['output'];
};

export type NotificationCount = {
  __typename?: 'NotificationCount';
  unread: Scalars['Int']['output'];
};

export type NotificationTicket = {
  __typename?: 'NotificationTicket';
  id: Scalars['Int']['output'];
  ticketNumber: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export enum NotificationType {
  AttachmentAdded = 'ATTACHMENT_ADDED',
  NoteAdded = 'NOTE_ADDED',
  SlaBreach = 'SLA_BREACH',
  StatusChanged = 'STATUS_CHANGED',
  TicketApproved = 'TICKET_APPROVED',
  TicketAssigned = 'TICKET_ASSIGNED',
  TicketCreated = 'TICKET_CREATED',
  TicketDisapproved = 'TICKET_DISAPPROVED',
  TicketEscalated = 'TICKET_ESCALATED',
  TicketRejected = 'TICKET_REJECTED',
  TicketReviewed = 'TICKET_REVIEWED'
}

export type PaginatedArticles = {
  __typename?: 'PaginatedArticles';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  items: Array<KnowledgeArticle>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type PaginatedSolutions = {
  __typename?: 'PaginatedSolutions';
  items: Array<TroubleshootingSolution>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type PaginatedTickets = {
  __typename?: 'PaginatedTickets';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  items: Array<Ticket>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type PaginationInput = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  sortField?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['String']['input']>;
};

/** Structured data parsed from a natural language ticket description */
export type ParsedTicketResult = {
  __typename?: 'ParsedTicketResult';
  borrowDetails?: Maybe<Scalars['String']['output']>;
  borrowRequest?: Maybe<Scalars['Boolean']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  department: TicketType;
  details: Scalars['String']['output'];
  maintenanceDesktopLaptop?: Maybe<Scalars['Boolean']['output']>;
  maintenanceDetails?: Maybe<Scalars['String']['output']>;
  maintenanceInternetNetwork?: Maybe<Scalars['Boolean']['output']>;
  maintenancePrinter?: Maybe<Scalars['Boolean']['output']>;
  mrn?: Maybe<Scalars['String']['output']>;
  priority: Priority;
  softwareInstall?: Maybe<Scalars['Boolean']['output']>;
  softwareNewRequest?: Maybe<Scalars['Boolean']['output']>;
  softwareUpdate?: Maybe<Scalars['Boolean']['output']>;
  title: Scalars['String']['output'];
  websiteNewRequest?: Maybe<Scalars['Boolean']['output']>;
  websiteUpdate?: Maybe<Scalars['Boolean']['output']>;
};

export enum Priority {
  Critical = 'CRITICAL',
  High = 'HIGH',
  Low = 'LOW',
  Medium = 'MEDIUM'
}

export type PriorityCount = {
  __typename?: 'PriorityCount';
  count: Scalars['Int']['output'];
  priority: Priority;
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  /** Admin-only: view all chat sessions across all users */
  allChatSessions: Array<ChatSessionWithUser>;
  allSecretaryTickets: PaginatedTickets;
  /**
   * Analyze a ticket description using Gemini AI (standalone).
   * Returns structured analysis with category, priority, solutions, etc.
   */
  analyzeTicket?: Maybe<TicketAiAnalysis>;
  chatSession?: Maybe<ChatSession>;
  chatSessions: Array<ChatSession>;
  knowledgeArticle?: Maybe<KnowledgeArticle>;
  knowledgeArticles: PaginatedArticles;
  knowledgeCategories: Array<Scalars['String']['output']>;
  me?: Maybe<User>;
  myCreatedTickets: PaginatedTickets;
  myNotifications: Array<Notification>;
  myTickets: PaginatedTickets;
  officeHeadTickets: PaginatedTickets;
  /** Parse a casual natural language input into structured drafting fields for form pre-population. */
  parseNaturalLanguageTicket: ParsedTicketResult;
  slaMetrics: SlaMetrics;
  /**
   * Analyze a ticket description using AI and find similar tickets/articles.
   * Used during ticket creation to provide smart suggestions.
   */
  smartSuggestions: SmartSuggestions;
  staffPerformance: Array<StaffPerformance>;
  ticket?: Maybe<Ticket>;
  ticketAnalytics: TicketAnalytics;
  ticketByNumber?: Maybe<Ticket>;
  ticketTrends: TicketTrends;
  tickets: PaginatedTickets;
  ticketsForSecretaryReview: Array<Ticket>;
  ticketsPendingDirectorApproval: Array<Ticket>;
  /** Get a single solution by ID */
  troubleshootingSolution?: Maybe<TroubleshootingSolution>;
  /** List troubleshooting solutions with optional filters */
  troubleshootingSolutions: PaginatedSolutions;
  unreadNotificationCount: NotificationCount;
  user?: Maybe<User>;
  users: Array<User>;
  usersByRole: Array<User>;
  usersByRoles: Array<User>;
};


export type QueryAllSecretaryTicketsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryAnalyzeTicketArgs = {
  description: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type QueryChatSessionArgs = {
  id: Scalars['Int']['input'];
};


export type QueryKnowledgeArticleArgs = {
  id: Scalars['Int']['input'];
};


export type QueryKnowledgeArticlesArgs = {
  filter?: InputMaybe<ArticleFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryMyCreatedTicketsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryMyNotificationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  unreadOnly?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryMyTicketsArgs = {
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryOfficeHeadTicketsArgs = {
  type: TicketType;
};


export type QueryParseNaturalLanguageTicketArgs = {
  input: Scalars['String']['input'];
};


export type QuerySlaMetricsArgs = {
  type?: InputMaybe<TicketType>;
};


export type QuerySmartSuggestionsArgs = {
  description: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type QueryStaffPerformanceArgs = {
  filter?: InputMaybe<AnalyticsFilterInput>;
};


export type QueryTicketArgs = {
  id: Scalars['Int']['input'];
};


export type QueryTicketAnalyticsArgs = {
  filter?: InputMaybe<AnalyticsFilterInput>;
};


export type QueryTicketByNumberArgs = {
  ticketNumber: Scalars['String']['input'];
};


export type QueryTicketTrendsArgs = {
  filter?: InputMaybe<AnalyticsFilterInput>;
};


export type QueryTicketsArgs = {
  filter?: InputMaybe<TicketFilterInput>;
  pagination?: InputMaybe<PaginationInput>;
};


export type QueryTroubleshootingSolutionArgs = {
  id: Scalars['Int']['input'];
};


export type QueryTroubleshootingSolutionsArgs = {
  filter?: InputMaybe<SolutionFilterInput>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryUserArgs = {
  id: Scalars['Int']['input'];
};


export type QueryUsersByRoleArgs = {
  role: Role;
};


export type QueryUsersByRolesArgs = {
  roles: Array<Role>;
};

export type ReopenTicketInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  updatedDescription?: InputMaybe<Scalars['String']['input']>;
};

export enum Role {
  Admin = 'ADMIN',
  Developer = 'DEVELOPER',
  Director = 'DIRECTOR',
  ItsHead = 'ITS_HEAD',
  MisHead = 'MIS_HEAD',
  Secretary = 'SECRETARY',
  Technical = 'TECHNICAL',
  User = 'USER'
}

export type SlaMetrics = {
  __typename?: 'SLAMetrics';
  averageResolutionHours?: Maybe<Scalars['Float']['output']>;
  complianceRate: Scalars['Float']['output'];
  dueSoon: Scalars['Int']['output'];
  dueToday: Scalars['Int']['output'];
  overdue: Scalars['Int']['output'];
  overdueTickets: Array<Ticket>;
  resolvedWithinSLA: Scalars['Int']['output'];
  totalResolved: Scalars['Int']['output'];
};

/** A similar ticket found by keyword/content matching */
export type SimilarTicket = {
  __typename?: 'SimilarTicket';
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  priority: Priority;
  resolvedAt?: Maybe<Scalars['String']['output']>;
  status: TicketStatus;
  ticketNumber: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: TicketType;
};

/** Combined smart suggestion result for ticket creation */
export type SmartSuggestions = {
  __typename?: 'SmartSuggestions';
  aiAvailable: Scalars['Boolean']['output'];
  analysis?: Maybe<TicketAiAnalysis>;
  relatedArticles: Array<KnowledgeArticle>;
  similarTickets: Array<SimilarTicket>;
};

export type SolutionFilterInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type StaffPerformance = {
  __typename?: 'StaffPerformance';
  averageResolutionHours?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  role: Scalars['String']['output'];
  slaComplianceRate: Scalars['Float']['output'];
  totalAssigned: Scalars['Int']['output'];
  totalResolved: Scalars['Int']['output'];
  userId: Scalars['Int']['output'];
};

export type StatusCount = {
  __typename?: 'StatusCount';
  count: Scalars['Int']['output'];
  status: TicketStatus;
};

export type SubmitSatisfactionInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  rating: Scalars['Int']['input'];
};

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
  /** Listen for new notifications for the current user */
  notificationCreated: Notification;
  /** Listen for ticket assignments to a specific user */
  ticketAssigned: TicketAssignedPayload;
  /** Listen for all ticket assignment events for dashboard activity feeds */
  ticketAssignmentActivity: TicketAssignedPayload;
  /** Listen for newly created tickets (useful for secretary/dashboard) */
  ticketCreated: TicketCreatedPayload;
  /** Listen for any ticket status change (optionally filter by ticketId) */
  ticketStatusChanged: TicketStatusChangedPayload;
};


export type SubscriptionNotificationCreatedArgs = {
  userId: Scalars['Int']['input'];
};


export type SubscriptionTicketAssignedArgs = {
  userId: Scalars['Int']['input'];
};


export type SubscriptionTicketStatusChangedArgs = {
  ticketId?: InputMaybe<Scalars['Int']['input']>;
};

export type Ticket = {
  __typename?: 'Ticket';
  actualDuration?: Maybe<Scalars['Int']['output']>;
  assignedDeveloperName?: Maybe<Scalars['String']['output']>;
  assignments: Array<TicketAssignment>;
  attachments: Array<TicketAttachment>;
  closedAt?: Maybe<Scalars['String']['output']>;
  controlNumber: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  createdBy: User;
  createdById: Scalars['Int']['output'];
  dateFinished?: Maybe<Scalars['String']['output']>;
  dateToVisit?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  directorApprovedAt?: Maybe<Scalars['String']['output']>;
  directorApprovedById?: Maybe<Scalars['Int']['output']>;
  dueDate?: Maybe<Scalars['String']['output']>;
  escalatedAt?: Maybe<Scalars['String']['output']>;
  escalationLevel: Scalars['Int']['output'];
  estimatedDuration?: Maybe<Scalars['Int']['output']>;
  id: Scalars['Int']['output'];
  itsTicket?: Maybe<ItsTicket>;
  misTicket?: Maybe<MisTicket>;
  notes: Array<TicketNote>;
  priority: Priority;
  resolution?: Maybe<Scalars['String']['output']>;
  resolvedAt?: Maybe<Scalars['String']['output']>;
  satisfactionComment?: Maybe<Scalars['String']['output']>;
  satisfactionRating?: Maybe<Scalars['Int']['output']>;
  secretaryReviewedAt?: Maybe<Scalars['String']['output']>;
  secretaryReviewedById?: Maybe<Scalars['Int']['output']>;
  status: TicketStatus;
  statusHistory: Array<TicketStatusHistory>;
  targetCompletionDate?: Maybe<Scalars['String']['output']>;
  ticketNumber: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: TicketType;
  updatedAt: Scalars['String']['output'];
};

/** Structured AI analysis of a support ticket */
export type TicketAiAnalysis = {
  __typename?: 'TicketAIAnalysis';
  category: Scalars['String']['output'];
  cleanTicket: Scalars['String']['output'];
  keywords: Array<Scalars['String']['output']>;
  possibleRootCause: Scalars['String']['output'];
  priority: Scalars['String']['output'];
  suggestedSolutions: Array<Scalars['String']['output']>;
  summary: Scalars['String']['output'];
};

export type TicketAnalytics = {
  __typename?: 'TicketAnalytics';
  byPriority: Array<PriorityCount>;
  byStatus: Array<StatusCount>;
  byType: Array<TypeCount>;
  total: Scalars['Int']['output'];
};

/** Fired when a ticket is assigned to someone */
export type TicketAssignedPayload = {
  __typename?: 'TicketAssignedPayload';
  assignedBy: Scalars['String']['output'];
  assignedToName: Scalars['String']['output'];
  assignedToUserId: Scalars['Int']['output'];
  ticketId: Scalars['Int']['output'];
  ticketNumber: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type TicketAssignment = {
  __typename?: 'TicketAssignment';
  assignedAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  ticketId: Scalars['Int']['output'];
  user: User;
  userId: Scalars['Int']['output'];
};

export type TicketAttachment = {
  __typename?: 'TicketAttachment';
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  deletedBy?: Maybe<User>;
  filename: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  isDeleted: Scalars['Boolean']['output'];
  mimeType: Scalars['String']['output'];
  originalName: Scalars['String']['output'];
  size: Scalars['Int']['output'];
  ticketId: Scalars['Int']['output'];
  uploadedBy?: Maybe<User>;
  url: Scalars['String']['output'];
};

/** Fired when a brand-new ticket is created */
export type TicketCreatedPayload = {
  __typename?: 'TicketCreatedPayload';
  createdBy: Scalars['String']['output'];
  priority: Priority;
  ticketId: Scalars['Int']['output'];
  ticketNumber: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: TicketType;
};

export type TicketFilterInput = {
  assignedToUserId?: InputMaybe<Scalars['Int']['input']>;
  createdById?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<TicketStatus>;
  type?: InputMaybe<TicketType>;
};

export type TicketNote = {
  __typename?: 'TicketNote';
  content: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  isInternal: Scalars['Boolean']['output'];
  ticketId: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
  user: User;
  userId: Scalars['Int']['output'];
};

export enum TicketStatus {
  Assigned = 'ASSIGNED',
  Cancelled = 'CANCELLED',
  Closed = 'CLOSED',
  DirectorApproved = 'DIRECTOR_APPROVED',
  ForReview = 'FOR_REVIEW',
  InProgress = 'IN_PROGRESS',
  OnHold = 'ON_HOLD',
  Pending = 'PENDING',
  Resolved = 'RESOLVED',
  Reviewed = 'REVIEWED'
}

/** Fired when a ticket's status changes (e.g. FOR_REVIEW → ASSIGNED) */
export type TicketStatusChangedPayload = {
  __typename?: 'TicketStatusChangedPayload';
  changedBy: Scalars['String']['output'];
  newStatus: TicketStatus;
  oldStatus: TicketStatus;
  ticketId: Scalars['Int']['output'];
  ticketNumber: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type TicketStatusHistory = {
  __typename?: 'TicketStatusHistory';
  comment?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  fromStatus?: Maybe<TicketStatus>;
  id: Scalars['Int']['output'];
  ticketId: Scalars['Int']['output'];
  toStatus: TicketStatus;
  user: User;
  userId: Scalars['Int']['output'];
};

export type TicketTrendPoint = {
  __typename?: 'TicketTrendPoint';
  count: Scalars['Int']['output'];
  date: Scalars['String']['output'];
};

export type TicketTrends = {
  __typename?: 'TicketTrends';
  createdPerDay: Array<TicketTrendPoint>;
  resolvedPerDay: Array<TicketTrendPoint>;
};

export enum TicketType {
  Its = 'ITS',
  Mis = 'MIS'
}

export type TroubleshootingSolution = {
  __typename?: 'TroubleshootingSolution';
  category: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  createdBy: User;
  createdById: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  problem: Scalars['String']['output'];
  solution: Scalars['String']['output'];
  tags?: Maybe<Scalars['String']['output']>;
  ticketId?: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type TypeCount = {
  __typename?: 'TypeCount';
  count: Scalars['Int']['output'];
  type: TicketType;
};

export type UpdateArticleInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  content?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ArticleStatus>;
  tags?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateProfileInput = {
  avatarDataUrl?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateResolutionInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  dateFinished?: InputMaybe<Scalars['String']['input']>;
  resolution: Scalars['String']['input'];
  solutionVisibility?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<TicketStatus>;
};

export type UpdateSolutionInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  problem?: InputMaybe<Scalars['String']['input']>;
  solution?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTicketDescriptionInput = {
  description: Scalars['String']['input'];
};

export type UpdateTicketNoteInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  isInternal?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateTicketStatusInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  status: TicketStatus;
  targetCompletionDate?: InputMaybe<Scalars['String']['input']>;
};

export type UpsertMePayload = {
  __typename?: 'UpsertMePayload';
  created: Scalars['Boolean']['output'];
  user: User;
};

export type User = {
  __typename?: 'User';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  deactivatedAt?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  externalId?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  isActive: Scalars['Boolean']['output'];
  lastLoginAt?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  picture?: Maybe<Scalars['String']['output']>;
  role: Role;
  skills: Array<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type LoginMutationVariables = Exact<{
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'LoginPayload', token: string, user: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null } } };

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;


export type CreateUserMutation = { __typename?: 'Mutation', createUser: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role } };

export type ChatSessionFieldsFragment = { __typename?: 'ChatSession', id: number, title: string, status: ChatSessionStatus, ticketId?: number | null, messageCount?: number | null, createdAt: string, updatedAt: string };

export type ChatMessageFieldsFragment = { __typename?: 'ChatMessage', id: number, sessionId: number, role: ChatMessageRole, content: string, metadata?: string | null, createdAt: string };

export type GetChatSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetChatSessionsQuery = { __typename?: 'Query', chatSessions: Array<{ __typename?: 'ChatSession', id: number, title: string, status: ChatSessionStatus, ticketId?: number | null, messageCount?: number | null, createdAt: string, updatedAt: string }> };

export type GetChatSessionQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type GetChatSessionQuery = { __typename?: 'Query', chatSession?: { __typename?: 'ChatSession', id: number, title: string, status: ChatSessionStatus, ticketId?: number | null, messageCount?: number | null, createdAt: string, updatedAt: string, messages: Array<{ __typename?: 'ChatMessage', id: number, sessionId: number, role: ChatMessageRole, content: string, metadata?: string | null, createdAt: string }> } | null };

export type CreateChatSessionMutationVariables = Exact<{
  title?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateChatSessionMutation = { __typename?: 'Mutation', createChatSession: { __typename?: 'ChatSession', id: number, title: string, status: ChatSessionStatus, ticketId?: number | null, messageCount?: number | null, createdAt: string, updatedAt: string } };

export type SendChatMessageMutationVariables = Exact<{
  sessionId: Scalars['Int']['input'];
  message: Scalars['String']['input'];
}>;


export type SendChatMessageMutation = { __typename?: 'Mutation', sendChatMessage: { __typename?: 'ChatResponse', reply: string, metadata?: string | null, session: { __typename?: 'ChatSession', id: number, title: string, status: ChatSessionStatus, ticketId?: number | null, messageCount?: number | null, createdAt: string, updatedAt: string } } };

export type CreateTicketFromChatMutationVariables = Exact<{
  input: CreateTicketFromChatInput;
}>;


export type CreateTicketFromChatMutation = { __typename?: 'Mutation', createTicketFromChat: { __typename?: 'Ticket', id: number, ticketNumber: string, title: string, status: TicketStatus, type: TicketType, priority: Priority } };

export type DeleteChatSessionMutationVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type DeleteChatSessionMutation = { __typename?: 'Mutation', deleteChatSession: boolean };

export type UserFieldsFragment = { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> };

export type GetMeQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMeQuery = { __typename?: 'Query', me?: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> } | null };

export type GetAllUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllUsersQuery = { __typename?: 'Query', users: Array<{ __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> }> };

export type GetUserQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type GetUserQuery = { __typename?: 'Query', user?: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> } | null };

export type UpdateMyProfileMutationVariables = Exact<{
  input: UpdateProfileInput;
}>;


export type UpdateMyProfileMutation = { __typename?: 'Mutation', updateMyProfile: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> } };

export type SetMyPasswordMutationVariables = Exact<{
  password: Scalars['String']['input'];
}>;


export type SetMyPasswordMutation = { __typename?: 'Mutation', setMyPassword: { __typename?: 'User', id: number } };

export type UpsertMeMutationVariables = Exact<{ [key: string]: never; }>;


export type UpsertMeMutation = { __typename?: 'Mutation', upsertMe: { __typename?: 'UpsertMePayload', created: boolean, user: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> } } };

export type SetUserRoleMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  role: Role;
}>;


export type SetUserRoleMutation = { __typename?: 'Mutation', setUserRole: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> } };

export type UpdateUserSkillsMutationVariables = Exact<{
  userId: Scalars['Int']['input'];
  skills: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type UpdateUserSkillsMutation = { __typename?: 'Mutation', updateUserSkills: { __typename?: 'User', id: number, email: string, name?: string | null, role: Role, avatarUrl?: string | null, picture?: string | null, skills: Array<string> } };

export const ChatSessionFieldsFragmentDoc = gql`
    fragment ChatSessionFields on ChatSession {
  id
  title
  status
  ticketId
  messageCount
  createdAt
  updatedAt
}
    `;
export const ChatMessageFieldsFragmentDoc = gql`
    fragment ChatMessageFields on ChatMessage {
  id
  sessionId
  role
  content
  metadata
  createdAt
}
    `;
export const UserFieldsFragmentDoc = gql`
    fragment UserFields on User {
  id
  email
  name
  role
  avatarUrl
  picture
  skills
}
    `;
export const LoginDocument = gql`
    mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user {
      id
      email
      name
      role
      avatarUrl
      picture
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class LoginGQL extends Apollo.Mutation<LoginMutation, LoginMutationVariables> {
    override document = LoginDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateUserDocument = gql`
    mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    email
    name
    role
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateUserGQL extends Apollo.Mutation<CreateUserMutation, CreateUserMutationVariables> {
    override document = CreateUserDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const GetChatSessionsDocument = gql`
    query GetChatSessions {
  chatSessions {
    ...ChatSessionFields
  }
}
    ${ChatSessionFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class GetChatSessionsGQL extends Apollo.Query<GetChatSessionsQuery, GetChatSessionsQueryVariables> {
    override document = GetChatSessionsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const GetChatSessionDocument = gql`
    query GetChatSession($id: Int!) {
  chatSession(id: $id) {
    ...ChatSessionFields
    messages {
      ...ChatMessageFields
    }
  }
}
    ${ChatSessionFieldsFragmentDoc}
${ChatMessageFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class GetChatSessionGQL extends Apollo.Query<GetChatSessionQuery, GetChatSessionQueryVariables> {
    override document = GetChatSessionDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateChatSessionDocument = gql`
    mutation CreateChatSession($title: String) {
  createChatSession(title: $title) {
    ...ChatSessionFields
  }
}
    ${ChatSessionFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateChatSessionGQL extends Apollo.Mutation<CreateChatSessionMutation, CreateChatSessionMutationVariables> {
    override document = CreateChatSessionDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const SendChatMessageDocument = gql`
    mutation SendChatMessage($sessionId: Int!, $message: String!) {
  sendChatMessage(sessionId: $sessionId, message: $message) {
    reply
    metadata
    session {
      ...ChatSessionFields
    }
  }
}
    ${ChatSessionFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class SendChatMessageGQL extends Apollo.Mutation<SendChatMessageMutation, SendChatMessageMutationVariables> {
    override document = SendChatMessageDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateTicketFromChatDocument = gql`
    mutation CreateTicketFromChat($input: CreateTicketFromChatInput!) {
  createTicketFromChat(input: $input) {
    id
    ticketNumber
    title
    status
    type
    priority
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateTicketFromChatGQL extends Apollo.Mutation<CreateTicketFromChatMutation, CreateTicketFromChatMutationVariables> {
    override document = CreateTicketFromChatDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const DeleteChatSessionDocument = gql`
    mutation DeleteChatSession($id: Int!) {
  deleteChatSession(id: $id)
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class DeleteChatSessionGQL extends Apollo.Mutation<DeleteChatSessionMutation, DeleteChatSessionMutationVariables> {
    override document = DeleteChatSessionDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const GetMeDocument = gql`
    query GetMe {
  me {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class GetMeGQL extends Apollo.Query<GetMeQuery, GetMeQueryVariables> {
    override document = GetMeDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const GetAllUsersDocument = gql`
    query GetAllUsers {
  users {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class GetAllUsersGQL extends Apollo.Query<GetAllUsersQuery, GetAllUsersQueryVariables> {
    override document = GetAllUsersDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const GetUserDocument = gql`
    query GetUser($id: Int!) {
  user(id: $id) {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class GetUserGQL extends Apollo.Query<GetUserQuery, GetUserQueryVariables> {
    override document = GetUserDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpdateMyProfileDocument = gql`
    mutation UpdateMyProfile($input: UpdateProfileInput!) {
  updateMyProfile(input: $input) {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateMyProfileGQL extends Apollo.Mutation<UpdateMyProfileMutation, UpdateMyProfileMutationVariables> {
    override document = UpdateMyProfileDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const SetMyPasswordDocument = gql`
    mutation SetMyPassword($password: String!) {
  setMyPassword(password: $password) {
    id
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class SetMyPasswordGQL extends Apollo.Mutation<SetMyPasswordMutation, SetMyPasswordMutationVariables> {
    override document = SetMyPasswordDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpsertMeDocument = gql`
    mutation UpsertMe {
  upsertMe {
    user {
      ...UserFields
    }
    created
  }
}
    ${UserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class UpsertMeGQL extends Apollo.Mutation<UpsertMeMutation, UpsertMeMutationVariables> {
    override document = UpsertMeDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const SetUserRoleDocument = gql`
    mutation SetUserRole($id: Int!, $role: Role!) {
  setUserRole(id: $id, role: $role) {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class SetUserRoleGQL extends Apollo.Mutation<SetUserRoleMutation, SetUserRoleMutationVariables> {
    override document = SetUserRoleDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpdateUserSkillsDocument = gql`
    mutation UpdateUserSkills($userId: Int!, $skills: [String!]!) {
  updateUserSkills(userId: $userId, skills: $skills) {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateUserSkillsGQL extends Apollo.Mutation<UpdateUserSkillsMutation, UpdateUserSkillsMutationVariables> {
    override document = UpdateUserSkillsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }