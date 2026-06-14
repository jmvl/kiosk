export interface EventEnvelope<Payload = Record<string, unknown>> {
  event_id: string;
  kiosk_id: string;
  session_id?: string;
  local_sequence: number;
  event_type: string;
  occurred_at: string;
  payload: Payload;
  schema_version: number;
}

export interface BridgeMessage<Payload = Record<string, unknown>> {
  bridge_version: '1';
  message_id: string;
  package_id: string;
  package_version: string;
  session_id: string;
  method:
    | 'recordTelemetry'
    | 'requestPrint'
    | 'complete'
    | 'fail'
    | 'getScheduleContext'
    | 'getRuntimeCapabilities';
  payload: Payload;
  created_at: string;
}
