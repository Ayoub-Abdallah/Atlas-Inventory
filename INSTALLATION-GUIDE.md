# Atlas Inventory - Windows Installation Guide

**Complete guide for installing Atlas Inventory on Windows from scratch**

---

## 📋 System Requirements

- **Operating System**: Windows 10/11 (64-bit)
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: 500MB for application + dependencies
- **Network**: Internet connection for initial download (app works offline after setup)

---

## 🔧 Step 1: Install Prerequisites

### 1.1 Install Node.js

1. **Download Node.js** (LTS version):
   - Go to: https://nodejs.org/
   - Download **"LTS (Long Term Support)"** version (20.x or 22.x)
   - File: `node-vXX.X.X-x64.msi`

2. **Run the installer**:
   - Double-click the downloaded `.msi` file
   - Click **"Next"** through the wizard
   - Accept license agreement
   - Keep default installation path: `C:\Program Files\nodejs`
   - ✅ Check **"Automatically install necessary tools"**
   - Click **"Install"**
   - Wait for completion (may take 5-10 minutes)

3. **Verify installation**:
   - Press `Windows + R`
   - Type `cmd` and press Enter
   - In the command prompt, type:
     ```cmd
     node --version
     npm --version
     ```
   - You should see version numbers (e.g., `v20.11.0` and `10.2.4`)

---

## 📦 Step 2: Download Atlas Inventory

### Option A: Download from GitHub (Recommended)

1. **Download the application**:
   - Go to: https://github.com/Ayoub-Abdallah/Atlas-Inventory
   - Click the green **"Code"** button
   - Click **"Download ZIP"**
   - Save to: `C:\Atlas-Inventory-main.zip`

2. **Extract the files**:
   - Right-click `Atlas-Inventory-main.zip`
   - Select **"Extract All..."**
   - Extract to: `C:\Atlas-Inventory\`
   - ✅ The folder structure should be:
     ```
     C:\Atlas-Inventory\
     ├── app\
     ├── server\
     ├── package.json
     ├── nuxt.config.ts
     └── ...
     ```

### Option B: Use Git (For advanced users)

```cmd
cd C:\
git clone https://github.com/Ayoub-Abdallah/Atlas-Inventory.git
```

---

## ⚙️ Step 3: Install Application Dependencies

1. **Open Command Prompt as Administrator**:
   - Press `Windows + X`
   - Select **"Terminal (Admin)"** or **"Command Prompt (Admin)"**

2. **Navigate to application folder**:
   ```cmd
   cd C:\Atlas-Inventory
   ```

3. **Install dependencies** (this will take 5-10 minutes):
   ```cmd
   npm install
   ```

   You'll see output like:
   ```
   added 1426 packages in 5m
   ```

4. **Initialize the database**:
   ```cmd
   node init-db.mjs
   ```

   You should see:
   ```
   ✓ Database initialized successfully
   ✓ Created 13 tables
   ```

---

## 🚀 Step 4: First Run

1. **Start the application** (still in Command Prompt):
   ```cmd
   npm run dev -- --host
   ```

2. **Wait for startup** (30-60 seconds). You'll see:
   ```
   ℹ Using local storage from .data/hub
   ✔ Database migrations up to date
   ➜ Local:    http://localhost:3000/
   ➜ Network:  http://192.168.1.X:3000/
   ```

3. **Open the application**:
   - Open your web browser (Chrome, Edge, or Firefox)
   - Go to: **http://localhost:3000**

4. **Create your admin account**:
   - You'll see the setup page
   - Fill in:
     - **Full Name**: Your name
     - **Email**: admin@yourcompany.com
     - **Password**: At least 8 characters
     - **Confirm Password**: Same password
   - Click **"Create Admin Account"**

5. **You're ready!** 🎉
   - You'll be logged in automatically
   - Your data is stored locally in: `C:\Atlas-Inventory\.data\`

---

## 🔄 Step 5: Auto-Start on Windows Boot

### Method 1: Task Scheduler (Recommended - Runs in background)

1. **Create a startup script**:
   - Open Notepad
   - Paste this content:
     ```batch
     @echo off
     cd /d C:\Atlas-Inventory
     start /min cmd /c "npm run dev -- --host"
     ```
   - Save as: `C:\Atlas-Inventory\start-atlas.bat`

2. **Open Task Scheduler**:
   - Press `Windows + R`
   - Type: `taskschd.msc`
   - Press Enter

3. **Create a new task**:
   - Click **"Create Task..."** (not "Create Basic Task")
   - **General tab**:
     - Name: `Atlas Inventory Auto-Start`
     - ✅ Check **"Run whether user is logged on or not"**
     - ✅ Check **"Run with highest privileges"**
     - Configure for: **Windows 10/11**

4. **Triggers tab**:
   - Click **"New..."**
   - Begin the task: **"At startup"**
   - Delay task for: **30 seconds**
   - Click **"OK"**

5. **Actions tab**:
   - Click **"New..."**
   - Action: **"Start a program"**
   - Program/script: `C:\Atlas-Inventory\start-atlas.bat`
   - Click **"OK"**

6. **Conditions tab**:
   - ❌ Uncheck **"Start the task only if the computer is on AC power"**
   - ❌ Uncheck **"Stop if the computer switches to battery power"**

7. **Settings tab**:
   - ✅ Check **"Allow task to be run on demand"**
   - ✅ Check **"If the task fails, restart every: 1 minute"**
   - Click **"OK"**

8. **Test the task**:
   - Right-click your new task
   - Select **"Run"**
   - Wait 30 seconds
   - Open browser to http://localhost:3000
   - ✅ Atlas Inventory should load

### Method 2: Startup Folder (Simpler - Shows window)

1. **Create a startup shortcut**:
   - Press `Windows + R`
   - Type: `shell:startup`
   - Press Enter (opens Startup folder)

2. **Create shortcut**:
   - Right-click in the folder
   - Select **"New" → "Shortcut"**
   - Location: `C:\Atlas-Inventory\start-atlas.bat`
   - Name: `Atlas Inventory`
   - Click **"Finish"**

3. **Test**:
   - Restart your computer
   - Atlas Inventory should start automatically after login

---

## 🌐 Step 6: Access from Other Devices (Network Access)

After auto-start is configured:

1. **Find your computer's IP address**:
   - Open Command Prompt
   - Type: `ipconfig`
   - Look for **"IPv4 Address"** under your network adapter
   - Example: `192.168.1.100`

2. **Access from other devices**:
   - On tablets, phones, or other PCs on the **same network**
   - Open browser and go to: `http://192.168.1.100:3000`
   - Use the same login credentials

