---

# Session Learnings - Boulder Continuation (Apr 19 2026)

## Phase 5: Events & Dashboards

### Events Page (`/events`)
- Uses `EventSeverity` type from supabase.ts
- SEVERITY_COLORS maps severity to Tailwind classes
- Filter state: "all" | "critical" | "warning" | "info"
- Fetches events from events table filtered by org_id

### Dashboard Enhancement
- Stats cards: signals count, events count, critical count, warnings count, jobs count
- Uses Promise.all for parallel fetches
- Quick action buttons linking to /signals/new, /training, /events

## Phase 6: Notifications (Partial)

### Migration 008_notification_channels.sql
- Table: notification_channels (id, org_id, channel_type, name, config jsonb, enabled)
- channel_type check: 'email', 'webhook', 'slack', 'teams', 'sms'
- RLS policies for org isolation

### Email Service (services/notifications/email.ts)
- Uses nodemailer
- Config from env vars: EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS
- Creates transporter on construction

### Notification Channels API
- GET /api/notifications/channels - list for org
- POST /api/notifications/channels - create channel
- Uses Zod validation

## Agent Timeout Issues

- Agents started timing out after ~5 minutes
- Files were often created before timeout
- Manual verification and fixes required
- Build verification critical to catch type errors

## Build Issues Fixed

1. `z.string.datetime()` → `z.string().refine()` for datetime validation
2. `Badge variant="warning"` → `Badge variant="secondary"` (no warning variant in shadcn)
3. `getSession()` destructuring type issue → separate session and user extraction
4. SEVERITY_COLORS indexing with EventSeverity type assertion

---

# Kairo Platform Learnings - Wave 4.3 T4.11

## Training E2E Test Implementation

### Files Created
- `frontend/tests/e2e/training.spec.ts` - Playwright E2E tests for training flow

### Key Implementation Details

1. **Test Structure**:
   - Uses `beforeEach` for consistent admin login flow
   - Uses `afterEach` for cookie cleanup
   - Follows same patterns as existing E2E tests (auth.spec.ts, prediction.spec.ts, etc.)

2. **Authentication Pattern**:
   - Uses admin credentials: `admin@example.com` / `AdminPassword123!`
   - Checks for redirect to `/login` when unauthenticated
   - Tests role-based access (non-admin users get "Access Denied")

3. **Training Form Interactions**:
   - Signals are button elements that toggle on click
   - Model type selection uses radio-style buttons
   - Hyperparameters use `id` selectors (e.g., `#learning_rate`, `#epochs`)
   - Schedule type toggle shows/hides `#scheduled_time` input

4. **Test Scenarios Covered**:
   - Unauthenticated redirect to login
   - Admin access to training page
   - Non-admin access denial
   - Form validation (no signals selected)
   - Signal selection and deselection
   - Model type selection
   - Hyperparameter modification
   - Cost estimate display
   - Schedule type toggle
   - Invalid hyperparameter validation
   - Training job submission (both "now" and "scheduled")
   - Success message timeout behavior
   - API endpoint tests (POST/GET /api/training/jobs)

5. **UI Component Patterns**:
   - `getByText()` for clicking signal names
   - `locator('#id')` for form inputs
   - `getByRole('button', { name: 'Start Training' })` for submit
   - `getByText(/pattern/i)` for dynamic content assertions

### Lessons Learned
- Training page permission check happens client-side after auth check
- Success message auto-hides after 3 seconds (needs careful timing in tests)
- Mock signals are returned directly from component (no real DB call)
- Form uses native HTML input types with step/min/max for browser validation

---

# Kairo Platform Learnings - Wave 4.2 T4.6

## Training Job Submission API Implementation

### Files Created/Modified
- `supabase/migrations/007_training_jobs.sql` - training_jobs table with RLS policies and helper functions
- `frontend/src/app/api/training/jobs/route.ts` - POST/GET endpoints for training jobs
- `services/training/index.ts` - ClearML API client service

### Key Implementation Details

