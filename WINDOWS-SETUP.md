# Atlas Inventory — Windows Installation & Auto-Start Guide

---

## Step 1: Install Node.js

1. Go to **https://nodejs.org/**
2. Download the **LTS** version (`.msi` file)
3. Run the installer — click **Next** through everything, keep defaults
4. ✅ Check **"Automatically install necessary tools"** when prompted
5. Restart your PC after installation

### Verify

Open **Command Prompt** (`Win + R` → type `cmd` → Enter) and run:

```cmd
node --version
npm --version
```

Both should print a version number. If not, reinstall Node.js.

---

## Step 2: Download Atlas Inventory

### Option A: Download ZIP

1. Go to **https://github.com/Ayoub-Abdallah/Atlas-Inventory**
2. Click the green **Code** button → **Download ZIP**
3. Extract to `C:\Atlas-Inventory\`

### Option B: Git Clone

```cmd
cd C:\
git clone https://github.com/Ayoub-Abdallah/Atlas-Inventory.git
```

Your folder should look like this:

```
C:\Atlas-Inventory\
├── app\
├── server\
├── package.json
├── start-atlas.bat
├── start-atlas-silent.bat
├── install-windows.bat
├── setup-windows.ps1
├── stop-atlas.bat
└── ...
```

---

## Step 3: Install Dependencies

Open **Command Prompt** and run:

```cmd
cd C:\Atlas-Inventory
npm install
```

This will take 5–10 minutes. Wait until it finishes.

---

## Step 4: Initialize the Database

Still in the same command prompt:

```cmd
node init-db.mjs
```

You should see:

```
✓ Database initialized successfully
```

---

## Step 5: First Run (Manual Test)

Start the server to make sure everything works:

```cmd
npm run dev -- --host
```

Wait 30–60 seconds until you see:

```
➜ Local:    http://localhost:3000/
➜ Network:  http://192.168.x.x:3000/
```

Open **http://localhost:3000** in your browser. You should see the setup page.  
Create your admin account, then press `Ctrl + C` in the command prompt to stop the server.

---

## Step 6: Register Auto-Start on Boot

This makes the server start **automatically in the background** every time Windows boots — no manual action needed.

### Double-click `install-windows.bat`

That's it. It will:

1. Ask for Administrator permission (click **Yes**)
2. Register a Windows Scheduled Task called **"Atlas Inventory Auto-Start"**
3. The server will start silently 30 seconds after every boot

### Or run manually via PowerShell

If you prefer running it yourself:

1. Right-click **PowerShell** → **Run as Administrator**
2. Run:

```powershell
cd C:\Atlas-Inventory
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup-windows.ps1
```

You should see:

```
[OK] Auto-start registered.
     Task: 'Atlas Inventory Auto-Start'
     Runs: start-atlas-silent.bat (30s after boot)
```

---

## Step 7: Restart & Verify

1. **Restart your PC**
2. Wait ~1 minute after login
3. Open your browser → go to **http://localhost:3000**
4. The app should load without you doing anything ✅

---

## Accessing from Other Devices (Phone, Tablet, Other PCs)

1. On the Windows PC, open Command Prompt and run:

```cmd
ipconfig
```

2. Find your **IPv4 Address** (e.g. `192.168.1.100`)
3. On any device on the same network, open: **http://192.168.1.100:3000**

> If it doesn't connect, you need to allow port 3000 through Windows Firewall — see [Firewall](#firewall-optional) below.

---

## Useful Commands

| Action | How |
|--------|-----|
| **Start server manually** | Double-click `start-atlas.bat` |
| **Stop the server** | Double-click `stop-atlas.bat` |
| **Check if running** | Open http://localhost:3000 in browser |
| **Re-initialize database** | `node init-db.mjs` in Command Prompt |
| **Remove auto-start** | Run `.\setup-windows.ps1 -Uninstall` in Admin PowerShell |

---

## Firewall (Optional)

If other devices on the network can't connect:

1. Press `Win + R` → type `firewall.cpl` → Enter
2. Click **Advanced settings** (left panel)
3. Click **Inbound Rules** → **New Rule...**
4. Choose **Port** → Next
5. **TCP**, Specific port: **3000** → Next
6. **Allow the connection** → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Name: **Atlas Inventory** → Finish

---

## Backup Your Data

All data is stored in:

```
C:\Atlas-Inventory\.data\
```

Copy this folder regularly to a USB drive or another location to keep your data safe.

---

## Troubleshooting

### "npm is not recognized"
→ Reinstall Node.js and restart your PC.

### Port 3000 already in use
→ Double-click `stop-atlas.bat`, then try again.

### Server doesn't auto-start after reboot
→ Open **Task Scheduler** (`Win + R` → `taskschd.msc`) and check that **"Atlas Inventory Auto-Start"** exists and is enabled. If not, run `install-windows.bat` again.

### Database errors
→ Run `node init-db.mjs` again in Command Prompt.
