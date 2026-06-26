# Kiosk Agent

Local kiosk agent that bridges the local kiosk runtime to the central control plane.

Current scope:

- Posts kiosk heartbeat payloads to `POST /v1/heartbeats`.
- Uploads local event envelopes from the local backend `GET /admin/api/events/export` endpoint to central `POST /v1/events/batch`.
- Persists the last uploaded local event sequence in `KIOSK_AGENT_LAST_UPLOADED_SEQUENCE_PATH` so uploads resume after restarts.
- Polls central commands via `GET /v1/kiosks/:kiosk_id/commands` and reports lifecycle results to `POST /v1/commands/:command_id/result`.
- Executes only the kiosk-agent allowlist: `test_print`, `enter_maintenance`, `exit_maintenance`, and `upload_logs`.

Relevant local-event sync configuration:

- `LOCAL_BACKEND_BASE_URL` or `LOCAL_BACKEND_URL` enables local event export polling.
- `KIOSK_AGENT_LOCAL_BACKEND_AUTH_TOKEN` or `LOCAL_BACKEND_AUTH_TOKEN` is sent as a bearer token to the local backend when configured.
- `KIOSK_AGENT_EVENT_UPLOAD_BATCH_SIZE` controls each local export batch size; default is `100`.
- `KIOSK_AGENT_LAST_UPLOADED_SEQUENCE_PATH` stores the acknowledged cursor.