1. **Database Schema** (`training_jobs` table):
   - `org_id` and `user_id` for ownership tracking
   - `signal_ids` as UUID[] array for multiple signals
   - `model_type` enum: 'anomaly_detection' or 'timesfm_finetune'
   - `hyperparameters` JSONB for flexible config storage
   - `schedule_type`: 'now' or 'scheduled'
   - `scheduled_time` for future execution
   - `status`: pending → queued → running → completed/failed/cancelled
   - `clearml_task_id` and `clearml_queue` for ClearML integration
   - `error_message`, `started_at`, `completed_at` for tracking

2. **RLS Policies**: Following existing org_id pattern with `app.current_org_id()`

3. **Database Functions**:
   - `app.submit_training_job()` - Creates job record
   - `app.update_training_job_status()` - Updates job status with timestamps

4. **API Endpoints**:
   - `POST /api/training/jobs` - Creates job, submits to ClearML if schedule_type='now'
   - `GET /api/training/jobs` - Lists jobs with optional status filter

5. **ClearML Integration**:
   - Uses REST API v2 endpoints
   - Authenticates via `CLEARML_API_ACCESS_KEY` and `CLEARML_API_SECRET_KEY`
   - Creates task with script args and hyperparameters
   - Enqueues to `training` queue (configurable via `CLEARML_TRAINING_QUEUE`)

### Lessons Learned
- ClearML uses Basic auth with access_key:secret_key base64 encoded
- Queue must exist before enqueueing - need to handle queue not found errors
- Task creation and enqueueing are two separate API calls
- Task name format: `kairo-training-${timestamp}` for uniqueness

