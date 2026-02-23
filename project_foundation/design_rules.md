# Dreamlab Design Rules

> **Design System**: [Subframe](https://subframe.com) — Connected via CLI  
> **Project ID**: `1705d9930727`

---

> [!IMPORTANT]
> **SUBFRAME-FIRST**: Always use Subframe components and color tokens before creating custom styles.
> - Components: `src/ui/components/`
> - Colors: `bg-brand-*`, `bg-neutral-*`, `bg-error-*` (NOT Tailwind colors like `bg-orange-500`)
> - Sync: `npx @subframe/cli@latest sync --all`
>
> **NO EMOJIS**: Do not use emojis in the UI. Use Subframe Feather icons (`@subframe/core`) instead.

---

## Design System Overview

Dreamlab Canvas uses **Subframe** as its primary design system. All UI components should be imported from `@subframe/core` or the local `src/ui/components/` directory synced from Subframe.

### CLI Commands
```bash
# Sync components from Subframe
npx subframe sync

# Authenticate (if needed)
npx subframe auth
```

---

## Available Components

### Core UI Components
| Component | Import Path | Usage |
|-----------|-------------|-------|
| `Button` | `src/ui/components/Button` | Primary actions, CTAs |
| `IconButton` | `src/ui/components/IconButton` | Icon-only actions |
| `TextField` | `src/ui/components/TextField` | Text inputs with labels |
| `TextArea` | `src/ui/components/TextArea` | Multi-line text input |
| `Select` | `src/ui/components/Select` | Dropdown selections |
| `Checkbox` | `src/ui/components/Checkbox` | Boolean toggles |
| `Switch` | `src/ui/components/Switch` | On/off toggles |
| `Slider` | `src/ui/components/Slider` | Range inputs |
| `Badge` | `src/ui/components/Badge` | Status indicators, tags |
| `Avatar` | `src/ui/components/Avatar` | User/workspace icons |
| `Tooltip` | `src/ui/components/Tooltip` | Hover hints |

### Layout Components
| Component | Import Path | Usage |
|-----------|-------------|-------|
| `Dialog` | `src/ui/components/Dialog` | Modal dialogs |
| `Drawer` | `src/ui/components/Drawer` | Slide-out panels |
| `DropdownMenu` | `src/ui/components/DropdownMenu` | Context menus |
| `ContextMenu` | `src/ui/components/ContextMenu` | Right-click menus |
| `Tabs` | `src/ui/components/Tabs` | Tab navigation |
| `Accordion` | `src/ui/components/Accordion` | Collapsible sections |

### Navigation Components
| Component | Import Path | Usage |
|-----------|-------------|-------|
| `Breadcrumbs` | `src/ui/components/Breadcrumbs` | Path navigation |
| `Stepper` | `src/ui/components/Stepper` | Multi-step flows |
| `ToggleGroup` | `src/ui/components/ToggleGroup` | View mode switches |
| `SidebarWithSections` | `src/ui/components/SidebarWithSections` | Main navigation |
| `ChatChannelsMenu` | `src/ui/components/ChatChannelsMenu` | Project lists |

### Feedback Components
| Component | Import Path | Usage |
|-----------|-------------|-------|
| `Alert` | `src/ui/components/Alert` | Inline messages |
| `Toast` | `src/ui/components/Toast` | Temporary notifications |
| `Progress` | `src/ui/components/Progress` | Loading states |
| `Loader` | `src/ui/components/Loader` | Spinners |

### Data Display
| Component | Import Path | Usage |
|-----------|-------------|-------|
| `Table` | `src/ui/components/Table` | Tabular data |
| `TreeView` | `src/ui/components/TreeView` | Hierarchical lists |
| `AreaChart` | `src/ui/components/AreaChart` | Charts |
| `BarChart` | `src/ui/components/BarChart` | Charts |
| `PieChart` | `src/ui/components/PieChart` | Charts |

---

## Icons

### Primary: Subframe Core Icons
Import icons from `@subframe/core`:
```tsx
import { FeatherSearch, FeatherFilter, FeatherTrash } from "@subframe/core";
```

### Naming Convention
All Feather icons are prefixed with `Feather`:
- `FeatherSearch` → Search icon
- `FeatherPlus` → Plus icon
- `FeatherX` → Close icon
- `FeatherSave` → Save icon
- `FeatherTrash` → Delete icon
- `FeatherFilter` → Filter icon
- `FeatherDownload` → Download icon
- `FeatherCopy` → Copy icon
- `FeatherExternalLink` → External link icon

### Icon Sizing
Icons inherit size from their container. Use className or wrapper for sizing:
```tsx
<FeatherSearch className="w-4 h-4" />
<FeatherSearch className="w-5 h-5" />
```

---

## Button Variants

```tsx
import { Button } from "src/ui/components/Button";

// Primary (brand color)
<Button variant="brand-primary">Save</Button>

// Secondary
<Button variant="neutral-secondary">Cancel</Button>

// Tertiary (ghost)
<Button variant="neutral-tertiary">Reset</Button>

// Destructive
<Button variant="destructive-primary">Delete</Button>
<Button variant="destructive-tertiary">Remove</Button>

// With icon
<Button icon={<FeatherSave />}>Save Changes</Button>

// Sizes
<Button size="small">Small</Button>
<Button size="medium">Medium</Button>
<Button size="large">Large</Button>
```

---

## Typography Classes

Subframe provides semantic typography classes:

| Class | Usage |
|-------|-------|
| `text-heading-1 font-heading-1` | Page titles |
| `text-heading-2 font-heading-2` | Section headers |
| `text-heading-3 font-heading-3` | Subsection headers |
| `text-body font-body` | Body text |
| `text-body-bold font-body-bold` | Emphasized body |
| `text-caption font-caption` | Small labels |
| `text-caption-bold font-caption-bold` | Emphasized labels |

### Text Colors
| Class | Usage |
|-------|-------|
| `text-default-font` | Primary text |
| `text-subtext-color` | Secondary/muted text |
| `text-error-600` | Error states |
| `text-neutral-500` | Disabled text |

---

## Color System

### Semantic Colors (via Tailwind)
```css
/* Neutrals */
neutral-50, neutral-100, neutral-200, neutral-300, neutral-400
neutral-500, neutral-600, neutral-700, neutral-800, neutral-900, neutral-950

/* Brand */
brand-primary (orange/red accent)

/* Semantic */
error-600    /* Destructive actions */
success-600  /* Success states */
warning-600  /* Warning states */

/* Borders */
neutral-border  /* Default borders */
```

### Background Colors
```tsx
bg-white           // Primary surfaces
bg-neutral-50      // Secondary surfaces
bg-neutral-100     // Tertiary/hover states
bg-default-background  // Page background
```

---

## Layout Patterns

### Modal Dialog (ItemModal pattern)
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 backdrop-blur-sm">
  <div className="flex w-full max-w-[1280px] flex-col rounded-lg bg-white shadow-lg">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-neutral-200 px-8 py-6">
      ...
    </div>
    
    {/* Content */}
    <div className="flex w-full items-start">
      {/* Left panel */}
      <div className="flex grow basis-0 flex-col border-r border-neutral-200 p-4">
        ...
      </div>
      {/* Right panel */}
      <div className="flex max-w-[448px] grow basis-0 flex-col gap-6 px-8 py-8">
        ...
      </div>
    </div>
    
    {/* Footer */}
    <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-8 py-6">
      ...
    </div>
  </div>
</div>
```

### Floating Search Bar
```tsx
<div className="fixed bottom-8 left-1/2 z-10 -translate-x-1/2 flex items-center gap-3 rounded-full border border-neutral-border bg-white px-4 py-4 focus-within:shadow-[0px_0px_32px_-4px_rgba(234,88,12,0.3)]">
  <TextField icon={<FeatherSearch />}>
    <TextField.Input placeholder="Search..." />
  </TextField>
  <Button variant="neutral-secondary" icon={<FeatherFilter />}>
    Filter
  </Button>
</div>
```

### Section Labels
```tsx
<span className="text-caption-bold font-caption-bold text-neutral-500 uppercase text-xs font-semibold">
  LABEL
</span>
```

---

## Spacing & Layout

### Base Unit: 4px
Use Tailwind spacing classes (multiples of 4px):

| Class | Value |
|-------|-------|
| `gap-1` | 4px |
| `gap-2` | 8px |
| `gap-3` | 12px |
| `gap-4` | 16px |
| `gap-6` | 24px |
| `gap-8` | 32px |

### Common Patterns
- **Page padding**: `px-8 py-8`
- **Section gaps**: `gap-6`
- **Card padding**: `p-4` or `p-6`
- **Modal padding**: `px-8 py-6`

### Border Radius
- **Small** (inputs, badges): `rounded-md` (6px)
- **Medium** (cards): `rounded-lg` (8px)
- **Large** (modals): `rounded-lg` (8px)
- **Pill** (search bar): `rounded-full`

---

## Borders & Shadows

### Borders
```css
border border-solid border-neutral-200    /* Default */
border border-solid border-neutral-border /* Semantic */
```

### Shadows
```css
shadow-sm     /* Subtle elevation */
shadow-lg     /* Modal/dropdown */
```

### Focus States
```css
focus-within:shadow-[0px_0px_32px_-4px_rgba(234,88,12,0.3)]  /* Brand glow */
```

---

## Animation & Transitions

### Use Framer Motion for:
- Modal enter/exit
- Page transitions
- Staggered list animations

### Timing
- **Micro-interactions**: 100-150ms
- **Transitions**: 200-300ms
- **Page transitions**: 300ms

---

## Import Conventions

```tsx
// Subframe core icons
import { FeatherX, FeatherSave, FeatherTrash } from "@subframe/core";

// Subframe components (local)
import { Button } from "../ui/components/Button";
import { TextField } from "../ui/components/TextField";
import { Dialog } from "../ui/components/Dialog";
import { Select } from "../ui/components/Select";
import { Badge } from "../ui/components/Badge";
import { Avatar } from "../ui/components/Avatar";
import { IconButton } from "../ui/components/IconButton";
import { ToggleGroup } from "../ui/components/ToggleGroup";
import { Slider } from "../ui/components/Slider";
```

---

## Reference Links

- [Subframe Documentation](https://subframe.com/docs)
- [Subframe CLI](https://www.npmjs.com/package/@subframe/cli)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)

