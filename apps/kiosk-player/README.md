# Kiosk Player

Vertical fullscreen kiosk player shell for campaign-driven retail activations.

Current foundation:

- Svelte + Vite appliance-style shell
- 1080x1920-oriented layout
- Local runtime state subscription over API/WebSocket
- Sandboxed campaign package iframe
- Parent-owned package bridge for controlled telemetry and ticket/print requests
- HQ debug controls only when `VITE_KIOSK_PLAYER_HQ_DEBUG_CONTROLS=true`

The current Chocomel content is prototype/reference only until brand asset rights are confirmed. Game rendering should live inside campaign modules, preferably PixiJS + GSAP + Howler for premium wheel interactions.
