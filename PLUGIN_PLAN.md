# Plugin System Implementation Plan

## Context

Axari currently has Skills (markdown instruction sets) and Tools/Integrations (MCP servers with credentials). We need a **Plugin system** — Claude Code's native plugin format — that bundles skills, agents, hooks, MCP servers, and more into a single installable package. Plugins are sourced from the `claude-plugins.dev` marketplace (separate `/api/plugins` endpoint) and stored/assigned using the same patterns as skills and tools.

Key design decisions from brainstorming:
- Plugins get their own tab in the UI (separate from skills)
- Credentials follow the **multi-account pattern** from Tools/Integrations (create named accounts, pick which account an employee uses)
- Plugin files are stored in the existing employee workspace (`tenants/{tid}/employees/{eid}/.claude/plugins/`)
- Plugins are passed to `ClaudeAgentOptions.plugins` at runtime (not just filesystem discovery like skills)

---

## Section 1: Database Models & Migration

### New file: `shared/models/plugin.py`

Three new tables mirroring the Skill + Tool patterns:

**`Plugin`** (mirrors `Skill` table + `Tool` credential schema)
- `id`: UUID PK
- `tenant_id`: FK → tenants (nullable, indexed)
- `name`: String(255), unique per tenant
- `description`: Text
- `version`: String(50)
- `author`: String(255)
- `git_url`: Text (source repo)
- `category`: String(100)
- `source`: String(50) — "marketplace" | "custom"
- `keywords`: JSONB (array of strings)
- `verified`: Boolean
- `downloads`: Integer
- `stars`: Integer
- `bundled_skills`: JSONB (list of skill names)
- `bundled_agents`: JSONB (list of agent names)
- `bundled_mcp_servers`: JSONB (list of MCP server names)
- `user_config_schema`: JSONB — parsed from plugin.json `userConfig` (field names, descriptions, sensitive flags)
- `plugin_content`: JSONB — the full plugin directory manifest + file tree metadata
- `install_count`: Integer (how many employees have it)
- `created_at`, `updated_at`: timestamps

Unique constraint: `(tenant_id, name)`

**`PluginAccount`** (mirrors `ToolAccount`)
- `id`: UUID PK
- `tenant_id`: FK → tenants (indexed)
- `plugin_id`: FK → plugins (CASCADE)
- `name`: String(255) — e.g. "Engineering Jira", "Personal GitHub"
- `credentials`: Text — Fernet-encrypted JSON of userConfig values
- `created_at`: timestamp

**`EmployeePlugin`** (mirrors `EmployeeTool`)
- `employee_id`: FK → employees (CASCADE), PK
- `plugin_id`: FK → plugins (CASCADE), PK
- `enabled`: Boolean
- `plugin_account_id`: FK → plugin_accounts (SET NULL, nullable)
- `installed_at`: timestamp

### New migration: `db/alembic/versions/026_add_plugins.py`

Creates all three tables with appropriate indexes and constraints.

### Files to modify:
- `shared/models/__init__.py` — import new models

---

## Section 2: Pydantic Schemas

### New file: `shared/schemas/plugin.py`

Request/response schemas mirroring `shared/schemas/skill.py` and `shared/schemas/tool.py`:

- `PluginResponse` — full plugin detail (all fields)
- `PluginSummary` — list view (id, name, description, version, author, category, source, verified, install_count, user_config_schema, bundled counts)
- `PluginAccountCreate` — `{ name: str, credentials: dict }`
- `PluginAccountResponse` — `{ id, plugin_id, name, has_credentials, created_at }`
- `EmployeePluginAssign` — `{ plugin_id: UUID, plugin_account_id: UUID | None }`
- `EmployeePluginResponse` — `{ plugin_id, plugin_name, plugin_description, enabled, plugin_account_id, plugin_account_name, installed_at }`
- `EmployeePluginUpdate` — `{ plugin_account_id: UUID | None }` (for changing account)
- `MarketplacePluginInstallRequest` — `{ name, description, git_url, version, author, keywords, verified, category, bundled_skills, bundled_agents, bundled_mcp_servers, user_config_schema }`

---

## Section 3: API Routes

### New file: `api/routers/plugins.py`

Mirrors the pattern from `api/routers/skills.py` (marketplace proxy + CRUD) combined with `api/routers/tools.py` (accounts + employee assignment with account selection).

**Marketplace proxy:**
- `GET /api/plugins/marketplace` — proxy to `https://claude-plugins.dev/api/plugins` with `q`, `limit`, `offset` params. Enrich with `installed` status per tenant (same pattern as skills marketplace).
- `POST /api/plugins/marketplace/install` — receives plugin metadata from frontend, stores in DB. Does NOT clone the git repo at install time (we store the metadata and `git_url`; actual plugin files are fetched at sync time — see Section 5).

