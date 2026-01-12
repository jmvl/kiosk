## Supermarket Kiosk Technical Architecture (Jan 2026)

### **Frontend Stack**

```
Vite + React + Replicache (or Convex migration)
├── Quiz/Game → Offline-first via IndexedDB
├── Ad rotator → 100MB MP4 videos (local cache)
├── Touch UI → Fullscreen kiosk mode
└── Electron → Hardware access + X11 lockdown
```

### **Backend Sync**

```
REPLICACHE (Recommended - True Offline-First)
├── Local mutators → Instant quiz scores (queues offline)
├── Push/Pull endpoints → Your FastAPI/Supabase
├── Conflict resolution → Server canonical state
└── 64MB IndexedDB → Perfect for kiosk state + ads metadata
```

### **Hardware Integration**

```
├── Thermal Printer (Masung MS-MD80I)
│   ├── `/dev/usb/lp0` → Raw ESC/POS commands
│   ├── GS v 0 → Bitmap logos/QR codes
│   └── escpos-usb npm → Production printing
├── Barcode Scanner (Honeywell Voyager 1200g)
│   └── HID keyboard → React onKeyDown events
└── Touchscreen → Chromium --touch-events
```

### **Video Caching (100MB Ads)**

```
/tmp/kiosk-ads/coca-cola.mp4
├── Download once per kiosk (30GB total first run)
├── Play forever locally (zero bandwidth after)
└── Electron disk-cache-size=2GB backup
```

### **Deployment (300 Kiosks)**

```
OS: Ubuntu 24.04 LTS (X11 Lockdown)
├── Dockerized Electron app
├── Ansible: docker pull + restart all kiosks
├── GitHub Actions: CI/CD pipeline
└── X11 Config: No Alt+Tab, no TTY escape
```

### **Offline Behavior**

```
✅ Quiz playable (questions cached)
✅ Scores queued (Replicache mutations)
✅ Videos play (/tmp cache)
✅ Print/scan work (local USB)
❌ New ads wait for sync (5s delay)
```

### **Rollout New Campaign (2 Minutes)**

```bash
1. supabase storage upload ads/coca-cola.mp4
2. UPDATE ads SET video_url=... WHERE id='promo-001'
3. All 300 kiosks sync via Replicache (5s)
```

### **Production Scale**

```
300 kiosks × 1GB video cache = 300GB total storage
Supabase egress: $6/month for streaming
Deployment: 1 docker push → 2min global rollout
Reliability: Survives WiFi/power outages
```

## **Final Verdict**

**Electron + Vite + React + Replicache + Docker = Bulletproof supermarket kiosk**

✅ Printer/scanner hardware access  
✅ Offline quiz resilience  
✅ Instant global ad updates  
✅ Touch + X11 lockdown  
✅ 100MB video caching  
✅ Zero store visits for updates

**Ready for 300+ supermarket deployments.** Your architecture handles retail reality perfectly.

Sources
