-- Kairo SRTD Migration Guide

# SRTD (Schema Released To Developers)

SRTD provides live-reloading SQL templates for iterative development with clean, reviewable diffs for production.

## Directory Structure

```
supabase/
├── srtd.yaml                    # SRTD configuration
├── migrations/                  # Generated migration files (do not edit)
│   ├── 001_initial_schema.sql
│   └── 002_rls_policies.sql
└── migrations-templates/        # Editable SQL templates
    ├── auth/
    │   ├── user_management.sql
    │   └── org_users.sql
    ├── signals/
    │   └── signal_helpers.sql
    ├── events/
    │   └── event_handlers.sql
    ├── notifications/
    │   └── channel_helpers.sql
    └── audit/
        └── audit_helpers.sql
```

## Commands

### Development (Watch Mode)
```bash
srtd watch
```
Edits to templates are auto-applied to local database. No migration files created.

### Build Migrations
```bash
srtd build
```
Generates migration files in `supabase/migrations/` from templates.

### Apply Templates (One-time)
```bash
srtd apply
```
Applies all templates once without watching.

### Register Existing Functions
```bash
srtd register <template.sql>
```
Marks a template as already deployed (won't rebuild until changed).

## Adding New Migrations

1. **Create template file** in appropriate functional area:
   ```bash
   touch supabase/migrations-templates/<area>/<name>.sql
   ```

2. **Write idempotent SQL** (DROP IF EXISTS + CREATE):
   ```sql
   DROP FUNCTION IF EXISTS my_function;
   CREATE FUNCTION my_function() RETURNS TEXT AS $$
   BEGIN
       RETURN 'Hello';
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Declare dependencies** (optional):
   ```sql
   -- @depends-on: other_template.sql
   ```

4. **Test locally**:
   ```bash
   srtd watch
   ```

5. **Build for production**:
   ```bash
   srtd build
   supabase migration up
   ```

## Rollback

SRTD migrations are **not automatically rollbackable**. To rollback:

1. **Create new migration** with reverse operation:
   ```sql
   DROP FUNCTION IF EXISTS my_function;
   -- Or recreate with old logic:
   CREATE FUNCTION my_function() RETURNS TEXT AS ...
   ```

2. **For table changes**, use traditional migration down scripts:
   ```bash
   supabase migration new revert_my_change
   ```

## WIP Templates

Use `.wip.sql` extension for experiments:
- Applied during `watch` and `apply`
- Never built to migrations
- Promote when ready: `srtd promote my_experiment.wip.sql`

## Best Practices

- **One function per template** - Easier code review
- **Idempotent templates** - Safe to run multiple times
- **Functional area grouping** - Keep related migrations together
- **Document TODOs** - Mark incomplete implementations
- **Use @depends-on** - Declare dependencies explicitly

## What Can Be Templates

| Object | Pattern |
|--------|---------|
| Functions | `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION` |
| Views | `CREATE OR REPLACE VIEW` |
| RLS Policies | `DROP POLICY IF EXISTS` + `CREATE POLICY` |
| Triggers | Drop + recreate trigger and function |
| Roles | `REVOKE ALL` + `GRANT` |
| Enums | `ADD VALUE IF NOT EXISTS` |

## What Should NOT Be Templates

- Table structures (use regular migrations)
- Indexes (use regular migrations)
- Data modifications (use regular migrations)

## State Tracking

| File | Purpose | Git |
|------|---------|-----|
| `.buildlog.json` | Built migrations | Commit |
| `.buildlog.local.json` | Local applied state | Gitignore |
