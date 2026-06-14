export type TicketPrintStatus =
  | 'created'
  | 'print_requested'
  | 'printing'
  | 'printed'
  | 'print_failed'
  | 'synced'
  | 'redeemed'
  | 'expired'
  | 'voided';

export interface Ticket {
  ticket_id: string;
  ticket_code: string;
  kiosk_id: string;
  session_id: string;
  package_id: string;
  package_version: string;
  campaign_short_code: string;
  public_ticket_id: string;
  key_version: string;
  hmac_algorithm: 'HMAC-SHA-256';
  check_length: number;
  redemption_model: 'staff_visual_v1' | 'central_qr_validation' | 'offline_pattern';
  render_payload: Record<string, unknown>;
  print_status: TicketPrintStatus;
  created_at: string;
  printed_at?: string;
}

export interface RenderedTicket {
  ticket_id: string;
  ticket_code: string;
  title: string;
  body: string;
  qr_payload?: string;
  render_payload: Record<string, unknown>;
}
