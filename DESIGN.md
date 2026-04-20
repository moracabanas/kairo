# Kairo Design System

## Overview

Kairo is a SaaS multitenant platform for time series analysis.
This document describes the design system tokens and conventions used
across the application.

## Color Palette

### Primary Colors

The primary color palette consists of colors used for primary actions,
key UI elements, and brand identity.

| Token | Hex | Usage |
|-------|-----|-------|
| primary-50 | #f0f9ff | Lightest tint |
| primary-100 | #e0f2fe | Light tint |
| primary-200 | #bae6fd | Tint |
| primary-300 | #7dd3fc | Light accent |
| primary-400 | #38bdf8 | Accent |
| primary-500 | #0ea5e9 | Base primary |
| primary-600 | #0284c7 | Dark accent |
| primary-700 | #0369a1 | Dark |
| primary-800 | #075985 | Darker |
| primary-900 | #0c4a6e | Darkest |
| primary-950 | #082f49 | Near black |

### Secondary Colors

Secondary colors support the primary palette for less prominent UI elements.

| Token | Hex | Usage |
|-------|-----|-------|
| secondary-50 | #f8fafc | Lightest tint |
| secondary-100 | #f1f5f9 | Light tint |
| secondary-200 | #e2e8f0 | Tint |
| secondary-300 | #cbd5e1 | Light accent |
| secondary-400 | #94a3b8 | Accent |
| secondary-500 | #64748b | Base secondary |
| secondary-600 | #475569 | Dark accent |
| secondary-700 | #334155 | Dark |
| secondary-800 | #1e293b | Darker |
| secondary-900 | #0f172a | Darkest |

### Accent Colors

Accent colors highlight important information and interactive states.

| Token | Hex | Usage |
|-------|-----|-------|
| accent-success | #22c55e | Success states, positive indicators |
| accent-warning | #f59e0b | Warning states, attention needed |
| accent-danger | #ef4444 | Error states, destructive actions |
| accent-info | #3b82f6 | Informational highlights |

### Background Colors

Background colors define the base surface layers of the UI.

| Token | Hex | Usage |
|-------|-----|-------|
| bg-primary | #ffffff | Primary surface (cards, modals) |
| bg-secondary | #f8fafc | Secondary surface (page background) |
| bg-tertiary | #f1f5f9 | Tertiary surface (nested elements) |
| bg-elevated | #ffffff | Elevated surfaces (dropdowns, tooltips) |
| bg-muted | #e2e8f0 | Muted backgrounds (disabled states) |

### Text Colors

Text colors establish hierarchy and readability across the interface.

| Token | Hex | Usage |
|-------|-----|-------|
| text-primary | #0f172a | Primary text (headings, body) |
| text-secondary | #475569 | Secondary text (descriptions) |
| text-tertiary | #94a3b8 | Tertiary text (placeholders, hints) |
| text-inverse | #ffffff | Text on dark backgrounds |
| text-link | #0ea5e9 | Interactive link text |
| text-muted | #64748b | Muted/disabled text |

### Border Colors

Border colors separate elements and define boundaries.

| Token | Hex | Usage |
|-------|-----|-------|
| border-default | #e2e8f0 | Default borders |
| border-muted | #cbd5e1 | Subtle borders |
| border-strong | #94a3b8 | Emphasized borders |
| border-focus | #0ea5e9 | Focus ring color |

## Typography

Typography defines the visual presentation of text content.

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| font-sans | Inter | Primary font for UI elements, body text |
| font-mono | JetBrains Mono | Code snippets, technical data |

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| text-xs | 12px | 16px | 400 | Captions, badges |
| text-sm | 14px | 20px | 400 | Secondary text, labels |
| text-base | 16px | 24px | 400 | Body text |
| text-lg | 18px | 28px | 500 | Subheadings |
| text-xl | 20px | 28px | 600 | Section headings |
| text-2xl | 24px | 32px | 600 | Page titles |
| text-3xl | 30px | 36px | 700 | Hero headings |
| text-4xl | 36px | 40px | 700 | Display text |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| font-normal | 400 | Regular text |
| font-medium | 500 | Emphasized text, subheadings |
| font-semibold | 600 | Headings, labels |
| font-bold | 700 | Display text, strong emphasis |

## Spacing

Spacing provides consistent layout rhythm throughout the interface.

