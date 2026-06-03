# Data Model Draft

Canonical DB: PostgreSQL.

## Core Tables

### locations

- id
- name
- address
- supermarket_brand
- timezone
- contact_name
- contact_phone
- created_at
- updated_at

### kiosks

- id
- location_id
- name
- serial_number
- status: online/offline/error/maintenance
- current_version
- last_seen_at
- last_ip
- tailnet_ip
- screen_resolution
- os_version
- notes
- created_at
- updated_at

### campaigns

- id
- name
- brand_name
- active_from
- active_until
- default_language
- status: draft/active/paused/archived
- rules_json
- created_at
- updated_at

### campaign_assets

- id
- campaign_id
- type: logo/image/video/audio/font/config
- label
- url
- checksum
- metadata_json
- created_at

### prizes

- id
- campaign_id
- name
- description
- probability_weight
- daily_limit
- total_limit
- inventory_remaining
- ticket_template_id
- active
- created_at
- updated_at

### sessions

- id
- kiosk_id
- campaign_id
- started_at
- completed_at
- status: started/completed/timeout/cancelled/error
- coin_event_id
- selected_prize_id
- question_id
- answer_id
- result_json

### events

Append-only audit log.

- id
- kiosk_id
- session_id nullable
- campaign_id nullable
- type
- payload_json
- occurred_at
- received_at
- synced_from_local_id nullable

Event types:

- session_started
- coin_inserted
- spin_started
- wheel_result_selected
- question_shown
- answer_selected
- prize_won
- ticket_print_requested
- ticket_print_success
- ticket_print_failed
- session_timeout
- admin_reboot_requested
- deployment_started
- deployment_succeeded
- deployment_failed
- deployment_rolled_back

### questions

- id
- campaign_id
- prompt
- language
- options_json
- correct_answer_key nullable
- active
- created_at
- updated_at

### tickets

- id
- kiosk_id
- session_id
- prize_id
- ticket_code
- barcode_payload
- print_status: pending/printed/failed/cancelled
- printed_at
- printer_response_json
- created_at

### device_commands

- id
- kiosk_id
- command_type: restart_browser/restart_backend/reboot/deploy/rollback/upload_logs/test_print/maintenance_mode
- payload_json
- status: pending/sent/running/succeeded/failed/expired/cancelled
- requested_by_admin_id
- requested_at
- sent_at
- completed_at
- result_json

### deployments

- id
- version
- ui_image
- backend_image
- agent_image
- release_channel: dev/staging/production
- status
- changelog
- created_at

### admins

- id
- email
- name
- role: viewer/operator/admin/superadmin
- active
- created_at
- updated_at

## Analytics Questions To Answer

- How many plays per kiosk per day?
- How many coins inserted vs completed sessions?
- Which questions have highest error/drop-off?
- Which prizes are being printed most?
- Which kiosks have printer failures?
- Which campaign/location has the best conversion?
- Are there suspicious repeated wins or duplicate ticket prints?
