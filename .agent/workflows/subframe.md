---
description: How to sync and use Subframe design system
---

# Subframe Sync Workflow

// turbo-all

## Sync Command
```bash
npx @subframe/cli@latest sync --all
```

## MANDATORY Design Rules

### 1. Always Use Subframe Components
```jsx
// ✅ CORRECT - Use Subframe Button
import { Button } from "../ui/components/Button";
<Button variant="brand-primary">Save</Button>

// ❌ WRONG - Custom button styling
<button className="bg-orange-500">Save</button>
```

### 2. Always Use Subframe Colors
```jsx
// ✅ CORRECT - Subframe semantic colors
bg-brand-600      // Primary (orange)
bg-brand-500      // Primary hover
bg-neutral-100    // Secondary backgrounds
bg-error-600      // Destructive actions

// ❌ WRONG - Tailwind color names
bg-orange-500     // Don't use
bg-purple-500     // Don't use
bg-zinc-950       // Don't use for brand elements
```

### 3. Component Priority
1. **First**: Check if Subframe has the component in `src/ui/components/`
2. **Second**: Use Subframe's color tokens (`bg-brand-*`, `bg-neutral-*`)
3. **Last resort**: Custom component with Subframe colors only

### 4. Available Variants
```jsx
// Button variants
<Button variant="brand-primary" />      // Orange (main actions)
<Button variant="brand-secondary" />    // Orange outline
<Button variant="neutral-secondary" />  // Gray outline
<Button variant="destructive-primary"/> // Red (delete)

// Badge variants
<Badge variant="brand" />     // Orange
<Badge variant="neutral" />   // Gray
<Badge variant="success" />   // Green
<Badge variant="error" />     // Red
```

### 5. Before Creating Custom Styles
Always check:
- `src/ui/components/` for existing components
- `src/ui/src/subframe.css` for available color tokens
