"""Constants for Hearth."""

from datetime import timedelta

DOMAIN = "hearth_crm"
DATA_DIR = "hearth_crm"
DB_FILE = "hearth_crm.db"
PHOTOS_DIR = "photos"

CONF_OWNER_USER_ID = "owner_user_id"
IMPORT_REPORT_FILE = "import_report.md"
IMPORT_REPORT_FAILED_FILE = "import_report_failed.md"
EXPORTS_DIR = "exports"
IMPORTS_DIR = "imports"

SIGNAL_CHANGED = "hearth_crm_changed_{}"

PANEL_URL_PATH = "hearth"
STATIC_URL = "/hearth_crm_static"
PANEL_ELEMENT = "hearth-panel"
PANEL_MODULE = "hearth-panel.js"

# The LLM API Claude reaches through Home Assistant's MCP server, at /api/mcp/hearth_crm.
LLM_API_ID = "hearth_crm"
LLM_API_NAME = "Hearth"
# Tool names must start with the domain and two underscores; Home Assistant stops accepting
# unprefixed names in 2027.3.
TOOL_PREFIX = f"{DOMAIN}__"

# Google Contacts sync. Hearth asks for read and write access to the owner's contacts and a
# refresh token (access_type=offline, prompt=consent), so the sync keeps working unattended.
GOOGLE_SCOPE = "https://www.googleapis.com/auth/contacts"
OAUTH2_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
OAUTH2_TOKEN = "https://oauth2.googleapis.com/token"
# The Google account a CRM is linked to (its People API resourceName), so reconnecting with a
# different account is refused instead of orphaning every stored google_contact_id.
CONF_GOOGLE_ACCOUNT_ID = "google_account_id"
GOOGLE_PEOPLE_ME = "https://people.googleapis.com/v1/people/me"

# When the sync runs on its own: shortly after setup, once edits settle, and hourly.
GOOGLE_STARTUP_DELAY_SECONDS = 30
GOOGLE_DEBOUNCE_SECONDS = 60
GOOGLE_SWEEP_INTERVAL = timedelta(hours=1)
# The change-log and change-notice source of the sync's own writes.
SYNC_SOURCE = "sync"
