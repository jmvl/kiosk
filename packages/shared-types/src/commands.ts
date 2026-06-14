export const commandTypes = [
  'test_print',
  'enter_maintenance',
  'exit_maintenance',
  'restart_player',
  'restart_runtime',
  'restart_agent',
  'reboot_device',
  'download_package',
  'activate_package',
  'rollback_package',
  'upload_logs',
  'revoke_device',
] as const;

export type CommandType = (typeof commandTypes)[number];

export type CommandStatus =
  | 'pending'
  | 'accepted'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface Command<Payload = Record<string, unknown>> {
  command_id: string;
  kiosk_id: string;
  type: CommandType;
  status: CommandStatus;
  payload: Payload;
  issued_at: string;
  expires_at: string;
  requires_confirmation: boolean;
  idempotency_key: string;
}

interface BaseCommandResult<Evidence = Record<string, unknown>> {
  command_id: string;
  kiosk_id: string;
  status: Exclude<CommandStatus, 'pending'>;
  accepted_at?: string;
  started_at?: string;
  message?: string;
  error_code?: string;
  evidence: Evidence;
}

export interface CommandAcceptedResult<Evidence = Record<string, unknown>> extends BaseCommandResult<Evidence> {
  status: 'accepted';
  accepted_at: string;
  completed_at?: never;
}

export interface CommandRunningResult<Evidence = Record<string, unknown>> extends BaseCommandResult<Evidence> {
  status: 'running';
  started_at: string;
  completed_at?: never;
}

export interface CommandTerminalResult<Evidence = Record<string, unknown>> extends BaseCommandResult<Evidence> {
  status: 'succeeded' | 'failed' | 'expired' | 'cancelled';
  completed_at: string;
}

export type CommandResult<Evidence = Record<string, unknown>> =
  | CommandAcceptedResult<Evidence>
  | CommandRunningResult<Evidence>
  | CommandTerminalResult<Evidence>;
