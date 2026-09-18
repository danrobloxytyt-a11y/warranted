# Warranted Bot

Discord bot for `/warranted`. Covers: moderation (Enforcement), leveling tied to your rank ladder
(Rank Progression), reaction roles (Clearance), and welcome/goodbye/autorole (Intake).

This is the MVP layer from the build order we planned: skeleton, moderation, intake, clearance,
leveling. Tickets, full logging config, starboard, music, and social integrations are follow-up phases.

---

## 1. Create the bot application

1. Go to https://discord.com/developers/applications, click **New Application**.
2. Under **Bot**, click **Reset Token** and copy it. This is your `DISCORD_TOKEN`. Keep it secret,
   never commit it or paste it in chat.
3. On the same Bot page, scroll to **Privileged Gateway Intents** and enable:
   - **Server Members Intent**
   - **Message Content Intent**
4. Under **OAuth2 → URL Generator**, check `bot` and `applications.commands` scopes, then under Bot
   Permissions check: Administrator (simplest for now — you can lock this down later) or at minimum
   Ban Members, Kick Members, Moderate Members, Manage Roles, Manage Channels, Manage Messages, Read
   Message History, Send Messages, Add Reactions.
5. Copy the generated URL, open it in a browser, and add the bot to your server.
6. Copy your **Application ID** (General Information page) — that's `CLIENT_ID`.
7. Enable Developer Mode in Discord (User Settings → Advanced), right-click your server icon, Copy
   Server ID — that's `GUILD_ID`.

---

## 2. Raspberry Pi 5 setup

SSH into your Pi, then:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS (via NodeSource, works cleanly on Pi's ARM64)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential python3

# build-essential + python3 are needed because better-sqlite3 compiles a native
# module on install — this is normal and only happens once.
```

Verify:
```bash
node --version   # should show v20.x
npm --version
```

---

## 3. Get the bot onto the Pi

Copy the `warranted-bot` folder over. Easiest ways:

**Option A — SCP from your computer:**
```bash
scp -r warranted-bot pi@<your-pi-ip>:/home/pi/
```

**Option B — if you push this to a private GitHub repo:**
```bash
git clone <your-repo-url> warranted-bot
```

Then on the Pi:
```bash
cd warranted-bot
npm install
cp .env.example .env
nano .env   # paste in DISCORD_TOKEN, CLIENT_ID, GUILD_ID, save with Ctrl+O, exit with Ctrl+X
```

---

## 4. Deploy commands and test run

```bash
npm run deploy   # registers all slash commands to your server (instant, guild-scoped)
npm start        # starts the bot
```

You should see `[WARRANTED] Logged in as YourBotName#0000` in the terminal. Try `/ping` in Discord.
Ctrl+C stops it — that's expected, we'll make it run permanently next.

---

## 5. Run it permanently with systemd (auto-starts on boot, restarts on crash)

Create a service file:
```bash
sudo nano /etc/systemd/system/warranted-bot.service
```

Paste this in (adjust the path if your username or folder differs):
```ini
[Unit]
Description=Warranted Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/warranted-bot
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Save and exit, then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable warranted-bot
sudo systemctl start warranted-bot
```

Check it's running:
```bash
sudo systemctl status warranted-bot
```

View live logs any time:
```bash
journalctl -u warranted-bot -f
```

Now the bot survives reboots, power blips, and crashes on its own — no terminal window needs to stay
open, and you don't need pm2 or anything extra on top.

To update the bot later (after copying new files over): `sudo systemctl restart warranted-bot`

---

## 6. First-time configuration in Discord

Run these once, as an admin, in your server:

```
/intake logchannel channel:#wiretap
/intake welcome channel:#mugshot message:"{user} has entered /warranted. Processing intake."
/intake goodbye channel:#mugshot message:"{user}'s file has been archived."
/intake autorole role:@Unproven

/levelrewards add level:5 role:@Vested
/levelrewards add level:15 role:@Established
/levelrewards add level:30 role:@Endowed
/levelrewards add level:50 role:@Sanctioned
/levelrewards add level:75 role:@Sovereign
/levelrewards add level:100 role:@Devoted
```
(Adjust levels/roles to whatever you finalize.)

For clearance (reaction roles): post your role-selection message manually first, then:
```
/clearance add message_id:<the message's ID> emoji:🔫 role:@SomeRole
```
Get a message ID by right-clicking it (Developer Mode must be on).

---

## Command reference

**Enforcement:** `/ban` `/unban` `/kick` `/timeout` `/warn` `/warnings` `/purge` `/lockdown lock|unlock`
**Rank Progression:** `/rank` `/leaderboard` `/levelrewards add|remove|list` `/xp add|remove|set`
**Clearance:** `/clearance add|remove|list`
**Intake:** `/intake welcome|goodbye|autorole|logchannel`
**Utility:** `/verdict` `/ping` `/help`

---

## Backing up the database

`warranted.db` holds every warning, XP total, level reward binding, ticket record, and config setting.
It runs in WAL mode, which is crash-safe for individual writes, but there's no protection against the
SD card itself getting corrupted — the single most common Pi failure mode. Back it up.

**One-time setup:**
```bash
sudo apt install -y sqlite3
chmod +x scripts/backup-db.sh scripts/restore-db.sh
```

**Run a backup manually any time:**
```bash
./scripts/backup-db.sh
```
Saves a timestamped snapshot to `backups/`, using SQLite's own backup API (safe to run even while the
bot is live and writing). Keeps the last 7 days automatically, deletes anything older.

**Automate it with cron — back up daily at 3am:**
```bash
crontab -e
```
Add this line at the bottom (adjust the path if yours differs):
```
0 3 * * * /home/danielvivolo/warranted-bot/warranted-bot/scripts/backup-db.sh >> /home/danielvivolo/warranted-bot/warranted-bot/backups/backup.log 2>&1
```
Save and exit. Verify it's registered: `crontab -l`

**Restoring from a backup** (stop the bot first):
```bash
sudo systemctl stop warranted-bot
ls backups/                              # see what's available
./scripts/restore-db.sh warranted-20260101-030000.db
sudo systemctl start warranted-bot
```
The script automatically saves your current database before overwriting it, just in case.

Backups never leave the Pi and are gitignored, so nothing sensitive ends up in your public GitHub repo.

## What's not built yet (next phases)

- Tickets (Case Files)
- Starboard (Most Wanted, separate from the leaderboard)
- Auto responders / timed messages (Informants)
- VoiceMaster, music, webhooks
- Giveaways (Bounties), bump reminders
- Spotify / Last.fm / social notification integrations

Say the word whenever you want the next one built.