### Environment Variables Required
- `CLEARML_API_HOST` - ClearML API server URL (default: http://localhost:8080)
- `CLEARML_API_ACCESS_KEY` - API access key
- `CLEARML_API_SECRET_KEY` - API secret key
- `CLEARML_TRAINING_QUEUE` - Queue name (default: training)

---

# Kairo Platform Learnings - Wave 4.2 T4.5

## Training Configuration UI Implementation

### Files Created
- `frontend/src/app/training/page.tsx` - Main training page with permission checks
- `frontend/src/components/training/training-config-form.tsx` - Training configuration form component

### Key Implementation Details

1. **Form Pattern**: Followed existing shadcn/ui + react-hook-form patterns from signup and signals/new pages
   - Used `useForm` from react-hook-form
   - Used `zodResolver` from @hookform/resolvers/zod
   - Used Zod for validation with `.refine()` for complex validation

2. **Multi-select Signals**: Implemented custom checkbox-style signal selector (no checkbox component in shadcn/ui)
   - Uses div with custom styled checkbox appearance
   - Maintains array state via react-hook-form Controller

3. **Permission System**:
   - Uses `canTrainModels(role)` from `frontend/src/lib/permissions.tsx`
   - Requires "analyst" role or higher (owner > admin > analyst > viewer)
   - Role check happens client-side with loading state

4. **Hyperparameter Validation**:
   - learning_rate: 0 < value <= 1
   - epochs: 1-1000
   - batch_size: 1-512
   - context_length: 1-4096
   - forecast_length: 1-512

5. **Schedule Options**:
   - "now" - immediate training
   - "scheduled" - datetime picker for future scheduling

6. **Cost Estimation**: Simple estimation based on:
   - Signal count
   - Total data points
   - Model type (timesfm_finetune is ~3x costlier than anomaly_detection)
   - Epoch count

### Lessons Learned
- No checkbox component exists in shadcn/ui - use native input with custom styling
- All form inputs use native HTML input types with step/min/max attributes for browser validation
- Zod `.refine()` is needed for cross-field validation (e.g., scheduled_time required when schedule_type=scheduled)

### Dependencies Used
- react-hook-form
- @hookform/resolvers/zod
- zod
- Existing shadcn/ui components: Card, Input, Label, Select, Button, Badge

---

## Training Service Python Implementation - Wave 4.2 T4.7 & T4.8

### Files Created
- `services/training/train.py` - Main Python training script
- `services/training/storage.py` - MinIO client for model artifact storage
- `services/training/requirements.txt` - Python dependencies

### Key Implementation Details

1. **ClearML Integration**:
   - Uses `Task.init()` to initialize ClearML task tracking
   - Uses `task.get_logger().report_scalar()` for metrics reporting
   - Falls back gracefully if clearml is not available (offline mode)

2. **PostgreSQL Data Fetching**:
   - Uses psycopg2 with `RealDictCursor` for dictionary-style row access
   - Fetches signal data points from signals table using org_id and signal_ids array
   - Connection parameters from environment variables with docker defaults

3. **MinIO Storage**:
   - Uses Minio Python SDK for object storage
   - Bucket: `kairo-models` (configurable)
   - Path pattern: `{org_id}/{job_id}/model.pt`
   - Auto-creates bucket if not exists

4. **Anomaly Detection Model**:
   - Uses sklearn IsolationForest
   - Stores model + scaler as pickled object
   - Reports anomaly count and ratio to ClearML

5. **TimesFM Fine-tuning**:
   - Falls back to mock training if timesfm not available
   - Stores training metadata as pickled dict
   - Reports status, data points, and epochs to ClearML

6. **Environment Variables**:
   - `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
   - `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
   - All have docker-internal defaults

### Lessons Learned
- ClearML Task must be initialized before using `task.get_logger()`
- psycopg2 `RealDictCursor` provides dict-like row access for cleaner code
- MinIO `put_object` requires a file-like object with known length
- Always handle missing dependencies gracefully with try/except and mock fallbacks

---

# Kairo Platform Learnings - Wave 4.3 T4.9

## Model Serving API Implementation

### Files Created
- `frontend/src/app/api/models/serve/route.ts` - POST endpoint for running model inference
- `frontend/src/app/api/models/[id]/route.ts` - GET endpoint for model info

### Key Implementation Details

1. **POST /api/models/serve**:
   - Accepts: `{ job_id, signal_ids, context_length?, forecast_length? }`
   - Validates user authentication and org access
   - Verifies training job exists and status is 'completed'
   - Fetches signal data from Supabase
   - Determines model type from job (anomaly_detection → anomaly_model.pkl, timesfm_finetune → timesfm_model.pkl)
   - Calls external inference service (MODEL_INFERENCE_API_URL) with model path and signal data
   - Returns: `{ predictions, anomaly_scores?, context_used, forecast_length }`

2. **GET /api/models/[id]**:
   - Returns model/training job info: `{ job_id, status, model_type, created_at, completed_at, error_message }`
   - Uses same auth pattern as other endpoints
   - Only returns jobs belonging to user's organization

3. **MinIO Integration Pattern**:
   - Model path format: `http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{org_id}/{job_id}/{model_name}`
   - Actual MinIO access happens in external Python inference service (not in Next.js)
   - This follows the same pattern as existing `/api/predict` which calls external TimesFM API

4. **Environment Variables**:
   - `MINIO_ENDPOINT` - MinIO server URL (default: minio:9000)
   - `MINIO_BUCKET` - Bucket name (default: kairo-models)
   - `MODEL_INFERENCE_API_URL` - External inference service URL (default: http://localhost:8002)

### Lessons Learned
- Next.js frontend cannot directly run Python pickle inference - needs external Python service
- MinIO Python SDK patterns cannot be directly reused in TypeScript (different language)
- Architecture: Frontend routes requests to external inference services which handle MinIO access
- Model files stored at: `kairo-models/{org_id}/{job_id}/anomaly_model.pkl` or `timesfm_model.pkl`
- Inference service receives model_path and signal_data, returns predictions

### Dependencies Used
- zod (validation)
- @supabase/supabase-js (existing)
- No new dependencies added

---

# Kairo Platform Learnings - Wave 4.3 T4.10

## Event Generation from Predictions Implementation

### Files Created/Modified
- `supabase/migrations/007b_training_events.sql` - events table and record_anomaly_event function
- `frontend/src/app/api/models/serve/route.ts` - Updated to generate events on high anomaly scores

### Key Implementation Details

1. **Events Table** (`events`):
   - `org_id` - Links to organization
   - `job_id` - Links to training_jobs (nullable, ON DELETE SET NULL)
   - `signal_ids` - UUID[] array linking to signals used
   - `event_type` - Text field (e.g., 'anomaly_detected')
   - `severity` - CHECK constraint: 'critical', 'warning', 'info'
   - `event_data` - JSONB for flexible data (anomaly_scores, threshold, etc.)
   - Standard RLS policies following org_id pattern

2. **Event Recording Function** (`app.record_anomaly_event`):
   - Accepts: org_id, job_id, signal_ids[], severity, anomaly_scores JSONB, threshold
   - Calculates max_score and high_score_count from anomaly_scores
   - Auto-determines severity: critical if max_score >= 0.9, else warning
   - Stores full anomaly_scores array in event_data for later analysis

3. **API Route Integration** (`/api/models/serve`):
   - After inference returns anomaly_scores
   - Filters scores >= ANOMALY_THRESHOLD (0.7)
   - If any high scores found, calls `supabaseAdmin.rpc("record_anomaly_event", ...)`
   - Only triggers for model_type === "anomaly_detection"

4. **Event Data Structure**:
   ```json
   {
     "threshold": 0.7,
     "anomaly_scores": [0.2, 0.85, 0.3, 0.92],
     "max_score": 0.92,
     "high_score_count": 2
   }
   ```

### Lessons Learned
- Events table links to training_jobs with ON DELETE SET NULL (job can be deleted but event history preserved)
- signal_ids stored as UUID[] to maintain signal linkage even if individual signals are deleted
- Severity auto-determination based on score threshold (0.9 for critical) provides actionable alerts
- RPC call to record_anomaly_event is fire-and-forget (no await needed for event recording)

---

# Kairo Platform Learnings - Wave 5.1 T5.2

## Event Timeline UI Implementation

### Files Created
- `frontend/src/app/events/page.tsx` - Event timeline page with filtering and event details dialog
- `frontend/src/components/events/event-timeline.tsx` - Timeline component with grouped by date
- `frontend/src/components/events/event-card.tsx` - Individual event card component

### Key Implementation Details

1. **Event Timeline Structure**:
   - Events displayed in reverse chronological order (newest first)
   - Grouped by date with sticky date headers
   - Visual timeline connector line on left side
   - Color-coded dots based on severity (red=critical, yellow=warning, blue=info)

2. **EventCard Component**:
   - Shows severity badge with icon (AlertCircle, AlertTriangle, Info)
   - Relative timestamp ("5m ago", "2h ago", etc.)
   - Event type formatted with title case
   - Signal count indicator
   - Selected state with ring highlight
   - Hover effects (scale and shadow)

3. **EventTimeline Component**:
   - Groups events by date using `toLocaleDateString`
   - Sticky date headers for scroll navigation
   - Vertical timeline connector with colored dots
   - Empty state message when no events

4. **EventsPage Component**:
   - Summary cards showing counts for all/critical/warning/info
   - Severity filter using shadcn/ui Select component
   - Click event card to open Dialog with full details
   - Dialog shows: severity badge, timestamp, signals involved, job ID, event_data JSON

5. **Supabase Integration**:
   - Added `listAnomalyEvents(orgId)` function to fetch events
   - Added `getAnomalyEvent(eventId)` function for single event
   - Added `EventSeverity` type and `AnomalyEvent` interface
   - Uses RPC invoke pattern with edge functions

6. **Severity Filtering**:
   - Filter options: All Severities, Critical Only, Warnings Only, Info Only
   - Filter applied client-side before sorting

### Lessons Learned
- shadcn/ui doesn't have a native timeline component - built custom using Card and flexbox
- Timeline dots use absolute positioning with `left-6` to align with card content
- Grouping by date requires `toLocaleDateString` for consistent formatting
- Dialog component used for event details modal (from shadcn/ui dialog.tsx)
- Mock data used since events API edge function not yet implemented

### Pattern Notes
- All components use "use client" directive
- Follow shadcn/ui component patterns (cn utility, data-slot attributes)
- Permission check pattern: auth check → org check → role check → load data
- Error handling with try/catch and loading states

---

# Kairo Platform Learnings - Wave 5.1 T5.3-T5.7

## Phase 5 Remaining Components

### T5.3: Event Acknowledgment

#### Files Created/Modified
- `supabase/migrations/007c_events_acknowledge.sql` - Adds acknowledged, acknowledged_at, acknowledged_by fields to events table
- `frontend/src/app/api/events/[id]/acknowledge/route.ts` - POST endpoint to mark event acknowledged
- `frontend/src/lib/supabase.ts` - Updated AnomalyEvent interface, added acknowledgeEvent function

#### Key Implementation Details

1. **Migration**:
   - Added `acknowledged BOOLEAN NOT NULL DEFAULT FALSE`
   - Added `acknowledged_at TIMESTAMPTZ`
   - Added `acknowledged_by UUID REFERENCES users(id)`
   - Partial index on `idx_events_acknowledged` for unacknowledged events

2. **Acknowledge API** (`POST /api/events/[id]/acknowledge`):
   - Auth via Bearer token in Authorization header
   - Validates user, gets org_id from users table
   - Verifies event exists and belongs to org
   - Checks if already acknowledged (returns 400 if so)
   - Updates acknowledged=true, acknowledged_at=NOW(), acknowledged_by=user.id
   - Returns updated event info

3. **Supabase Client**:
   - Added acknowledged, acknowledged_at, acknowledged_by to AnomalyEvent interface
   - Added `acknowledgeEvent(eventId)` function that calls POST /api/events/{id}/acknowledge

#### Lessons Learned
- Always check if event is already acknowledged before updating (idempotency)
- Use `acknowledged_at` timestamp for tracking when acknowledgment happened
- Store `acknowledged_by` user ID for audit trail

### T5.4: Event Search/Filter

#### Files Modified
- `frontend/src/app/events/page.tsx` - Added search input and updated MOCK_EVENTS

#### Key Implementation Details

1. **Search Functionality**:
   - Added text input for searching events by event_type
   - Case-insensitive substring match
   - Combined with severity filter (both conditions must pass)

2. **Filter Enhancements**:
   - Existing severity filter preserved (all, critical, warning, info)
   - Search is additive to severity filter

### T5.5: Dashboard Enhancement

#### Files Modified
- `frontend/src/app/dashboard/page.tsx` - Complete rewrite with summary cards and recent lists

#### Key Implementation Details

1. **Event Summary Cards**:
   - Critical Events count (red themed)
   - Warning Events count (yellow themed)
   - Total Events count
   - Active Signals count

2. **Recent Events List**:
   - Shows 5 most recent events
   - Displays severity badge, event type, timestamp
   - Shows acknowledged status with CheckCircle icon
   - "View all events" link to /events

3. **Recent Signals List**:
   - Shows 3 mock signals with name, source_type, updated_at
   - "View all signals" link to /signals

4. **Recent Training Jobs**:
   - Shows up to 5 jobs from training_jobs table
   - Displays status badge (color-coded), model type, created_at
   - Status colors: completed=green, failed=red, running=blue, queued/scheduled=yellow
   - "View training page" link to /training

5. **Data Loading Pattern**:
   - `Promise.all` for parallel fetches of events, signals, jobs
   - Uses `useEffect` with async `checkUser` inner function
   - Auth check → user org fetch → parallel data loads

### T5.6: Event Aggregation

Event aggregation is implemented as part of T5.5 in the dashboard:
- Event summary cards show aggregated counts (critical, warning, total)
- Stats computed client-side from fetched events

### T5.7: Dashboard E2E Test

#### Files Created
- `frontend/tests/e2e/dashboard.spec.ts` - Playwright E2E tests for dashboard

#### Key Implementation Details

1. **Test Structure**:
   - Uses `beforeEach` for consistent admin login (admin@example.com)
   - Uses `afterEach` for cookie cleanup
   - Follows existing test patterns

2. **Test Scenarios Covered**:
   - Unauthenticated redirect to login
   - Authenticated user access
   - Welcome message display
   - Dashboard navigation buttons (Events, Sign out)
   - Event summary cards visibility
   - Recent events section
   - Recent signals section
   - Recent training jobs section
   - Navigation to events page
   - Navigation to signals page
   - Navigation to training page
   - Sign out redirect to login
   - Session persistence on refresh

### Build Issues Fixed

1. **Type error in dashboard**: `loadEventStats` was selecting only `severity, acknowledged` but trying to assign to `AnomalyEvent[]` - fixed by selecting `*`

2. **Missing fields in MOCK_EVENTS**: Added `acknowledged`, `acknowledged_at`, `acknowledged_by` fields to all mock events to match updated AnomalyEvent interface
