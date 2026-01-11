/**
 * QR Code generation utilities for winning tickets
 * Story 1.8: Thermal Ticket Printing
 */

export interface TicketData {
  id: string;
  kioskId: string;
  prizeValue: number;
  timestamp: number;
  expiresAt: number;
}

/**
 * Generate a unique ticket ID
 */
export function generateTicketId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `TKT-${timestamp}-${random}`.toUpperCase();
}

/**
 * Create ticket data with 24-hour expiration
 */
export function createTicketData(
  kioskId: string,
  prizeValue: number
): TicketData {
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  return {
    id: generateTicketId(),
    kioskId,
    prizeValue,
    timestamp: now,
    expiresAt: now + twentyFourHours,
  };
}

/**
 * Encode ticket data as QR code payload string
 */
export function encodeTicketPayload(ticket: TicketData): string {
  return JSON.stringify({
    id: ticket.id,
    k: ticket.kioskId,
    v: ticket.prizeValue,
    e: ticket.expiresAt,
  });
}

/**
 * Validate that a ticket has not expired
 */
export function isTicketValid(ticket: TicketData): boolean {
  return Date.now() < ticket.expiresAt;
}

/**
 * Format expiration time for display on ticket
 */
export function formatExpiration(expiresAt: number): string {
  const date = new Date(expiresAt);
  return date.toLocaleString('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