**Plugin CRUD:**
- `GET /api/plugins` — list installed plugins for tenant
- `GET /api/plugins/{plugin_id}` — full plugin detail
- `DELETE /api/plugins/{plugin_id}` — delete plugin + cleanup from employee filesystems

**Plugin accounts (mirrors `api/routers/tools.py` accounts):**
- `GET /api/plugins/{plugin_id}/accounts` — list accounts
- `POST /api/plugins/{plugin_id}/accounts` — create account (encrypt credentials via `shared/encryption.py`)
- `DELETE /api/plugins/{plugin_id}/accounts/{account_id}` — delete account

**Employee-plugin assignment (mirrors tool assignment with account picker):**
- `GET /api/employees/{employee_id}/plugins` — list assigned plugins
- `POST /api/employees/{employee_id}/plugins` — assign plugin (with optional `plugin_account_id`)
- `PATCH /api/employees/{employee_id}/plugins/{plugin_id}` — update account selection
- `DELETE /api/employees/{employee_id}/plugins/{plugin_id}` — unassign

### File to modify: `api/main.py`
- Import and include the new plugins router

---

## Section 4: Plugin File Storage & Sync

### File to modify: `agent/memory.py`

Add `sync_employee_plugins()` function mirroring `sync_employee_skills()`:

```
async def sync_employee_plugins(employee_id, employee_dir, db):
    1. Query EmployeePlugin + Plugin for enabled plugins
    2. For each plugin, ensure .claude/plugins/{name}/ directory exists
    3. Write plugin.json manifest to .claude/plugins/{name}/.claude-plugin/plugin.json
    4. Write any bundled content (skills, agents, etc.) from plugin_content JSONB
    5. If plugin has a PluginAccount assigned via EmployeePlugin:
       - Decrypt credentials
       - Substitute ${user_config.*} placeholders in plugin files (e.g., .mcp.json)
    6. Remove stale plugin directories (on disk but not in DB)
```

The plugin directory structure per employee:
```
employees/{eid}/.claude/plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json
├── skills/
├── agents/
├── hooks/
├── .mcp.json
└── settings.json
```

### File to modify: `agent/runner.py`

Add `resolve_plugins()` function and integrate into `handle_dm()`:

```python
async def resolve_plugins(employee_id, employee_dir, db):
    """Return list of plugin path dicts for ClaudeAgentOptions.plugins."""
    result = query EmployeePlugin + Plugin where enabled
    plugins = []
    for emp_plugin, plugin in rows:
        plugin_path = employee_dir / ".claude" / "plugins" / plugin.name
        if plugin_path.exists():
            plugins.append({"type": "local", "path": str(plugin_path)})
    return plugins
```

In `handle_dm()`, after `sync_employee_skills()`:
```python
await sync_employee_plugins(employee_id, employee_dir, db)
plugins = await resolve_plugins(employee_id, employee_dir, db)
# ... later ...
if plugins:
    options.plugins = plugins
```

### Files to also modify:
- `agent/outcome_runner.py` — same sync + resolve pattern
- `agent/channel_runner.py` — same sync + resolve pattern
- `agent/cos/runner.py` — if CoS should have plugins too

---

## Section 5: Frontend — TypeScript Types

### File to modify: `ui/src/lib/types.ts`

Add new interfaces:

```typescript
interface Plugin {
  id: string; name: string; description: string | null;
  version: string | null; author: string | null; git_url: string | null;
  category: string | null; source: string; verified: boolean;
  keywords: string[] | null; downloads: number | null; stars: number | null;
  bundled_skills: string[] | null; bundled_agents: string[] | null;
  bundled_mcp_servers: string[] | null;
  user_config_schema: Record<string, { description: string; sensitive: boolean }> | null;
  install_count: number; created_at: string;
}

interface PluginSummary { /* subset of Plugin */ }

interface PluginAccount {
  id: string; plugin_id: string; name: string;
  has_credentials: boolean; created_at: string;
}

interface EmployeePlugin {
  plugin_id: string; plugin_name: string; plugin_description: string | null;
  enabled: boolean; plugin_account_id: string | null;
  plugin_account_name: string | null; installed_at: string;
}

interface MarketplacePlugin {
  id: string; name: string; namespace: string; gitUrl: string;
  description: string; version: string; author: string;
  keywords: string[]; skills: string[]; category: string;
  stars: number; verified: boolean; downloads: number;
  metadata: { homepage, repository, license, commands, agents, mcpServers };
  installed?: boolean;
}
```

---

## Section 6: Frontend — API Client

### File to modify: `ui/src/lib/api.ts`

Add `plugins` namespace mirroring the skills + tools pattern:

```typescript
plugins: {
  marketplace: (search, limit, offset) => get('/api/plugins/marketplace', { params }),
  install: (data) => post('/api/plugins/marketplace/install', data),
  list: () => get('/api/plugins'),
  get: (pluginId) => get(`/api/plugins/${pluginId}`),
  delete: (pluginId) => del(`/api/plugins/${pluginId}`),
  accounts: {
    list: (pluginId) => get(`/api/plugins/${pluginId}/accounts`),
    create: (pluginId, data) => post(`/api/plugins/${pluginId}/accounts`, data),
    delete: (pluginId, accountId) => del(`/api/plugins/${pluginId}/accounts/${accountId}`),
  },
  assignToEmployee: (empId, pluginId, accountId?) => post(`/api/employees/${empId}/plugins`, body),
  listForEmployee: (empId) => get(`/api/employees/${empId}/plugins`),
  updateEmployeeAccount: (empId, pluginId, accountId) => patch(`/api/employees/${empId}/plugins/${pluginId}`, body),
  unassignFromEmployee: (empId, pluginId) => del(`/api/employees/${empId}/plugins/${pluginId}`),
}
```

---

## Section 7: Frontend — Plugins Page

### New file: `ui/src/app/plugins/page.tsx`

Mirror the skills page (`ui/src/app/skills/page.tsx`) with these differences:

**Marketplace tab:**
- Hits `/api/plugins/marketplace` instead of `/api/skills/marketplace`
- Cards show: name, author, description, version, verified badge, stars, downloads
- "What's included" chips: "3 skills", "1 agent", "2 MCP servers" (from bundled_* fields)
- Install button → on success, if plugin has `user_config_schema` fields, prompt to configure account

**Installed tab:**
- List of installed plugins with search/filter
- Each plugin card shows: name, version, source, install_count, bundled component counts
- **Accounts section** per plugin (if `user_config_schema` is non-empty):
  - List of existing named accounts with delete button
  - "Add Account" button → modal with form fields generated from `user_config_schema`
  - Sensitive fields use password inputs, non-sensitive use text inputs
- Delete button (with confirmation)

**No custom creation form initially** — plugins are complex directory structures, not single files. Users install from marketplace or (future) upload.

---

## Section 8: Frontend — Plugin Selector (Employee Configurator)

### New file: `ui/src/components/employees/PluginSelector.tsx`

Mirror ToolSelector (`ui/src/components/employees/ToolSelector.tsx`) — specifically the account picker pattern:

**Core behavior:**
- List all installed plugins with toggle switches
- When toggling ON a plugin that has accounts:
  - If 1 account → auto-select it
  - If multiple accounts → show account picker dropdown
  - If 0 accounts → assign without account (show "needs configuration" warning)
- ChevronDown button to change account for assigned plugins
- Lazy-load accounts (cache after first fetch)
- "X/Y enabled" counter

### File to modify: `ui/src/components/employees/configurator/AgentConfigurator.tsx`

Add a 4th zone or integrate plugins into the existing CORE zone. Two options:

**Option A (recommended): Add to CORE zone alongside skills**
- CORE panel shows two sections: "Skills" and "Plugins" with a visual separator
- Activation calculation includes plugin count

**Option B: New zone**
- Add a 4th zone "PLUG" or "EXT" with a Puzzle icon
- Separate panel for plugins only

---

## Section 9: Sidebar Navigation

### File to modify: `ui/src/app/layout.tsx` (or wherever sidebar nav is defined)

Add "Plugins" nav item between "Skills" and "Tools" (or wherever makes sense), with a Puzzle icon from lucide-react.

---

## Implementation Order

1. **Database**: models + migration (Section 1)
2. **Schemas**: Pydantic request/response (Section 2)
3. **API routes**: marketplace proxy, CRUD, accounts, assignment (Section 3)
4. **Agent sync + resolve**: memory.py + runner.py changes (Section 4)
5. **Frontend types + API client** (Sections 5-6)
6. **Plugins page** (Section 7)
7. **Plugin selector + configurator integration** (Section 8)
8. **Navigation** (Section 9)

## Verification

1. **DB**: Run `uv run alembic upgrade head` — migration applies cleanly
2. **API**: Hit `/api/plugins/marketplace` — returns plugins from claude-plugins.dev
3. **Install flow**: Install a plugin from marketplace → appears in `/api/plugins` list
4. **Accounts**: Create a named account for a plugin with credentials → verify encrypted storage
5. **Assignment**: Assign plugin to employee with account → verify via `/api/employees/{id}/plugins`
6. **Runtime**: Trigger a DM with an employee that has a plugin → verify plugin path appears in `ClaudeAgentOptions.plugins`
7. **UI**: Browse marketplace, install, create accounts, assign to employee with account picker dropdown