### Base Unit

The base spacing unit is 4px. All spacing values derive from this unit.

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| space-0 | 0px | No spacing |
| space-1 | 4px | Tight spacing between related elements |
| space-2 | 8px | Default compact spacing |
| space-3 | 12px | Standard spacing between elements |
| space-4 | 16px | Default spacing for components |
| space-5 | 20px | Comfortable spacing |
| space-6 | 24px | Section spacing within components |
| space-8 | 32px | Large spacing between sections |
| space-10 | 40px | Section dividers |
| space-12 | 48px | Major section breaks |
| space-16 | 64px | Page section spacing |

### Component Spacing Conventions

| Context | Spacing | Token |
|---------|---------|-------|
| Button padding (horizontal) | 16px | space-4 |
| Button padding (vertical) | 8px | space-2 |
| Card padding | 24px | space-6 |
| Card gap | 16px | space-4 |
| Form field gap | 16px | space-4 |
| Page padding | 24px | space-6 |
| Section gap | 32px | space-8 |

## Border Radius

Border radius defines the curvature of element corners.

| Token | Value | Usage |
|-------|-------|-------|
| radius-none | 0px | Sharp corners (technical tables) |
| radius-sm | 4px | Small elements, badges |
| radius-md | 6px | Default for buttons, inputs |
| radius-lg | 8px | Cards, panels |
| radius-xl | 12px | Large cards, modals |
| radius-2xl | 16px | Feature cards |
| radius-full | 9999px | Pills, avatars, circular buttons |

## Shadows

Shadows create depth and hierarchy between UI layers.

| Token | Value | Usage |
|-------|-------|-------|
| shadow-xs | 0 1px 2px rgba(0,0,0,0.05) | Subtle elevation |
| shadow-sm | 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06) | Small cards, inputs |
| shadow-md | 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06) | Dropdowns, popovers |
| shadow-lg | 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05) | Modals, dialogs |
| shadow-xl | 0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04) | Large overlays |

## Component Conventions

### Buttons

Primary actions use the primary color palette.
Secondary actions use secondary colors or outlined styles.

| Variant | Usage |
|---------|-------|
| btn-primary | Main actions (Submit, Create, Save) |
| btn-secondary | Secondary actions (Cancel, Back) |
| btn-outline | Alternative secondary actions |
| btn-danger | Destructive actions (Delete, Remove) |
| btn-ghost | Tertiary actions, toolbar items |
| btn-icon | Icon-only buttons |

Button heights follow a standard scale: 32px (small), 40px (default),
48px (large).

### Form Inputs

Inputs use consistent styling with clear focus states.

- Border: border-default (1px solid)
- Focus: border-focus (2px ring)
- Border radius: radius-md
- Height: 40px (default), 32px (small), 48px (large)
- Padding: 12px horizontal

### Cards

Cards are used to group related content.
They have a white background on the secondary page background.

- Background: bg-primary
- Border: border-default
- Border radius: radius-lg
- Padding: 24px
- Shadow: shadow-sm

### Data Tables

Tables display structured data with clear rows and columns.

- Header: text-sm, font-semibold, text-secondary
- Row height: 48px
- Cell padding: 12px vertical, 16px horizontal
- Border: border-default
- Hover: bg-secondary

### Charts

Charts display time series data with prediction overlays.

- Line colors follow semantic mapping (actual vs predicted)
- Grid lines: border-muted
- Axis labels: text-xs, text-secondary
- Tooltip: shadow-md, radius-lg

## Page Structure

### Application Shell

The application uses a sidebar layout with a persistent left navigation.

```text
+------------------+----------------------------------------+
|                  |                                        |
|    Sidebar       |           Main Content Area            |
|    (240px)       |                                        |
|                  |                                        |
|  - Logo          |  +----------------------------------+  |
|  - Navigation    |  |       Page Header                 |  |
|  - Org switcher  |  |  (Title, breadcrumbs, actions)   |  |
|  - User menu     |  +----------------------------------+  |
|                  |  |                                   |  |
|                  |  |       Page Content                |  |
|                  |  |                                   |  |
|                  |  |                                   |  |
+------------------+----------------------------------------+
```

### Page Header

Each page has a consistent header structure:

- Page title: text-2xl, font-semibold
- Breadcrumbs: text-sm, text-secondary
- Page actions: Right-aligned buttons

