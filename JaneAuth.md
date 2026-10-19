# Constellation Auth & API Key Inventory (canonical)

**Status:** CANONICAL as of 2026-08-30  
**Maintainer:** Jane  
**Rule:** This file is the single source of truth for *what credentials exist, what they are for, who uses them, and whether they are still active*.  
**Rule:** Do **not** put full secret values here. Use LastPass + on-machine secret files. At most show stable prefixes/suffixes for identification.

If another doc disagrees with this one on key purpose/status/location, **this file wins**. Older docs may still hold useful non-key narrative; see [Stale documents](#stale-documents) at the bottom.

---

## How to read an entry

Each credential block tries to answer:

1. **What is it?**
2. **Why did we get it / what problem did it solve?**
3. **What did it replace (if anything)?**
4. **Who uses it, from where?**
5. **Is it still active?**
6. **Where does the secret live?**
7. **Identify without dumping the secret** (prefix/suffix or label)

---

# 1. AI model providers

## 1.1 OpenRouter — overview

OpenRouter is Jane’s **unified model gateway**. One API surface reaches Claude, Grok, GLM, Gemini, etc. Dee joined during OpenClaw onboarding (2026-02-01) mainly to get multi-model access without maintaining a separate Google/Anthropic/xAI key for every experiment (ai-memory #252).

Through mid-2026 Jane used **one shared OpenRouter key** for everything. That made spend attribution impossible and let one workload drain the whole credit balance (this bit Dee on 2026-08-08 when credits ran out).

On **2026-08-08/09** we split into **three workload keys** plus kept the old key as legacy:

| Label (OpenRouter / LastPass) | Local secret file | Used by | Suffix |
|---|---|---|---|
| openclaw.jane.interactive | `~/.openclaw/secrets/openrouter-jane-interactive` | Jane agent `main` (webchat) | `…f4697bfa` |
| openclaw.jane.telegram | `~/.openclaw/secrets/openrouter-jane-telegram` | Jane agent `telegram` | `…295890b8` |
| openclaw.jane.cron | `~/.openclaw/secrets/openrouter-jane-cron` | Jane agent `cron` | `…b032cb1a` |
| openrouter_api_key / “gemini_api_key” (old name) | `~/.openclaw/secrets/openrouter-jane-legacy` | **Nobody** (retired from live config) | `…1a946b8c` |

OpenClaw cannot put three different OpenRouter keys on one agent by channel. Separation is done with **multi-agent routing**: each agent has its own `agentDir` auth store.

Also still present in config for gateway bootstrap:
- `openclaw.json` → `env.OPENROUTER_API_KEY` = interactive
- `openclaw.json` → `models.providers.openrouter.apiKey` = interactive

---

### OpenRouter key: `openclaw.jane.interactive`

- **What:** OpenRouter API key dedicated to human interactive Jane (Control UI / webchat).
- **Why:** So chat with Dee doesn’t share a credit pool with cron storms or Telegram side traffic; enables per-key limits and spend graphs on OpenRouter.
- **Replaced:** The old single key `…6b8c` for the main/webchat path (cut over 2026-08-08).
- **Who uses it:** OpenClaw agent **`main`** on jane. All house laptops (oregano, juniper, honeysuckle) talking to Jane over webchat share this key — Jane is the API client, not the laptop.
- **Active?** **Yes.** Live in main agent auth store + env/provider config.
- **Where:**  
  - Secret file: `~/.openclaw/secrets/openrouter-jane-interactive`  
  - Agent store: `~/.openclaw/agents/main/agent/openclaw-agent.sqlite` profile `openrouter:default`  
  - Config mirrors: `openclaw.json` env + `models.providers.openrouter`  
  - LastPass: AI keys entry  
- **ID:** ends `f4697bfa`
- **Notes:** Cannot naturally split further by which laptop is on webchat without custom client tagging.

### OpenRouter key: `openclaw.jane.telegram`

- **What:** OpenRouter API key for Jane’s Telegram lane only.
- **Why:** Telegram is a separate channel with its own session family; isolating it stops a chatty Telegram thread (or a bad loop) from zeroing interactive credits.
- **Replaced:** Shared use of legacy `…6b8c` / later interactive for Telegram traffic.
- **Who uses it:** OpenClaw agent **`telegram`**, bound by `bindings: [{ agentId: "telegram", match: { channel: "telegram" } }]`.
- **Active?** **Yes** (wired 2026-08-08 by Dee).
- **Where:**  
  - Secret file: `~/.openclaw/secrets/openrouter-jane-telegram`  
  - Agent store: `~/.openclaw/agents/telegram/agent/openclaw-agent.sqlite`  
  - LastPass  
- **ID:** ends `295890b8`
- **Model note (current):** telegram agent primary `openrouter/x-ai/grok-4.5`, fallback Sonnet 4.6.

### OpenRouter key: `openclaw.jane.cron`

- **What:** OpenRouter API key for scheduled / automation model turns.
- **Why:** Cron jobs (heartbeat, mail check, flights parser, memory reconcile, etc.) were a silent burn risk on the shared key. Separate key + optional monthly limit contains that.
- **Replaced:** Cron `agentTurn` jobs previously ran as agent `main` and spent the interactive/legacy pool.
- **Who uses it:** OpenClaw agent **`cron`**. All **15** `payload_kind=agentTurn` cron jobs were reassigned to `agentId: cron` on 2026-08-09 (8 enabled at the time).
- **Active?** **Yes** (wired 2026-08-09).
- **Where:**  
  - Secret file: `~/.openclaw/secrets/openrouter-jane-cron`  
  - Agent store: `~/.openclaw/agents/cron/agent/openclaw-agent.sqlite`  
  - LastPass  
- **ID:** ends `b032cb1a`
- **Does NOT cover:**  
  - `systemEvent` crons (no model call; stay on main)  
  - pure `command` crons (e.g. Automation Health Check; no model)

### OpenRouter key: legacy (`…6b8c`)

- **What:** Original shared OpenRouter key from Feb 2026 onboarding.
- **Why originally:** One key to rule them all — simple multi-model access (especially Gemini via OR without a Google AI account at first).
- **LastPass names:** has been called `openrouter_api_key` and confusingly **`gemini_api_key`** on OpenRouter’s label side.
- **Replaced by:** interactive + telegram + cron keys (Aug 2026).
- **Who uses it now:** **Nobody** in live OpenClaw config after cutover. Kept on disk for audit/rollback until Dee is satisfied spend is landing on the new keys.
- **Where:** `~/.openclaw/secrets/openrouter-jane-legacy`; historical ai-memory #252; LastPass.
- **ID:** ends `1a946b8c`
- **Action:** After a few clean days of usage on the new keys, disable/delete at OpenRouter and remove local file.

**OpenRouter economics (context, not a key):** catalog token rates ≈ provider list prices; real OR premium is mostly ~5–5.5% credit top-up fee. Dee is fine with that fee (2026-08-08 discussion).

---

## 1.2 Anthropic (direct API)

### Anthropic: `claude_code` (oregano)

- **What:** Anthropic API key used by **Claude Code on oregano**.
- **Why:** So Claude Code bills the **API pool**, not the claude.ai subscription OAuth pool. Oregano was switched from `claude.ai` OAuth to API key (ai-memory #257, ~2026-05-02) after auth conflict; `claude /logout` then API key in shell env.
- **Replaced:** Claude Code subscription/OAuth auth on oregano.
- **Who uses it:** Claude Code (CLI/VS Code) **on oregano**. Not Jane’s normal chat path.
- **Active?** **Yes** (assumed; Jane holds a copy for inventory).
- **Where:**  
  - Live on oregano: historically `ANTHROPIC_API_KEY` in `~/.bashrc` (verify if still that path)  
  - Inventory copy on Jane: `~/.openclaw/secrets/anthropic-claude-code-oregano`  
  - LastPass name: `Claude_code` (cannot rename in Anthropic console)
- **ID:** ends `…hgAA` (Jane secrets copy)
- **Note:** Anthropic console name stays `claude_code` — Dee cannot rename it.

### Anthropic: `claude_code_juniper`

- **What:** Separate Anthropic API key for **Claude Code on juniper**.
- **Why:** Same as oregano isolation, but **per machine**, so juniper coding spend doesn’t share oregano’s key limits/attribution. Created when Dee split Claude Code keys (2026-08-08 key work).
- **Replaced:** Shared use of a single Anthropic key on both laptops (if that was the prior state).
- **Who uses it:** Claude Code on **juniper** only.
- **Active?** **Yes** if juniper Claude Code is configured to it (Dee created it for that purpose).
- **Where:**  
  - Live on juniper: Claude Code / shell config on that box  
  - Inventory copy: `~/.openclaw/secrets/anthropic-claude-code-juniper`  
  - LastPass: `Claude_code_juniper`
- **ID:** ends `…zAAA`

### Anthropic: `Openclaw api key.2` (Jane)

- **What:** Anthropic API key intended for **OpenClaw/Jane direct Anthropic** access (bypass OpenRouter for Claude).
- **Why:** Option for direct Claude when desired (cost path, provider features, OR outage). Historically Jane mostly used Claude **through OpenRouter**, so this key was “available but not the daily driver.”
- **Replaced:** Nothing mandatory; parallel path to OpenRouter Claude routes.
- **Who uses it:** Jane **can** use it via Anthropic auth profiles (`anthropic:default` / `anthropic:anthropic` in main agent store). Day-to-day default models are still **OpenRouter** (GLM/Grok/etc.).
- **Active?** **Present and loaded into main agent Anthropic profiles**; not the primary spend path unless a session selects a direct `anthropic/…` model.
- **Where:**  
  - `~/.openclaw/secrets/anthropic-api-key`  
  - Main agent SQLite auth profiles  
  - LastPass: `Openclaw api key.2`
- **ID:** ends `…OQAA`

---

## 1.3 xAI / Grok (direct)

### xAI API key

- **What:** Direct Grok/xAI API key.
- **Why:** Probably obtained when Dee used Grok more directly / had Super; kept for possible direct use.
- **Replaced:** N/A for Jane — Jane’s Grok traffic goes **OpenRouter → `x-ai/grok-4.5`**, not this key.
- **Who uses it:** **No known active Jane/OpenClaw consumer** as of 2026-08-09. Phone Grok app is a separate **consumer subscription**, not this API key.
- **Active?** **Idle** (secret retained).
- **Where:** `~/.openclaw/secrets/xai-api-key`; LastPass.
- **ID:** ends `…IU7I`

---

## 1.4 OpenAI

### OpenAI API key (full-featured / “GrayGeek” embeddings key)

- **What:** One OpenAI project API key (`sk-proj-…`) with access to embeddings, Whisper, GPT-4o family, TTS, etc.
- **Primary reason we got it:** **tarragon ai-memory** — so the memory.wmbuck.net service can call OpenAI **embeddings** and store vectors in **Postgres pgvector**. That powers **semantic / “fuzzy by meaning” search** (not the same as plain keyword search). When memories are written (and when semantic search runs), tarragon embeds text with OpenAI (`text-embedding-3-small` in our docs) using this key.
- **Secondary / opportunistic use on Jane:** The **same key** is also in Jane’s `~/.openclaw/workspace/.env` as `OPENAI_API_KEY` so some Jane skills can call OpenAI directly. Concrete example Dee cares about: **Whisper transcription of the oral-history audio** — we used this already-held key rather than creating a second OpenAI key.
- **Same secret, two env names (verified 2026-08-09):**  
  - tarragon: `AIMEMORY_OPENAI_API_KEY` in `/home/dee/ai-memory/.env`  
  - Jane: `OPENAI_API_KEY` in `~/.openclaw/workspace/.env`  
  Fingerprints match; one credential, two copies.
- **History note:** Sometimes called the “GrayGeek OpenAI key” because it is the server-side key for the GrayGeek/tarragon memory stack. **Not** for handing to external chatbots; **not** Jane’s normal chat billing (chat is OpenRouter).
- **Who uses it:**  
  - **tarragon `aimemory` service** — **main daily purpose** (embeddings / pgvector)  
  - **Jane** — optional skills (Whisper oral history, etc.) when those tools run
- **Active?** **Yes**, especially on tarragon whenever semantic memory features run.
- **Where:** tarragon ai-memory `.env`; Jane workspace `.env`; LastPass (should be).
- **ID:** `sk-proj-…` length ~164, Jane/tarragon copies identical.
- **Do not confuse with:** memory.wmbuck.net API keys (`m_…`) which authorize *access to the memory HTTP API*; this OpenAI key authorizes *calls to OpenAI*.

---

## 1.5 Google AI Studio (direct Gemini)

### Google AI Studio Key (`GEMINI_API_KEY` env var / AIza…)

- **Human name (LastPass + Jane):** **Google AI Studio Key**
- **What:** Google Cloud / AI Studio API key. Lets Jane call **Google Gemini APIs directly** (not via OpenRouter).
- **Account ownership:** Lives under Dee’s **personal** Google account **`mcdonaldbuck@gmail.com`**. **Not** an HOA / villasboulders.org / Workspace credential. HOA automation uses separate GCP projects and the Workspace service account.
- **GCP project:** **jane-personal** (console display name **“Jane Access”**), created for Jane personal tools. ~$10 prepaid credit May 2026, auto-refill OFF.
- **Why obtained:** Experiment with the **nano-pdf** tool from Jane — natural-language PDF page edits when ordinary PDF tooling wasn’t enough. Key created ~May 2026 for that path.
- **Not to confuse with:** the old OpenRouter key Dee once labeled “gemini api key” (`sk-or-…6b8c`). That was never a Google key; it was OpenRouter, named for day-one intent to reach Gemini through OR.
- **Who uses it:** Jane, when a skill/tool needs direct Gemini (nano-pdf skill still installed under `workspace/skills/nano-pdf`). OpenRouter Gemini model routes do **not** use this key.
- **Active?** Credential is installed and valid. Actual spend only when direct-Gemini tools run.
- **Where:**  
  - Runtime: `~/.openclaw/workspace/.env` → env var **`GEMINI_API_KEY`** (name kept for tools; comments call it Google AI Studio Key)  
  - Secrets copy: `~/.openclaw/secrets/google-ai-studio-key` (renamed 2026-08-09 from `google-ai-studio-key-unknown`)  
  - LastPass: **Google AI Studio Key** (Dee updated blurb 2026-08-09)  
  - GCP project owned by mcdonaldbuck@gmail.com: jane-personal / Jane Access
- **ID:** ends `…hXGs` (full value in LastPass / those files only)
- **Naming history:** Dee originally called it Gemini_API_Key; Jane followed that bad name. Correct human name is now Google AI Studio Key. Env var stays `GEMINI_API_KEY` so nano-pdf/tooling keep working.
- **GCP cleanup (2026-08-09):** Dee removed an **extra leftover unused GCP project** that had been mistakenly created while setting up Jane Access. Jane Access / jane-personal itself remains.

---

# 2. Shared AI memory (memory.wmbuck.net)

Service: FastAPI + Postgres/pgvector on **tarragon**, public HTTPS `https://memory.wmbuck.net` (Apache proxy). Auth: **`X-API-Key` header** or **`?api_key=`** query (ai-memory #87, #88).

### Jane read-write key (`m_FQLj…`)

- **What:** Full-access API key for the shared memory service.
- **Why:** So Jane (and authorized automation) can read/write durable facts across sessions/machines.
- **Who uses it:** Jane OpenClaw plugin `ai-memory`; scripts/crons that POST memories; docs still embed it (should eventually SecretRef).
- **Active?** **Yes.**
- **Where:**  
  - `openclaw.json` → `plugins.entries.ai-memory.config.apiKey`  
  - tarragon `/home/dee/ai-memory/.env` (`AIMEMORY_API_KEY` / related)  
  - Documented (too plainly) in `memory/ai-systems/memory-api-keys.md` and AGENTS.md  
- **Never share** with external chatbots.

### Read-only keys (Claude / Grok / ChatGPT web)

- **What:** `m_ro_…` keys for external AI products to **GET** context only.
- **Why:** Let phone/web AIs ground answers in Dee’s infrastructure facts without write access.
- **Active?** Generated 2026-04-07; use if those assistants are still configured.
- **Where:** `memory/ai-systems/memory-api-keys.md`, LastPass.

### Claude Code read-write key (`m_rw_…`)

- **What:** Full RW key for Claude Code on oregano.
- **Why:** Claude Code on oregano should push/pull the same shared memory Jane uses.
- **Active?** Deployed to oregano `~/.claude/CLAUDE.md` per docs (verify periodically).
- **Where:** memory-api-keys.md; oregano Claude config.

---

# 3. Google accounts & OAuth (personal + HOA)

Narrative of the two Google worlds: **GOOGLE-INFRA.md**.  
Historical HOA inventory (partly stale on Jane’s personal client): ai-memory **#179**.  
**This section is the live OAuth *client* inventory as verified 2026-08-12 on jane + oregano.**

**Security note (2026-08-12):** OAuth **client IDs** (`….apps.googleusercontent.com`) are *public identifiers* — they appear in browser redirects and are safe to list here. The **client secret** (`GOCSPX-…`), refresh tokens, and service-account private keys are the real secrets. Do **not** put those in this file, chat logs, git, or Claude Code transcripts. If a **client secret** (not merely a client id) was exposed, rotate that client in GCP Console and re-auth every token that used it.

## 3.0 Map: which Google identity for what

| Identity | Kind | Used for |
|---|---|---|
| `mcdonaldbuck@gmail.com` | Personal Google user | Owns personal GCP projects; Jane calendar/gmail OAuth; gcloud CLI; gog user auth; clasp login |
| `mcdonaldbuckhoa@gmail.com` | Personal Google user (HOA board mail) | Board mail kept separate; **Gmail API OAuth token still not created** (`google-token-hoa.json` missing) |
| `woodhook4@gmail.com` | Throwaway personal | Low priority; no Jane OAuth token |
| `admin@villasboulders.org` | Workspace admin seat | Impersonation target for HOA service account; Apps Script “execute as me” for PropertyReport |
| `openclaw-automation@villasboulders-automation.iam.gserviceaccount.com` | Service account | Domain-wide delegation → @villasboulders.org only |
| `gam-project-exqi4@gam-project-exqi4.iam.gserviceaccount.com` | Service account | Legacy/on-oregano **GAM** Workspace admin tooling |

## 3.1 GCP projects (under mcdonaldbuck@gmail.com unless noted)

Verified via `gcloud projects list` on **jane** 2026-08-12 where noted:

| Project id | Display name | Number | Role |
|---|---|---|---|
| `jane-access-493515` | Jane Access | `1022183424215` | **Current** personal Jane OAuth client + Google AI Studio / Gemini key home |
| `villasboulders-automation` | (HOA automation) | `527585908490` | HOA SA + PropertyReport web OAuth + early gog desktop client |
| `vab-shared-documents` | (old Drive sync) | `409889727313` | Legacy rclone desktop OAuth only |
| `gam-project-exqi4` | GAM project | `542285250298` | oregano GAM client + SA (Workspace CLI) |
| `api-project-88981675891` | Flightplan | `88981675891` | Dormant Maps-era project (~2012) |
| `gen-lang-client-0379603930` | Default Gemini Project | `180032785902` | AI Studio auto-created; unused |
| *(deleted 2026-08-09)* | accidental leftover from Jane Access setup | — | Removed by Dee |

Older docs said project id `jane-personal`; live id is **`jane-access-493515`** (display name still “Jane Access”).

---

## 3.2 OAuth 2.0 *clients* (the things with client IDs)

### A. Jane personal desktop client — **CURRENT primary**

- **Console name:** (Desktop / installed app under Jane Access; confirm label in GCP if needed)
- **Client ID:** `1022183424215-6mmohkbek9a1qiqj8hqd72oc56gj5uls.apps.googleusercontent.com`
- **GCP project:** `jane-access-493515` / Jane Access (number = client id prefix `1022183424215`)
- **Type:** Installed/desktop (`installed` JSON), redirect `http://localhost` + OOB
- **Why:** Personal Gmail + Calendar for Jane. Workspace SAs **cannot** reach @gmail.com (ai-memory #178, #270).
- **Who uses it:**
  - Jane Python/calendar path via workspace config
  - **gog / gogcli** on Jane (same client id in gogcli credentials)
- **User tokens issued under this client:**
  - `mcdonaldbuck@gmail.com` — **active**
  - `mcdonaldbuckhoa@gmail.com` — **not yet**
- **Active?** **Yes — this is the live personal client as of 2026-08-12.**
- **Where (jane):**
  - Client JSON: `~/.openclaw/workspace/config/google-oauth.json`
  - User token: `~/.openclaw/workspace/config/google-token.json`
  - gogcli client copy: `~/.config/gogcli/credentials.json` (same client id)
  - gogcli encrypted user tokens: `~/.config/gogcli/keyring/token:…mcdonaldbuck@gmail.com`
  - gogcli env: `~/.config/gogcli/keyring.env` (`GOG_ACCOUNT=mcdonaldbuck@gmail.com`; keyring password is a host secret — not repeated here)
- **Token scopes (google-token.json):** `calendar.readonly`, `gmail.readonly`
- **Missing sibling:** `config/google-token-hoa.json` for mcdonaldbuckhoa — still absent 2026-08-12
- **Supersedes:** The April 2026 “Jane personal” client that was mistakenly created **inside** `villasboulders-automation` (client **B** below). ai-memory **#179 item 5 is stale** on this point.

### B. Early gog desktop client (HOA project) — **legacy / likely idle**

- **Client ID:** `527585908490-ktn62mneol07kbbdmfknum18jpn9v7u7.apps.googleusercontent.com`
- **GCP project:** `villasboulders-automation` (number `527585908490`)
- **Type:** Installed/desktop
- **Why originally:** First gog OAuth attempt ~2026-04-15 before Jane Access existed (ai-memory #178/#179 called this “Jane Personal OAuth Client”).
- **Who uses it now:** **No confirmed live consumer.** File still on disk for gog v1 path.
- **Active?** **Probably idle.** Prefer client **A** for all new personal auth.
- **Where (jane):** `~/.config/gog/client_secret.json`
- **Action:** Confirm unused in GCP, then delete client + local file to reduce confusion/exposure surface. **Do not use for HOA automation.**

### C. PropertyReport “Villasboulders Website” — **HOA web sign-in**

- **Console name:** `Villasboulders Website`
- **Client ID:** `527585908490-r4vvrctanip4lv39v7bgj9m28ksom342.apps.googleusercontent.com`
- **GCP project:** `villasboulders-automation`
- **Type:** Web application
- **Why:** Homeowner (and board) Google sign-in for PropertyReport Apps Script web app — server-side redirect OAuth, not GIS.js (ai-memory #265, #179).
- **Who uses it:** **Apps Script only** (`PropertyReport/WebAppController.js`). Not Jane chat, not Python scrapers, not gog.
- **Active?** **Yes. Production. Do not touch** without deliberate HOA web-app change.
- **Redirect URIs (both required):**
  1. `https://script.google.com/macros/s/AKfycbx62bPhhAZFwdpQclnb8EuZF92EK5ksXxVosc7xvW6GgbFs3MfJX8x4VKLqP3Csf9JV/exec`
  2. `https://script.google.com/a/villasboulders.org/macros/s/AKfycbx62bPhhAZFwdpQclnb8EuZF92EK5ksXxVosc7xvW6GgbFs3MfJX8x4VKLqP3Csf9JV/exec`
- **Where copies live (oregano, reference downloads — not runtime secrets stores):**
  - `oregano:/home/dee/Downloads/client_secret_2_527585908490-r4vvr….json`
  - `oregano:/home/dee/Documents/Villas at the Boulders/Website/client_secret_527585908490-r4vvr….json`
- **Script / deploy refs:** Script ID `15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz`; execute as `admin@villasboulders.org`.

### D. clasp desktop client — **Apps Script CLI**

- **Client ID:** `1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com`
- **Type:** Authorized-user desktop flow (clasp’s stored login)
- **Why:** `clasp` push/pull of HOA Apps Script projects from a dev machine.
- **Who:** Dee on **oregano** (not present on jane as of 2026-08-12).
- **Active?** **Yes when clasp is used.**
- **Where:** `oregano:/home/dee/.clasprc.json` (`tokens.default` holds client id + refresh token)
- **User:** historically mcdonaldbuck@gmail.com (clasp login identity).

### E. Legacy rclone desktop client — **dormant**

- **Client ID:** `409889727313-ff4mahu2m0paplpe9ldcd6603dvssro2.apps.googleusercontent.com`
- **GCP project:** `vab-shared-documents` (number `409889727313`)
- **Why originally:** oregano→Workspace Drive sync via rclone (~2019–2024). Symlink duplication disaster; rclone decommissioned (ai-memory #180).
- **Who uses it:** **Nobody** in current tooling.
- **Active?** **Dormant / retire-able.**
- **Where:** `oregano:/home/dee/client_secret_409889727313-ff4mahu2m0paplpe9ldcd6603dvssro2.apps.googleusercontent.com.json`

### F. GAM (Google Apps Manager) client + SA — **oregano admin tooling**

- **OAuth client ID:** `542285250298-ao08iclgongcbfe94bquog7seols7a8h.apps.googleusercontent.com`
- **GCP project:** `gam-project-exqi4` (number `542285250298`)
- **Service account:** `gam-project-exqi4@gam-project-exqi4.iam.gserviceaccount.com` (numeric client_id `116055468419497647432`)
- **Why:** Classic GAM path for Workspace admin (users/groups) separate from openclaw-automation Python SA.
- **Who:** oregano `~/.gam/` when GAM is invoked.
- **Active?** **Present on disk**; treat as HOA admin tooling, not Jane daily path. Confirm before deleting.
- **Where (oregano):**
  - `~/.gam/client_secrets.json`
  - `~/.gam/oauth2service.json`

### G. gcloud CLI built-in client — **not ours**

- **Client ID:** `32555940559.apps.googleusercontent.com`
- **What:** Google’s **stock** OAuth client baked into the gcloud SDK (same id worldwide). Not a Dee-created credential.
- **Who:** `gcloud` on Jane, logged in as `mcdonaldbuck@gmail.com`.
- **Active?** Yes for GCP CLI.
- **Where:** `jane:~/.config/gcloud/credentials.db` (account row for mcdonaldbuck@gmail.com).
- **Do not** rotate or expect this id in *our* GCP “Credentials” pages as a user-owned client.

### H. Apps Script auto-generated OAuth clients

- **What:** Google-created clients when an Apps Script project authorizes scopes / runs as a user.
- **Why:** Platform plumbing for script execution and some editor flows.
- **Active?** Managed by Google. **Do not delete** from GCP “OAuth 2.0 Client IDs” if labeled as Apps Script / default script clients unless you know the script is dead.

---

## 3.3 Non-OAuth Google credentials (related, already detailed elsewhere)

### HOA service account `openclaw-automation@…`

- **What:** Domain-wide delegation SA for **@villasboulders.org only**.
- **Numeric client_id:** `115753241775007656597` (SA id, not an `….apps.googleusercontent.com` OAuth client).
- **GCP project:** `villasboulders-automation`
- **Why:** Server-to-server HOA automation (Drive, Sheets, Gmail as admin@, Admin SDK groups/users, calendar, etc.) without human OAuth every run.
- **Who:** Python HOA tools on oregano (keystone-scraper, drive tools, monitors, …); copy on Jane for tooling that runs there.
- **Active?** **Yes.**
- **Where:**
  - jane: `~/.config/openclaw/google-service-account.json`
  - oregano: `~/.config/openclaw/google-service-account.json`
  - gogcli leftover SA copy on jane: `~/.config/gogcli/sa-….json.bak-hoa` (backup naming; same SA)
- **Do not use** for personal Gmail/Calendar of @gmail.com users — Google blocks that.
- **Delegated scopes (from #179; re-verify in Workspace Admin if changing):** drive, spreadsheets, gmail.send, gmail.readonly, calendar, admin.directory.group, admin.directory.user.readonly, groups.

### Google AI Studio API key

- Not OAuth. See **§1.5**. Lives under Jane Access / mcdonaldbuck; env `GEMINI_API_KEY`.

---

## 3.4 Quick “if X broke, which credential?”

| Symptom | Check first |
|---|---|
| Jane can’t read personal Calendar/Gmail | Client **A** + `config/google-token.json` refresh |
| `gog` personal account errors | gogcli keyring + client **A**; ignore client **B** unless still referenced |
| PropertyReport homeowner login redirect_uri mismatch | Client **C** redirect URI list (both script.google.com shapes) |
| clasp push auth failure | oregano `~/.clasprc.json` / client **D** |
| HOA Python scraper / admin@ Gmail API | Service account **§3.3**, not any user OAuth client |
| gcloud project commands | Stock client **G** + mcdonaldbuck login |
| GAM commands on oregano | Client/SA **F** |
| nano-pdf / direct Gemini | AI Studio key §1.5, not OAuth |

## 3.5 gcloud CLI (Jane) — account status

- **What:** gcloud user login as **mcdonaldbuck@gmail.com** (personal).
- **Why:** Operate personal GCP (Jane Access, APIs, project admin).
- **Active?** Yes (installed May 17 2026; still credentialed 2026-08-12).
- **Where:** `jane:~/.config/gcloud/`
- **2026-08-09:** Dee deleted mistaken leftover unused GCP project from Jane Access setup.

---

# 4. AWS IAM

Account `278396018036` (ai-memory #225/#226). Full secret values: LastPass / host files — not here.

| IAM user | Why it exists | Who/where | Active? | ID hint |
|---|---|---|---|---|
| **dee** | Break-glass Administrator | LastPass only; never on servers | Yes (emergency) | `AKIAUB…6T45` |
| **system** | Workhorse: EC2/S3/Glacier/Route53/backup | `/root/.aws` on oregano, cinnamon, rosemary, tarragon | Yes daily | `AKIAUB…UEW4` |
| **gateway** | Route53 + limited S3/Glacier on gateways | pumpkin, nutmeg, remote gateways | Yellow — cleanup of old copies was pending historically | `AKIAUB…YF7T` |
| **tarragon** | SES send for postfix mail | tarragon `/etc/postfix/sasl_passwds` | Yes daily | `AKIAUB…NTIA` |
| **jane** | Originally created **only** so Jane could call **Amazon Bedrock embeddings**; **upgraded 2026-06-27 to AdministratorAccess** so Jane can also do Route53/AWS admin without pasting other users’ keys | Jane `~/.aws/credentials` profile `default` | Yes | `AKIAUB…XJCK` |

**S3 backup buckets** (via **system** IAM, not jane): net.wmbuck.oregano / cinnamon / nutmeg, etc.

### Amazon Bedrock — what it is and how *we* use it

**What Bedrock is (plain language):**  
AWS’s managed API for running foundation models **inside AWS**. You don’t install the model; you call AWS, and AWS runs e.g. Amazon Titan, and some third-party models, on their side. Billing is AWS usage, authenticated with normal IAM keys.

**What we use it for (narrow):**  
**Not** for Jane’s normal chat replies (those go OpenRouter / optional direct Anthropic).  
**Not** for memory.wmbuck.net on tarragon (that semantic search uses the **OpenAI** embeddings key above).

Bedrock here is wired for OpenClaw’s **local** tool traditionally called something like **`memory_search`**: semantic / fuzzy search over Jane’s **local workspace memory files** (MEMORY.md and related OpenClaw memory index on jane), by turning text into vectors with an embedding model and comparing them.

**Model configured:** `amazon.titan-embed-text-v2:0`  
**Provider setting:** `agents.defaults.memorySearch.provider = "bedrock"`

**How auth works:**  
1. Jane process uses AWS credentials from `~/.aws/credentials` (IAM user **`jane`**, key id `AKIAUB…XJCK`).  
2. Verified 2026-08-09: `aws sts get-caller-identity` on Jane → `arn:aws:iam::278396018036:user/jane`.  
3. OpenClaw (with amazon-bedrock plugin enabled) would call Bedrock `InvokeModel` on the Titan embed model to embed query/document text.  
4. Those vectors live in OpenClaw’s **local** memory index DB on Jane (agent sqlite / memory index tables) — again, separate from tarragon pgvector.

**History:**  
- 2026-04-26: IAM user `jane` created with tight policy BedrockTitanEmbeddings only; embeddings path brought up (ai-memory #238).  
- Docs later sometimes said broken (“Unknown memory embedding provider: bedrock”) during plugin/config churn.  
- 2026-06-27: same IAM user got **AdministratorAccess** so Jane could do broader AWS (Route53 etc.); Bedrock is no longer the only reason the key exists, but it remains the original AI reason.

**Current status (2026-08-09, live config):**  
- Plugin `amazon-bedrock`: **enabled**  
- `memorySearch.provider`: **bedrock**, model Titan embed v2  
- `memorySearch.enabled`: **`false`** ← the feature is **configured but turned off** right now  
So: credentials work; Bedrock path is the designed local fuzzy-memory backend; **we are not actively running that local semantic memory_search until `enabled` is flipped back on and verified.**

**Two “fuzzy memory” systems (easy to conflate):**

| System | Where | Embedding engine | Auth |
|---|---|---|---|
| memory.wmbuck.net semantic search | tarragon Postgres pgvector | **OpenAI** embeddings | `AIMEMORY_OPENAI_API_KEY` |
| OpenClaw local `memory_search` | Jane OpenClaw memory index | **AWS Bedrock Titan** embeddings | IAM user `jane` / `~/.aws/credentials` |

Keyword/full-text search on either side does not need these embedders.

---

# 5. Communications & OpenClaw platform

### Telegram bot token

- **What:** BotFather token for Jane’s Telegram bot.
- **Why:** Primary mobile chat channel to Jane (Dee id 5544853428).
- **Who:** OpenClaw `channels.telegram` on Jane.
- **Active?** Yes.
- **Where:** `openclaw.json` → `channels.telegram.botToken` (+ LastPass recommended).

### IMAP/SMTP (wmbuck.net mail)

- **What:** Mail account passwords for monitoring/sending.
- **Accounts:** dee@ / jane@ wmbuck.net (and related graygeek hosting on tarragon).
- **Where:** Jane `workspace/config/imap-config.json`, `jane-imap.json`, `email-credentials.json`; server-side on tarragon.
- **Active?** Yes (mail check automation).

### Brave Search API

- **What:** API key for Jane `web_search`.
- **Why:** Grounded web search tool.
- **Active?** Yes (plugin enabled).
- **Where:** `openclaw.json` → `plugins.entries.brave.config.webSearch.apiKey`.

### OpenClaw gateway auth token

- **What:** Token clients present to talk to the OpenClaw gateway (Control UI, etc.).
- **Why:** Stop anonymous LAN/WAN control of the agent gateway.
- **History:** Rotated 2026-07-12 (memorable pattern + rateLimit). Mismatch after restart fixed 2026-08-08 by resyncing Control UI (ai-memory #490, #589).
- **Active?** Yes.
- **Where:** `openclaw.json` → `gateway.auth.token`.

### Dashboard password / secret

- **What:** Local dashboard web auth material.
- **Where:** `~/.openclaw/workspace/.env` (`DASHBOARD_PASSWORD`, `DASHBOARD_SECRET_KEY`) and dashboard service env.
- **Active?** Yes if dashboard is served.
- **Note:** `DASHBOARD_SECRET_KEY` value in workspace `.env` still looks like a placeholder string — verify before treating as strong secret.

### SSH key passphrase (house root keys)

- **What:** Passphrase for root SSH keys used in backup/automation unlock flows.
- **Where:** Documented operationally in MEMORY.md; also `SSH_KEY_PASSPHRASE` in workspace `.env`.
- **Active?** Yes for backup unlock automation.
- **Do not scatter in chat logs.**

### Disk unlock passwords (cinnamon/rosemary initramfs)

- **What:** LUKS/dropbear unlock secrets for encrypted servers.
- **Where:** `~/.openclaw/secrets/disk-passwords` (and Dee’s head/LastPass).
- **Active?** Yes when those hosts reboot encrypted.

### mTLS client certs (jane.wmbuck.net / constellation.wmbuck.net)

- **What:** Per-device client certificates (juniper, sesame, ginger, etc.) against wmbuck mTLS CA.
- **Why:** Gate roaming HTTPS admin UIs to known devices.
- **Not API keys** but part of constellation auth. CA/material on oregano; device p12s installed per client.
- **iOS note:** Safari only for client certs.

---

# 6. Things that look like keys but aren’t in this system

| Thing | What it actually is |
|---|---|
| Phone Claude app / ChatGPT app | Vendor **subscriptions**, not these API keys |
| Phone Grok app (free) | Consumer app auth, **not** the xAI API key and **not** OpenRouter |
| OpenRouter credit balance | Account wallet shared by keys under the account; per-key usage still attributable after split |
| Coinbase CDP key | Separate finance tooling on oregano (ai-memory #337); not Jane AI path |

---

# 7. OpenClaw agent ↔ key map (current)

| Agent id | Channel / job | OpenRouter key | Default model idea |
|---|---|---|---|
| `main` | webchat / default | interactive `…7bfa` | defaults: GLM 5.2 → Grok 4.5 |
| `telegram` | Telegram binding | telegram `…90b8` | Grok 4.5 → Sonnet |
| `cron` | cron `agentTurn` jobs | cron `…b032cb1a` | GLM 5.2 → Grok 4.5 |

Anthropic profiles on **main** hold Openclaw api key.2 for direct Anthropic model ids when selected.

---

# 8. Stale documents

**Policy (Dee 2026-08-09):** Do **not** delete these files. They still contain useful non-key narrative.  
**Do:** At the top (and on obsolete key sections), mark that **credential status/purpose/location may be obsolete**, and point here.

| Document | Keep because | Obsolete regarding keys? |
|---|---|---|
| `memory/infrastructure/API-KEY-INVENTORY.md` | First structured inventory (May 17) | **Yes** — single OpenRouter key, Anthropic “not configured”, Gemini “missing”, Bedrock status, etc. |
| `memory/infrastructure/GOOGLE-INFRA.md` | Excellent Google world narrative | Mostly OK; defer key status conflicts to this file |
| `memory/ai-systems/memory-api-keys.md` | Key list for memory service | Still useful; **contains live secrets** (should become reference+LastPass later) |
| `memory/ai-systems/ai-memory-access-guide.md` | How to call the API | Access methods OK; embeds RW key |
| `~/.openclaw/secrets/KEY-INVENTORY.md` | Short label list from Aug import | Superseded as narrative by **this** file; can remain as path index |
| ai-memory #252 etc. | Historical facts | #252 describes only legacy OpenRouter key |

---

# 9. Recommended follow-ups

1. Disable OpenRouter **legacy** key after confirmed idle.  
2. ✅ Renamed secrets file to `google-ai-studio-key` (2026-08-09); LastPass human name Google AI Studio Key.  
3. Push a short ai-memory entry pointing at this file + OpenRouter 3-way split.  
4. Refresh LastPass labels to match this document’s names.  
5. Complete or explicitly abandon `google-token-hoa.json`.  
6. Stop embedding full memory API keys in AGENTS.md / guides (SecretRef or “see LastPass / secrets dir”).  
7. Verify `DASHBOARD_SECRET_KEY` isn’t still a placeholder.  
8. Optional: monthly OpenRouter limits per interactive/telegram/cron keys.  
9. ✅ Expanded §3 Google OAuth client inventory (2026-08-12) with live client IDs + uses from jane/oregano.  
10. **If a Google OAuth *client secret* was exposed** (Claude Code / chat / git): rotate that client in GCP, update local JSON copies, re-auth every refresh token for that client. Client *IDs* alone are not secret.  
11. Retire idle client **B** (`…ktn62mne…` in `~/.config/gog/client_secret.json`) after confirming nothing still points at it.  
12. Retire rclone client **E** + `vab-shared-documents` project when convenient.  
13. **(2026-08-30)** Delete stale oregano service account key `f6ca13c7…` from GCP after verifying nothing on oregano reads `~/.config/openclaw/google-service-account.json`.  
14. **(2026-08-30)** Sync fresh service account key to Vercel Preview/Development environments (currently 2 days stale, will reproduce decoder bug).  
15. **(2026-08-30)** Confirm in GCP Console how many active keys exist for `openclaw-automation` SA.  
16. **(2026-08-30)** Audit other HOA Apps Script projects (HOALibrary, LinkMonitor, ARC/LBC/WO RequestForms) for Script Properties containing secrets.

---

*Generated 2026-08-09 by Jane from live Jane config, secrets dir, local infra docs, and ai-memory entries (#87–88, #95, #178–180, #225–226, #238, #252, #257, #270, #274, #377, #490, #589, etc.).*  
*§3 Google OAuth client inventory expanded 2026-08-12 from live files on jane + oregano + gcloud project list + ai-memory #178/#179/#180/#265/#270.*
*§10–11 HOA-Code credentials expanded 2026-08-30 from Claude Code audit agent findings on oregano (`/tmp/AGENT_FINDINGS_FOR_JANE.md`).*

---


# 10. HOA-Code Repo Credentials (GitHub Actions, Vercel, local secrets)

**Audit date:** 2026-08-30  
**Source:** Claude Code audit agent on oregano, integrated into this file by Jane.

## 10.1 GCP Service Account `openclaw-automation` — key locations

The same service account (`openclaw-automation@villasboulders-automation.iam.gserviceaccount.com`) has key material in multiple locations. Only one should be the live key; the others are stale or synced copies.

| Location | Key ID | Date | Status | Notes |
|----------|--------|------|--------|-------|
| oregano `~/.config/openclaw/google-service-account.json` | `f6ca13c7ca81a8d0c647ae5c2369aa409464d55a` | 2026-02-15 | **STALE — deletion candidate** | Per CLAUDE.md, oregano has zero HOA automation dependencies (all moved to GitHub Actions). Verify nothing reads it, then revoke in GCP. |
| GitHub secret `GOOGLE_SERVICE_ACCOUNT_JSON` | (write-only via CLI) | 2026-08-25 | **Active** | Used by all GitHub Actions workflows (keystone-scraper, broadlands-sync, labels-to-groups, work-order-schedule, sync-keystone-status). |
| Vercel env `GOOGLE_SERVICE_ACCOUNT_B64` (Production) | (masked) | 2026-08-30 | **Active — fresh** | Powers hoa-tracker-dashboard `/send` page (Gmail API). Fresh key deployed to fix the corrupted-key incident (see §10.2). |
| Vercel env `GOOGLE_SERVICE_ACCOUNT_B64` (Preview/Dev) | (masked) | 2026-08-28 | **Stale — 2 days behind Production** | Will reproduce the OpenSSL decoder bug on preview deploys. Sync to match Production. |

**Action items:**
- Delete stale oregano key (`f6ca13c7…`) from GCP after verifying nothing on oregano reads it.
- Sync fresh service account key to Vercel Preview/Development environments.
- Cross-check in GCP Console how many active keys exist for `openclaw-automation`.

## 10.2 Corrupted Key Incident (2026-08-26 to 2026-08-30)

**What happened:** The Vercel env var `GOOGLE_SERVICE_ACCOUNT_B64` contained a base64-encoded service account JSON where the `private_key` field had **literal escaped newlines** (`\n` as two-character escape sequences) instead of actual newlines. Google's auth library couldn't decode the PEM key format, throwing `error:1E08010C:DECODER routines::unsupported`.

**Fix:**
- Commits `467cbcd` and `0acdbbc` (2026-08-30): added code to normalize escaped newlines + switched from `google.auth.GoogleAuth` to `google.auth.JWT`.
- Fresh key pushed to Vercel Production.

**Root cause:** Environment-variable encoding issue, not code logic. Vercel's masked `[SENSITIVE]` variable handling made it impossible to diagnose until Dee replaced the key.

## 10.3 GitHub Actions Secrets — `vab-hoa/hoa-code`

| Secret | Last updated | Used by | Purpose |
|--------|---------------|---------|---------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 2026-08-25 | keystone-scraper, broadlands-sync, labels-to-groups, work-order-schedule, sync-keystone-status | GCP service account (see §10.1) |
| `KEYSTONE_USERNAME` | 2026-06-07 | keystone-scraper, broadlands-sync | Keystone portal login |
| `KEYSTONE_PASSWORD` | 2026-06-07 | keystone-scraper, broadlands-sync | Keystone portal password |
| `SUPABASE_URL` | 2026-08-25 | sync-keystone-status | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 2026-08-25 | sync-keystone-status | Supabase full-access API key |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were both refreshed 2026-08-25 23:25 — same window as `GOOGLE_SERVICE_ACCOUNT_JSON`, likely a single refresh pass.

## 10.4 Vercel Environment Variables — hoa-tracker-dashboard

| Variable | Environments | Last touched | Status |
|----------|-------------|---------------|--------|
| `GOOGLE_SERVICE_ACCOUNT_B64` | Production | 2026-08-30 | Fresh/current |
| `GOOGLE_SERVICE_ACCOUNT_B64` | Preview | 2026-08-28 | **Stale — sync to match Production** |
| `GOOGLE_SERVICE_ACCOUNT_B64` | Development | 2026-08-28 | **Stale — sync to match Production** |
| `NEXT_PUBLIC_SUPABASE_URL` | All | 2026-08-25 | Current |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | 2026-08-25 | Current |

## 10.5 Local oregano secret files (hoa-tracker)

Located in `~/hoa-code/hoa-tracker/secrets/` (gitignored). Moved from `/tmp/` to persistent storage in commit `4506f47` (2026-08-26) so they survive reboots.

| File | Created | Purpose | Status |
|------|---------|---------|--------|
| `.gmail_pw_mcdonaldbuckhoa` | 2026-08-26 | Gmail app password for `mcdonaldbuckhoa@gmail.com` | Active (used by `email_processor.py`) |
| `.supabase_db_password` | 2026-08-26 | Supabase DB password | Active (used by `email_processor.py`) |

**Tech debt note:** These are plaintext files. Migrate to SecretRefs per the tech-debt plan in MEMORY.md.

## 10.6 Apps Script Script Properties — PropertyReport

- **Script ID:** `15Ey8ZSROvVPF2sYXhnLfypi2ppl3C8F5W3icGbofezWMM_iOq9dVdahz`
- **Secret property:** `OAUTH_CLIENT_SECRET` — moved from hardcoded source into Script Properties during the 2026-08-12 OAuth incident remediation.
- **Full incident writeup:** `OAUTH_INCIDENT_REMEDIATION.md` in the repo.

Other HOA Apps Script projects (HOALibrary, LinkMonitor, ARC/LBC/WO RequestForms) were not checked for Script Properties secrets — no evidence of any, but not independently verified.

---


# 11. HOA-Code Key Dependency Graph

```
openclaw-automation SA (villasboulders-automation project)
├── oregano ~/.config/openclaw/google-service-account.json  [STALE, Feb 2026 — revoke]
├── GitHub GOOGLE_SERVICE_ACCOUNT_JSON  [active, Aug 2026]
│   ├── keystone-scraper.yml
│   ├── broadlands-sync.yml
│   ├── labels-to-groups.yml
│   ├── work-order-schedule.yml
│   └── sync-keystone-status.yml
└── Vercel GOOGLE_SERVICE_ACCOUNT_B64  [active, Aug 2026 — fresh on Production]
    └── hoa-tracker-dashboard /send page (Gmail API)

PropertyReport OAuth client (527585908490, villasboulders-automation)
└── Apps Script Script Property OAUTH_CLIENT_SECRET

Keystone portal credentials (GitHub secrets)
└── keystone-scraper / broadlands-sync workflows

Supabase credentials (GitHub secrets + Vercel env vars)
└── sync-keystone-status + hoa-tracker-dashboard

Local oregano email secrets (hoa-tracker/secrets/)
└── email_processor.py
    ├── .gmail_pw_mcdonaldbuckhoa  (Gmail app password)
    └── .supabase_db_password
```
