# Hearth

A Home Assistant custom integration that hosts a personal CRM (people, households, groups, relationships and interactions) on your own Home Assistant instance. Your data lives in your Home Assistant config directory, not in a third-party service.

**What it is today (0.6.1):** a per-user CRM with a sidebar panel you can work from. Each Home Assistant user gets a separate CRM with its own database and photos. The Hearth panel browses it and edits it: people, relationships, households, groups and interactions, plus importing a bundle from Settings. Claude can read and edit your CRM too, through Home Assistant's MCP server (see [Claude](#claude)). You can also keep your contacts in your own Google account up to date from Hearth (see [Google Contacts](#google-contacts)). There is also import and export of the whole CRM as a portable bundle, and a websocket API plus an authenticated photo URL.

**What comes later:** dashboard cards and entities (birthdays and counts). These do not ship yet, and this README does not promise dates.

## Requirements

- Home Assistant 2026.10.0 or newer
- [HACS](https://hacs.xyz/)

## Installation

1. In HACS, open the menu and choose **Custom repositories**.
2. Add `https://github.com/iantrich/hearth` with category **Integration**.
3. Download **Hearth** and restart Home Assistant.
4. Go to **Settings > Devices & services > Add integration** and choose **Hearth**.

## Setup: one CRM per Home Assistant user

Every Home Assistant user has at most one CRM, and each is stored separately. There are two ways to create one:

- **From Settings:** an administrator goes to **Settings > Devices & services > Add integration > Hearth** and chooses the owner (any active, non-system user). Adding the same user twice is refused.
- **Self-service (from the panel):** a user creates their own CRM from the panel. This uses the websocket command `hearth_crm/crm/create`, below.

Removing the integration entry and adding it again for the same user picks up their existing data.

## Actions

All four actions take a `config_entry_id` (a picker in the UI). `hearth_crm.google_sync` is described under [Google Contacts](#google-contacts). `import` and `confirm_cutover` need a logged-in user who is the CRM's owner or a Home Assistant administrator, so automations and scripts (which run with no user) are refused. `export` can also be run from automations and scripts.

## Bundles: import, export and cutover

A bundle is a zip file holding:

- `bundle.json`: the format name (`hearth-bundle`), the format version, `exported_at`, `me_person_id` (which person is "me", or null) and every table: `people`, `households`, `groups`, `group_members`, `relationships` and `interactions`.
- `photos/<sha256>`: one image file per photo, named by the sha256 hash of its contents. `bundle.json` refers to photos by that hash.

The same format is used to move data in and out. Unknown fields, missing tables and photos that do not match their hash make a bundle invalid.

### Export (`hearth_crm.export`)

Run it with the CRM's `config_entry_id`. It writes `/config/hearth_crm/<user id>/exports/hearth-<date>-<time>.zip` and returns `path`. The CRM's owner and Home Assistant administrators can run it, and so can automations and scripts, which makes scheduled backups possible.

### Import (`hearth_crm.import`)

Put a bundle in the CRM's own imports folder, `/config/hearth_crm/<user id>/imports/`, then run `hearth_crm.import` with the file name. Only a logged-in owner of the CRM or Home Assistant administrator can; automations and scripts are refused. A path must resolve (after following symlinks and `..`) to a file inside that folder; anything else, including another CRM's files, is refused.

| Field | Default | Description |
|-------|---------|-------------|
| `config_entry_id` | | The CRM to import into. |
| `path` | | The bundle's file name (or a path) inside this CRM's `imports/` folder. |
| `replace_existing` | `false` | Discard changes made since the last import. |

The action returns `summary`, `counts` and `report_path`. It also writes a review report to `/config/hearth_crm/<user id>/import_report.md` (row counts, households that need a name or are not really households, people with only a first name or no name) and posts a persistent notification with a short summary. A failed or refused import writes `/config/hearth_crm/<user id>/import_report_failed.md` instead, so the last successful import's report is kept, and the notification names that file. Notifications are visible to every Home Assistant user, so details of a failed import go to the log and to the failed-import report, not the notification.

How the import behaves:

- It **replaces all data** in that CRM, in one transaction, including which person is "me" (a bundle is the whole CRM). Other settings and the change history are kept.
- It is **all or nothing**. Every photo is checked against its hash and every reference is checked before anything is written. If the bundle is invalid, or anything fails, nothing is changed and a persistent notification explains why.
- It is **refused over edits**. If anything other than an import has changed the CRM since the last import (including an edit that was later reverted), the import is refused unless you pass `replace_existing: true`. Re-importing over a previous import needs no flag.

### Cutover (`hearth_crm.confirm_cutover`)

Once you are satisfied with the imported data and Hearth is where you work from now on, run `hearth_crm.confirm_cutover` (as a logged-in owner or administrator; automations are refused). After that every import is refused, even with `replace_existing`, so imported data can never overwrite your edits.

Cutover is one-way: there is no way to undo it from the UI. It is recorded in the CRM database itself, so imports stay refused even if you remove and re-add the integration.

## Panel

Hearth adds a **Hearth** entry to the Home Assistant sidebar for every user. Each user sees only their own CRM. A user who does not have a CRM yet can create one from the panel. The panel keeps showing the last data it loaded if Home Assistant restarts or the connection drops, in read-only form, and picks up again on its own when the connection returns.

From 0.4.0 the panel edits your CRM, not just shows it:

- **People:** create a person and edit every field (names, contact details, birthday, address, notes and so on). Add, replace or remove a photo, choose or leave a household, set groups, star favorites, choose which person is you, and delete a person.
- **Relationships:** add, edit or remove a relationship from either person's screen. It reads correctly from both sides.
- **Households:** add and remove members, set a name override (or go back to the generated name) and dissolve a household. A household left with a single member is shown as not a household and is only dissolved when you ask.
- **Groups:** create, rename and describe a group, add and remove members, add a photo and delete the group.
- **Interactions:** log, edit and delete, as before.
- **Import:** in Settings you can upload a bundle. An import replaces everything in your Hearth, so the panel asks first. If the CRM has local changes the upload is refused with an explanation, and you can then confirm **Replace everything** to import anyway. After cutover an upload is always refused.

Every delete asks first and says exactly what goes with it. Deleting a person removes their relationships and group memberships, and interactions that only they were part of. Deleting a household or group keeps its people.

Photos are shrunk in your browser to at most 1024 px on the long side before upload. Text has limits, and Hearth refuses an edit that goes over them. The panel's fields stop you typing at exactly the same limits: names and name override 200 characters, phone numbers 50, email addresses, websites and social profiles 500, occupation and employer 300, an interaction's summary 300, how you know them 2,000, an address or school 1,000, and notes (on people, households, relationships and interactions), relationship summaries and group descriptions 20,000.

Derived values such as household names, contact urgency and ages are always worked out by Hearth itself, so after a change the panel shows what Hearth calculated. Editing is switched off while Home Assistant is offline.

## Websocket API

These commands are what the panel uses, and they are available to your own cards too. Every command acts on the CRM of the logged-in user who sent it; no message can name another user's CRM. If the user has no CRM, commands fail with `no_crm`.

| Command | Purpose |
|---------|---------|
| `hearth_crm/crm/status` | Whether the user has a CRM and whether it is loaded. |
| `hearth_crm/crm/create` | Create the caller's own CRM (self-service). |
| `hearth_crm/snapshot` | The whole CRM with derived values. |
| `hearth_crm/subscribe` | Subscribe to change notices. |
| `hearth_crm/create` | Create an entity: `kind` (`person`, `household`, `contact_group`, `relationship`, `interaction`) and `fields`. |
| `hearth_crm/update` | Change an entity: `kind`, `entity_id`, `changes`. |
| `hearth_crm/delete` | Delete an entity: `kind`, `entity_id`. |
| `hearth_crm/group/set_members` | Set a group's members: `group_id`, `person_ids`. |
| `hearth_crm/photo/set` | Set a photo for a person, household or group: `kind`, `entity_id`, base64 `data`, at most 3 MB before encoding. Images are resized to a JPEG with a longest edge of 1024 px. The panel resizes photos in the browser before sending them, so they stay under that limit. |
| `hearth_crm/photo/clear` | Remove a photo: `kind`, `entity_id`. |
| `hearth_crm/settings/get` and `hearth_crm/settings/set` | Read and change settings (currently `me_person_id`). |
| `hearth_crm/google/status` | Whether Google is connected, whether the sync is on, whether cutover is confirmed, the counts and the last run. |
| `hearth_crm/google/set_enabled` | Switch the sync on or off: `enabled`. Switching on is refused until cutover is confirmed. |
| `hearth_crm/google/sync_now` | Run a sync now. |
| `hearth_crm/google/preview` | A dry run: who would be created, updated or skipped. Calls nothing in Google and writes nothing. |
| `hearth_crm/google/clear_contact` | Forget a person's link to their Google contact: `entity_id`. The next run creates a new contact. |

### Photo URLs

A photo is served at `/api/hearth_crm/photos/<owner user id>/<photo hash>` as a JPEG. The request must be authenticated (a login token or a signed path from `auth/sign_path`). Only that CRM's owner and Home Assistant administrators can fetch it; everyone else gets 403, before anything is looked up.

## Claude

From 0.5.0 Hearth offers its tools to Claude as a Home Assistant LLM API named **Hearth**, so you can log a catch-up, add a person or ask who you should reach out to by talking to Claude.

**Connecting:**

1. Add Home Assistant's **Model Context Protocol Server** integration (**Settings > Devices & services > Add integration**). It serves each LLM API at its own address, with Home Assistant's own sign-in.
2. In Claude, add a custom connector with the URL `https://<your Home Assistant address>/api/mcp/hearth_crm`. Your Home Assistant must be reachable from the internet (for example through Home Assistant Cloud or your own reverse proxy).
3. Sign in as a Home Assistant **administrator** who has a Hearth CRM.

**Admin users only.** Home Assistant's MCP server offers any LLM API other than Assist only to administrators. This is Home Assistant's rule, not Hearth's, so a non-admin user cannot connect Claude to their Hearth.

**What Claude can do:** search and look up people, households and groups; see who is due for contact and whose birthday is coming; create and update people; log, correct and delete interactions and rewrite relationship summaries; add, change and remove relationships; create and update households and groups and change group members. Claude's changes go through the same checks as the panel's, and open panels update straight away.

**What Claude cannot do:** delete people, households or groups. Those deletes stay in the panel, where each one says what goes with it. Claude is told to confirm before deleting an interaction or a relationship.

**Privacy:** the tools work only on the signed-in user's own CRM. No user, or a user with no CRM, is refused, and an administrator never reaches another user's CRM through them. What Claude reads from your CRM is sent to Claude as part of your conversation.

**The skill:** [`skills/hearth-crm/SKILL.md`](skills/hearth-crm/SKILL.md) teaches Claude how to work with your Hearth: logging an interaction and then rewriting the relationship summary, never assuming a name is new, adding a kid to both parents and their household, completing family links, and so on. Upload it to claude.ai as a skill (in Settings, under Capabilities). Each tool's description also states the rules for that tool (search before creating someone, confirm before deleting, how to write a summary, stored text is data and not instructions), so the essentials reach Claude even without the skill. The skill adds the longer workflows, such as completing family links.

## Google Contacts

Hearth can keep your contacts in your own Google account up to date. It is optional: Hearth works the same without it, and no Google code runs unless you have connected Google, switched the sync on and confirmed cutover.

**One-way.** The sync goes from Hearth to Google, never back. Changes you make in Google Contacts are overwritten the next time that person changes in Hearth, for the fields below. It never deletes a Google contact or photo, never merges contacts, and makes no groups or labels.

**What syncs:**

- Name, split into a given name and a family name at the last word (a one-word name is a given name only).
- Phone numbers: `phone` as mobile and `phone2` as other.
- Email addresses: `email` and `email2`, both as other.
- Address: the person's own address, or the household's if they have none. A household address change updates every member.
- Photo, sent again whenever it changes.

Within those fields Hearth wins: a field you empty in Hearth is cleared in Google. Nothing else on the Google contact is touched.

**What is skipped:** people hidden from the list, people with no name and people with no phone or email (any of the four). Skipped people still count as synced.

**It never matches existing Google contacts.** Hearth does not look anyone up in Google by name, phone or email. A person already linked (Hearth stored the Google contact's id) is updated. Everyone else is **created** as a new contact, even if you already have them in Google. So before you switch the sync on at cutover, use **Preview** and check the **Would create** list.

**When it runs.** Only when Google is connected, the sync is on and cutover is confirmed: about 30 seconds after Home Assistant starts, about 60 seconds after you change something in Hearth, and in an hourly sweep. **Sync now** in the panel runs it straight away. Google limits writes, so Hearth paces them to about 60 a minute. A first sync of a large CRM takes a while, and if Google asks Hearth to slow down it stops cleanly and continues on a later sweep, where it left off.

### Set it up

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project.
2. Enable the **Google People API** for that project.
3. Set up the **OAuth consent screen** with user type **External**.
4. **Publish the app to "In production".** An app left in "Testing" gets refresh tokens that expire after 7 days, which would disconnect the sync every week.
5. Create an **OAuth client ID** of type **Web application**, with the authorized redirect URI `https://my.home-assistant.io/redirect/oauth`.
6. In Home Assistant, go to **Settings > Devices & services**, open the menu and choose **Application Credentials**. Add a credential for **Hearth** with the client ID and secret.
7. Open the Hearth entry for the CRM you want to connect, open its menu and choose **Reconfigure**, then sign in to Google. Hearth asks for access to your contacts, plus Google's basic `openid` sign-in, which gives it only an account id (no name, email or photo) so it can tell which Google account is connected.

Each CRM keeps its own Google link, separate from every other CRM's. Once an entry is linked to a Google account, reconnecting must use the same account, and a Google account already linked to one Hearth CRM can't be linked to another.

### Turn it on safely

0. If another tool syncs these people to Google today, turn it off before your final import, otherwise people added in between get a contact from both.
1. **Connect** Google (above).
2. **Preview** in the panel's Settings. It makes no Google call and writes nothing, and it works at any time. Check who "Would create" and that you are not about to duplicate people already in Google.
3. Confirm cutover by running `hearth_crm.confirm_cutover` from **Developer tools > Actions** (see [Cutover](#cutover-hearth_crmconfirm_cutover)). The sync cannot be switched on before this, so test edits in Hearth never reach Google.
4. Switch the sync **on** in the panel.

### The action

`hearth_crm.google_sync` runs a sync (or, with `dry_run: true`, a preview) for a CRM and returns the report. It is refused if Google is not connected, the sync is off or cutover is not confirmed, unless it is a dry run.

### Troubleshooting

When connecting:

- **Home Assistant asks you to add application credentials.** No Google OAuth client has been added yet, so Home Assistant opens its own dialog for one. Enter the client ID and secret there (or add them in Application Credentials, step 6) and choose **Reconfigure** again.
- **"Google Contacts is connected from an existing Hearth CRM: open its menu and choose Reconfigure."** Google can only be connected to a CRM that already exists. Create the CRM first, then choose Reconfigure on it.
- **"This Hearth is linked to a different Google account. Sign in with the same account."** This CRM was connected to another Google account before. Sign in with that account.
- **"That Google account is already linked to another Hearth CRM. Each CRM needs its own Google account."** Another CRM on this Home Assistant already syncs to that Google account; two CRMs syncing into one account would each create their own contacts. Sign in with a different account.
- **"Could not read your Google account. Check that the Google People API is enabled for your Google Cloud project."** Enable the People API (step 2) and try again.
- **Google needs you to sign in again.** The panel shows this when Google no longer accepts Hearth's access (a revoked grant, or tokens that expired because the app is still in "Testing"). Choose **Reconfigure** and sign in again.

When a sync runs:

- **"These contacts weren't found in the connected Google account."** Until Google has accepted a first update or create through this connection, Hearth checks the first linked people it tries; if five are all missing in Google, that usually means Google is connected with a different account from the one the contacts were first synced to. The run stops and changes nothing, so nobody is marked "contact missing". Reconnect with the original account (**Reconfigure**), then run the sync again. If those contacts really were deleted, the next run tries other people first; once one is found, the deleted ones are marked "contact missing" as usual. After that first accepted write this check is off for good.
- **"The Google People API isn't enabled or Hearth lacks permission."** Google refused every request: the People API is off for your Google Cloud project, or Hearth was connected without access to your contacts. The run stops and changes nothing. Enable the People API (step 2), or choose **Reconfigure** and allow contacts access, then run the sync again.
- **"Stopped because the sync was switched off."** You switched the sync off while it was running. Hearth stops before the next person; everyone already done stays done, and the rest wait until you switch it back on.

Errors on a person (shown in the panel's sync health):

- **"contact missing"**: the contact was deleted in Google. Hearth does not recreate it. In the panel, choose **Create a new contact** for that person and the next run creates a fresh one.
- **"create uncertain"**: Hearth asked Google to create the contact but got no clear answer, so Google may already hold it. Before doing anything else, look in Google Contacts for a stray copy of that person and delete it if there is one. Then choose **Create a new contact** in the panel to try again.

## Where your data lives

Each Home Assistant user has their own CRM, in a folder named after their user ID:

- Database: `/config/hearth_crm/<user id>/hearth_crm.db`
- Photos: `/config/hearth_crm/<user id>/photos/`
- Import reports: `/config/hearth_crm/<user id>/import_report.md` (last successful import) and `import_report_failed.md` (last failed one)
- Exports: `/config/hearth_crm/<user id>/exports/`
- Imports (where you put bundles): `/config/hearth_crm/<user id>/imports/`

Removing a CRM from Home Assistant never deletes its folder; adding it again for the same user picks the data back up.

Home Assistant backups include the `hearth_crm` directory. The integration hooks into the backup process and pauses writes while a backup runs, so the database is captured in a consistent state. Reads keep working. A write waits up to 10 seconds for the backup to finish; after that it fails (websocket error `backup_in_progress`, or a failed import saying a backup is running) and can simply be tried again.

## Privacy

- Your data stays on your Home Assistant instance. Hearth sends nothing to any outside service unless you connect one. If you connect Google Contacts (see [Google Contacts](#google-contacts)), the synced fields (names, phone numbers, email addresses, addresses and photos) go only to your own Google account, through an OAuth client you create yourself. Your Google tokens are kept only in that CRM's config entry. If you connect Claude (see [Claude](#claude)), what Claude reads from your CRM is sent to Claude in your conversation.
- When entities are added in a later release, they will expose only birthdays and counts, not names, notes or interactions.
- Home Assistant administrators can read everything under `/config`, including every user's database and photos. The owner-only rules above apply to the actions, websocket API and photo URL, not to the file system.
- Backups contain the whole `hearth_crm` folder, so protect them like the rest of your Home Assistant backups.
- The panel keeps a copy of your CRM in this browser's local storage, so it can still show your data while Home Assistant is offline. The next time a different Home Assistant user opens Hearth in the same browser, your copy is deleted. It is also deleted when the panel finds your CRM has been removed.

## Development

Hearth is developed against Home Assistant 2026.10.2 with a pinned version of `pytest-homeassistant-custom-component`.

```sh
python3 -m venv .venv
.venv/bin/pip install homeassistant==2026.10.2 pytest-homeassistant-custom-component==0.13.373 home-assistant-frontend==20260930.4 mcp==1.28.1 aiohttp_sse==2.2.0 anyio==4.14.2 hassil==3.12.1 home-assistant-intents==2026.10.6 gazetteer-matcher==1.1.0
.venv/bin/pytest -p no:anyio
```

To try a change on a running instance, copy `custom_components/hearth_crm/` to `/config/custom_components/hearth_crm/` and restart Home Assistant. Run the tests with `-p no:anyio`, as above.

### Developing the panel

The panel is TypeScript and lit under `frontend/`. It needs Node 20 or newer.

```sh
cd frontend && npm install && npm test && npm run build
```

The build writes `custom_components/hearth_crm/www/hearth-panel.js`. That built file is committed, so installing through HACS never needs a build. Rebuild and commit it whenever the panel source changes.

## License

See [LICENSE](LICENSE).