---

## 🔒 Step 7: Windows Firewall Configuration

If other devices can't connect:

1. **Open Windows Defender Firewall**:
   - Press `Windows + R`
   - Type: `firewall.cpl`
   - Press Enter

2. **Create inbound rule**:
   - Click **"Advanced settings"**
   - Click **"Inbound Rules"** → **"New Rule..."**
   - Rule Type: **"Port"**
   - Protocol: **TCP**
   - Specific local ports: **3000**
   - Action: **"Allow the connection"**
   - Profile: ✅ Check all (Domain, Private, Public)
   - Name: `Atlas Inventory`
   - Click **"Finish"**

---

## 📊 Step 8: Data Backup (Important!)

Your data is stored in: `C:\Atlas-Inventory\.data\`

### Automated Backup Setup:

1. **Create backup script**:
   - Open Notepad
   - Paste:
     ```batch
     @echo off
     set BackupDir=C:\Atlas-Backups
     set Source=C:\Atlas-Inventory\.data
     set Date=%date:~-4,4%%date:~-7,2%%date:~-10,2%
     
     if not exist "%BackupDir%" mkdir "%BackupDir%"
     xcopy "%Source%" "%BackupDir%\atlas-backup-%Date%\" /E /I /Y
     
     echo Backup completed: %Date%
     ```
   - Save as: `C:\Atlas-Inventory\backup-atlas.bat`

2. **Schedule daily backups**:
   - Open Task Scheduler (see Step 5)
   - Create new task: **"Atlas Inventory Daily Backup"**
   - Trigger: **Daily at 11:00 PM**
   - Action: Run `C:\Atlas-Inventory\backup-atlas.bat`

---

## 🛠️ Troubleshooting

### Problem: "npm is not recognized"
- **Solution**: Reinstall Node.js and restart computer

### Problem: Port 3000 already in use
- **Solution**: Kill existing process:
  ```cmd
  netstat -ano | findstr :3000
  taskkill /PID [process_id] /F
  ```

### Problem: Browser shows "Cannot connect"
- **Solution**: 
  1. Check if server is running (look for Command Prompt window)
  2. Check firewall settings (Step 7)
  3. Restart the application

### Problem: Database errors
- **Solution**: Re-initialize database:
  ```cmd
  cd C:\Atlas-Inventory
  node init-db.mjs
  ```

---

## 📞 Support Checklist

Before asking for help, verify:

- ✅ Node.js version is 18 or higher
- ✅ All dependencies installed (`npm install` completed)
- ✅ Database initialized (`init-db.mjs` ran successfully)
- ✅ Firewall allows port 3000
- ✅ No other application using port 3000

---

## 🎓 Quick Command Reference

| Task | Command |
|------|---------|
| Start application | `npm run dev -- --host` |
| Stop application | Press `Ctrl + C` in Command Prompt |
| Check if running | Open http://localhost:3000 |
| Backup data | `backup-atlas.bat` |
| Re-initialize database | `node init-db.mjs` |
| Update application | `npm install` |

---

## 🔐 Security Notes

- Default setup is for **local network only**
- Do NOT expose to internet without proper security
- Change default admin password after first login
- Regular backups recommended (daily)
- Data stored locally in encrypted SQLite database

---

## ✅ Installation Complete!

Your Atlas Inventory system is now:
- ✅ Installed and running
- ✅ Auto-starts on boot
- ✅ Accessible from network devices
- ✅ Backed up automatically

**Next steps**: 
1. Configure settings (language, currency)
2. Add products and categories
3. Start managing inventory!

---

**Version**: 1.0.0  
**Last Updated**: January 10, 2026  
**Support**: https://github.com/Ayoub-Abdallah/Atlas-Inventory/issues
