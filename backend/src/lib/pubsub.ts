/**
 * PubSub — Shared event bus for real-time GraphQL subscriptions
 *
 * Any module can:
 *   - pubsub.publish('EVENT_NAME', { payload })   → send an event
 *   - pubsub.asyncIterator(['EVENT_NAME'])         → listen in a subscription resolver
 *
 * Event name constants are defined here so every file uses the same strings.
 */

import { PubSub } from 'graphql-subscriptions';

// Single instance shared across the whole backend
// Using 'any' type parameter to allow flexible event payloads
export const pubsub = new PubSub<Record<string, any>>();

// ─── Event Names ───────────────────────────────────────────
// Use these constants instead of raw strings to avoid typos

export const EVENTS = {
  /** Fired when any ticket status changes (e.g. FOR_REVIEW → ASSIGNED) */
  TICKET_STATUS_CHANGED: 'TICKET_STATUS_CHANGED',

  /** Fired when a new ticket is created */
  TICKET_CREATED: 'TICKET_CREATED',

  /** Fired when a ticket is assigned to a user */
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',

  /** Fired when a new notification is created for a user */
  NOTIFICATION_CREATED: 'NOTIFICATION_CREATED',
} as const;
