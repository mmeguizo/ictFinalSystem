import { Priority, TicketType } from '@prisma/client';

/**
 * SLA configuration in hours by priority
 */
const SLA_CONFIG = {
  [Priority.CRITICAL]: 4, // 4 hours
  [Priority.HIGH]: 24, // 1 day
  [Priority.MEDIUM]: 72, // 3 days
  [Priority.LOW]: 168, // 7 days
};

/**
 * Calculate due date based on priority and ticket type
 */
export function calculateDueDate(
  priority: Priority,
  createdAt: Date = new Date()
): Date {
  const slaHours = SLA_CONFIG[priority];
  const dueDate = new Date(createdAt);
  dueDate.setHours(dueDate.getHours() + slaHours);
  return dueDate;
}

/**
 * Calculate estimated duration based on ticket type and priority
 * Returns hours
 */
export function calculateEstimatedDuration(
  type: TicketType,
  priority: Priority
): number {
  // Base estimates
  const baseEstimates = {
    [TicketType.MIS]: {
      [Priority.CRITICAL]: 3,
      [Priority.HIGH]: 8,
      [Priority.MEDIUM]: 16,
      [Priority.LOW]: 24,
    },
    [TicketType.ITS]: {
      [Priority.CRITICAL]: 2,
      [Priority.HIGH]: 4,
      [Priority.MEDIUM]: 8,
      [Priority.LOW]: 16,
    },
  };

  return baseEstimates[type][priority];
}

/**
 * Check if a ticket is overdue
 */
export function isOverdue(dueDate: Date | null, currentDate: Date = new Date()): boolean {
  if (!dueDate) return false;
  return currentDate > dueDate;
}

/**
 * Get time remaining until due date in hours
 * Returns negative number if overdue
 */
export function getTimeRemaining(dueDate: Date | null, currentDate: Date = new Date()): number | null {
  if (!dueDate) return null;
  const diffMs = dueDate.getTime() - currentDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Calculate SLA compliance percentage
 */
export function calculateSLACompliance(
  resolvedTickets: Array<{ dueDate: Date | null; resolvedAt: Date | null }>
): number {
  if (resolvedTickets.length === 0) return 100;

  const compliantTickets = resolvedTickets.filter((ticket) => {
    if (!ticket.dueDate || !ticket.resolvedAt) return false;
    return ticket.resolvedAt <= ticket.dueDate;
  });

  return Math.round((compliantTickets.length / resolvedTickets.length) * 100);
}

/**
 * Get SLA status for a ticket
 */
export function getSLAStatus(dueDate: Date | null, currentDate: Date = new Date()): 'on-track' | 'at-risk' | 'overdue' {
  if (!dueDate) return 'on-track';

  const hoursRemaining = getTimeRemaining(dueDate, currentDate);
  if (hoursRemaining === null) return 'on-track';

  if (hoursRemaining < 0) return 'overdue';
  if (hoursRemaining <= 4) return 'at-risk';
  return 'on-track';
}