### Sidebar Navigation

Navigation items grouped by function:

| Group | Items |
|-------|-------|
| Overview | Dashboard |
| Signals | Signals, Import, Sources |
| Analysis | Predictions, Playground |
| Events | Event Timeline, Alerts |
| Settings | Organization, Users, Notifications |

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Full-width, collapsible sidebar |
| Tablet | 640px - 1024px | Collapsed sidebar (icons only) |
| Desktop | > 1024px | Full sidebar (240px) |

## Stitch Sync Process

Designs created in Stitch are synchronized with this document to maintain
a single source of truth.

### Sync Workflow

1. Create or update design in Stitch
2. Export design tokens from Stitch
3. Update this document with new values
4. Commit changes with message: `docs(design): sync from Stitch`
5. Implementation team pulls latest design tokens

### Design Review

Designs should be reviewed and approved before implementation begins.
The review process:

1. Designer creates screen designs in Stitch
2. Stakeholders review and provide feedback
3. Approved designs are marked with approval comment
4. Implementation proceeds with approved designs

### Stitch Project Reference

**Project Name:** kairo
**Project ID:** 10542915137415484180
**Project URL:** https://stitch.firebase.google.com/projects/10542915137415484180

#### Phase 1 Screens (Pending Generation)

Due to Stitch API timeouts, Phase 1 screens require manual generation in Stitch:

| Screen | Description | Status |
|--------|-------------|--------|
| Login | Email/password + OAuth buttons | Pending |
| Dashboard Layout | Sidebar + main content area | Pending |
| Signal List | Table with filters and pagination | Pending |
| Signal Detail | Chart with metadata | Pending |
| Event Timeline | Timeline view with filters | Pending | |

#### Stitch Project Structure

The Kairo Stitch project contains:

| Folder | Contents |
|--------|----------|
| /screens/auth | Login, signup, password reset screens |
| /screens/dashboard | Main dashboard and overview |
| /screens/signals | Signal management and visualization |
| /screens/events | Event timeline and alert configuration |
| /screens/settings | Organization, user, notification settings |
| /components | Reusable component designs |

## Dark Mode

Dark mode support uses inverted color tokens with adjusted values
for reduced brightness.

| Token | Value | Usage |
|-------|-------|-------|
| dark-bg-primary | #0f172a | Page background |
| dark-bg-secondary | #1e293b | Card background |
| dark-bg-tertiary | #334155 | Elevated surfaces |
| dark-text-primary | #f8fafc | Primary text |
| dark-text-secondary | #cbd5e1 | Secondary text |
| dark-border-default | #334155 | Borders |

Dark mode is activated via user preference or system setting.
The implementation uses CSS custom properties for theme switching.

## Notification Channels Implementation (Phase 6)

### Channel Types

The notification system supports multiple channel types for delivering alerts:

| Type | Config Fields | Description |
|------|---------------|-------------|
| email | `email` | Email address for notifications |
| webhook | `url` | HTTP endpoint for POST notifications |
| telegram | `bot_token`, `chat_id` | Telegram bot for messaging |
| mqtt | `topic` | MQTT topic for IoT integrations |
| mcp | `server_url` | Model Context Protocol server |

### Environment Variables

Email notifications require SMTP configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| EMAIL_HOST | SMTP server hostname | localhost |
| EMAIL_PORT | SMTP server port | 587 |
| EMAIL_SECURE | Use TLS/SSL | false |
| EMAIL_USER | SMTP authentication user | - |
| EMAIL_PASS | SMTP authentication password | - |
| EMAIL_FROM | Sender email address | noreply@kairo.io |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications/channels | List all channels for org |
| POST | /api/notifications/channels | Create new channel |
| PATCH | /api/notifications/channels/[id] | Update channel (enabled, config) |
| DELETE | /api/notifications/channels/[id] | Delete channel |

### Learnings

1. **Channel type enum mismatch**: Frontend and backend must use same channel types.
   Initially had email/slack/webhook/sms but spec required email/webhook/telegram/mqtt/mcp.
   Fixed by updating both API route schema and frontend component.

2. **Config validation**: Each channel type has different config fields. The create
   form conditionally renders input fields based on selected channel type.

3. **Org isolation**: All queries filter by org_id from authenticated user's session.
   RLS policies provide additional database-level enforcement.
