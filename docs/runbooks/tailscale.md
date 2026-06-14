# Tailscale runbook — remote access for kiosk pilot

Status: scaffold. Tailscale gives tailnet-only access; it is not public exposure and should not expose local runtime to supermarket LAN.

## Install

Use the official package method for the target OS, then verify the source before running remote install scripts when possible.

```bash
curl -fsSL https://tailscale.com/install.sh -o /tmp/tailscale-install.sh
less /tmp/tailscale-install.sh
sudo sh /tmp/tailscale-install.sh
sudo systemctl enable --now tailscaled
```

## Enroll

Use an auth key from the admin console or an interactive login performed by an operator. Do not commit auth keys.

```bash
sudo tailscale up --ssh --hostname "retail-kiosk-hq-001"
tailscale status
tailscale ip -4
```

Recommended ACL boundaries:

- allow operator/admin devices to SSH to kiosk;
- do not expose local runtime HTTP broadly;
- prefer Tailscale SSH or tailnet-only admin endpoints;
- keep central API over HTTPS with device credentials.

## Verification

```bash
tailscale status
tailscale netcheck
systemctl status tailscaled --no-pager
tailscale ping retail-kiosk-hq-001
```

If Tailscale is down, the kiosk customer journey should continue locally if the package and schedule are cached. Remote commands and log upload will be delayed until network access returns.
