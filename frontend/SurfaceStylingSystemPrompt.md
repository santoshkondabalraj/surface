# Surface Dashboard Styling System Prompt

**Version:** 1.0  
**Last Updated:** 2026-07-17  
**Brand:** Surface (Powered by Plantrix™)

---

## 📋 PURPOSE

This document serves as the authoritative styling guide for the Surface dashboard. Use this prompt to instruct Claude or any developer on maintaining design consistency, visual hierarchy, and professional appearance across all components and features.

---

## 🎨 BRAND IDENTITY

### Logo & Branding
- **Brand Name:** Surface
- **Tagline:** Powered by Plantrix™
- **Logo Design:** Circular purple gradient with data-flow line (horizontal line representing data flow)
- **Logo Colors:** Gradient from `purple-600` to `purple-400`
- **Logo Size in Header:** `w-8 h-8` container

### Brand Personality
- Professional, enterprise-grade
- Refined, not aggressive
- Clean, minimal aesthetic
- Information-focused
- Accessible and inclusive

---

## 🎨 COLOR PALETTE

### Primary Colors

| Color | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Purple (Primary Accent) | #9333EA | `purple-600` | Buttons, active tabs, hover states, links |
| Purple (Dark Mode) | #A78BFA | `purple-400` | Dark mode accent variant |
| Slate (Primary Content) | #374151 | `slate-700` | Text, headings, borders |
| Slate (Dark Mode) | #E2E8F0 | `slate-300` | Dark mode text variant |

### Secondary Colors

| Color | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Green (Success) | #16A34A | `green-600` | Success states, positive metrics |
| Red (Error) | #DC2626 | `red-600` | Error states, alerts, severity high |
| Yellow (Warning) | #EAB308 | `yellow-500` | Warning states, in-progress |
| Blue (Info) | #2563EB | `blue-600` | Info states, secondary actions |

### Neutral Colors

| Color | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| White | #FFFFFF | `white` | Backgrounds, cards |
| Slate 50 | #F8FAFC | `slate-50` | Light backgrounds |
| Slate 100 | #F1F5F9 | `slate-100` | Light borders, badges |
| Slate 200 | #E2E8F0 | `slate-200` | Borders |
| Slate 700 | #374151 | `slate-700` | Dark mode backgrounds |
| Slate 800 | #1E293B | `slate-800` | Dark mode raised surfaces |
| Slate 900 | #0F172A | `slate-900` | Dark mode deep backgrounds |
| Slate 950 | #020617 | `slate-950` | Dark mode near-black |

---

## 🎯 COLOR USAGE GUIDELINES

### Rule 1: Purple as Accent Only
- **DO:** Use purple for buttons, active tabs, hover states, primary CTAs
- **DON'T:** Use purple for headings, body text, badges, descriptive content
- **Why:** Maintains visual hierarchy and prevents aggressive UI

### Rule 2: Slate/Gray for Content
- **DO:** Use slate for headings, body text, borders, structural elements
- **DON'T:** Use purple for content information
- **Why:** Content should be neutral and readable; purple is reserved for interaction

### Rule 3: Semantic Colors for Status
- **Green:** Success, active, positive
- **Red:** Error, high severity, attention-required
- **Yellow:** Warning, medium severity, in-progress
- **Blue:** Info, secondary action, available

---

## 🔘 BUTTON SIZING & STYLING

### Standard Button Specifications

| Button Type | Padding | Font Size | Font Weight | Usage |
|------------|---------|-----------|-------------|-------|
| Primary CTA | `px-3 py-1.5` | `text-xs` | `font-medium` | Create, Save, Submit actions |
| Secondary | `px-3 py-1` | `text-xs` | `font-medium` | Alternative actions |
| Small | `px-2 py-1` | `text-xs` | `font-medium` | Minor actions, View, Edit |
| Tertiary | None (text only) | `text-sm` | `font-medium` | Links, Cancel, Close |

### Button Color Combinations

```
Primary (Purple):
  bg-purple-600 hover:bg-purple-700 text-white

Secondary (Blue):
  bg-blue-600 hover:bg-blue-700 text-white

Tertiary (Slate):
  bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200

Danger (Red):
  bg-red-600 hover:bg-red-700 text-white
```

### Button Examples

**Create Role, Create Group, Add User:**
```html
<button class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-xs transition-colors">
  Create Role
</button>
```

**Test Connection, Save Configuration:**
```html
<button class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-xs transition-colors">
  Save Configuration
</button>
```

**View Data, Secondary Actions:**
```html
<button class="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs hover:bg-slate-200 transition-colors">
  View Data
</button>
```

---

## 📝 TYPOGRAPHY GUIDELINES

### Heading Sizes

| Level | Size | Font Weight | Color | Usage |
|-------|------|-------------|-------|-------|
| H1 (Page Title) | `text-lg` | `font-semibold` | `text-slate-900 dark:text-white` | Page/section headers |
| H2 (Section) | `text-base` | `font-semibold` | `text-slate-900 dark:text-white` | Major subsections |
| H3 (Subsection) | `text-sm` | `font-semibold` | `text-slate-900 dark:text-white` | Minor subsections |
| Body | `text-sm` | `font-normal` | `text-slate-700 dark:text-slate-300` | Paragraphs, descriptions |
| Small | `text-xs` | `font-normal` | `text-slate-600 dark:text-slate-400` | Captions, hints |
| Tiny | `text-xs` | `font-normal` | `text-slate-500 dark:text-slate-500` | Metadata, timestamps |

### Typography Examples

**Page Title:**
```html
<h1 class="text-lg font-semibold text-slate-900 dark:text-white">
  Manage Roles
</h1>
```

**Section Header:**
```html
<h2 class="text-base font-semibold text-slate-900 dark:text-white">
  Create New Role
</h2>
```

**Body Text:**
```html
<p class="text-sm text-slate-700 dark:text-slate-300">
  Manage user roles and permissions
</p>
```

**Description/Caption:**
```html
<p class="text-xs text-slate-600 dark:text-slate-400">
  Select permissions for this role
</p>
```

---

## 🏷️ BADGE & TAG STYLING

### Permission Badges
**Style:** Neutral, non-prominent
```html
<span class="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full">
  read_orders
</span>
```

### Status Badges
**Active:** Green
```html
<span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
  ● active
</span>
```

**Warning:** Yellow
```html
<span class="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
  ⚠ in-progress
</span>
```

**Error/High Severity:** Red
```html
<span class="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
  ● high
</span>
```

### Type Badges
**Golden (Dataset Type):**
```html
<span class="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
  golden
</span>
```

**Test (Dataset Type):**
```html
<span class="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
  test
</span>
```

---

## 📐 SPACING & PADDING CONVENTIONS

### Container Padding
- **Page/Section:** `p-6`
- **Card/Box:** `p-4`
- **Form Group:** `gap-4`
- **List Item:** `gap-3` or `gap-2`

### Margin & Gaps
- **Large Gap:** `gap-6` or `mb-6`
- **Medium Gap:** `gap-4` or `mb-4`
- **Small Gap:** `gap-3` or `mb-3`
- **Tiny Gap:** `gap-2` or `mb-2`
- **Minimal Gap:** `gap-1` or `mb-1`

### Border Radius
- **Standard Buttons:** `rounded-lg`
- **Cards/Boxes:** `rounded-lg`
- **Badges:** `rounded-full`
- **Subtle Elements:** `rounded-md`

---

## 🔄 FORM ELEMENTS

### Input Fields
```html
<input
  type="text"
  placeholder="Role name (e.g., Manager)"
  class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
/>
```

### Textareas
```html
<textarea
  placeholder="Role description"
  class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
  rows="2"
></textarea>
```

### Checkboxes
```html
<input
  type="checkbox"
  class="rounded w-4 h-4 cursor-pointer accent-purple-600"
/>
```

---

## 📊 CARD & BOX STYLING

### Standard Card
```html
<div class="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50">
  <!-- content -->
</div>
```

### Highlighted/Background Card
```html
<div class="bg-slate-50/30 dark:bg-slate-800/30 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
  <!-- content -->
</div>
```

### Transparent Card
```html
<div class="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
  <!-- content -->
</div>
```

---

## 🎯 INTERACTIVE ELEMENTS

### Tab Styling

**Active Tab:**
```html
<button class="px-3 py-2 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600">
  Tab Label
</button>
```

**Inactive Tab:**
```html
<button class="px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent">
  Tab Label
</button>
```

### Hover States
- All interactive elements: Add `hover:` variants
- Buttons: `hover:opacity-80` or `hover:bg-[shade+1]`
- Cards: `hover:border-purple-200` or `hover:shadow-sm`
- Text: `hover:text-purple-700`

---

## 🌙 DARK MODE GUIDELINES

### Dark Mode Colors
- **Background:** `dark:bg-slate-950` (page), `dark:bg-slate-900` (sections), `dark:bg-slate-800/50` (cards)
- **Text:** `dark:text-white` (primary), `dark:text-slate-300` (secondary), `dark:text-slate-400` (tertiary)
- **Borders:** `dark:border-slate-700` or `dark:border-slate-600`
- **Hover:** `dark:hover:bg-slate-700` or similar shade

### Dark Mode Pattern
Always provide both light and dark variants:
```html
class="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
```

---

## 📱 RESPONSIVE DESIGN

### Breakpoints (Tailwind Standard)
- Mobile: Default (no prefix)
- Tablet: `md:` (768px)
- Desktop: `lg:` (1024px)
- Large Desktop: `xl:` (1280px)

### Grid Layouts
- **2-Column Grid:** `grid-cols-2` (desktop)
- **3-Column Grid:** `grid-cols-3` (desktop)
- **Responsive:** `grid-cols-1 md:grid-cols-2` (mobile → tablet)

---

## 🎨 SPECIFIC COMPONENT GUIDELINES

### Administration Panels

**BRAND_COLOR Constant (used across all admin panels):**
```typescript
const BRAND_COLOR = {
  light: "text-slate-700",           // NOT purple
  border: "border-slate-200",        // Neutral borders
  bg: "bg-slate-50/30",              // Subtle background
  dark: "text-slate-300",            // Dark mode text
};
```

**Philosophy:**
- Headings: Use `text-slate-700 dark:text-white` (neutral, professional)
- Purple: Reserve for buttons and interactive states only
- Badges: Use `bg-slate-100 text-slate-600` (don't use purple)

### Button Rules in Admin Panels
1. **Size:** Always `px-3 py-1.5` with `text-xs` for CTA buttons
2. **Color:** `bg-purple-600 hover:bg-purple-700 text-white`
3. **Rounded:** `rounded-lg` for full-width forms, `rounded` for small buttons
4. **Transition:** Always include `transition-colors`

### Tab Interface Rules
1. **Active Tab:** Purple background + border + purple text
2. **Inactive Tab:** Gray background + hover effect
3. **Font:** `font-medium text-sm`
4. **Icons:** Include icon before label with `mr-2`

---

## 🚫 COMMON ANTI-PATTERNS TO AVOID

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|----------------|------------------|
| Using purple for heading text | Too aggressive, breaks hierarchy | Use `text-slate-700` for headings |
| Large buttons (`px-4 py-2`) | Unbalanced, unprofessional | Use `px-3 py-1.5` with `text-xs` |
| Bright purple badges | Visually distracting, noisy | Use neutral gray `bg-slate-100 text-slate-600` |
| Inconsistent button sizing | Looks unprofessional, confusing | Standardize all to `px-3 py-1.5 text-xs` |
| Multiple colors per section | Too busy, poor visual hierarchy | Use slate for content, purple for action |
| Missing dark mode variants | Broken on dark mode | Always include `dark:` classes |
| Large font on buttons | Looks unprofessional | Use `text-xs` for consistency |

---

## ✅ CHECKLIST FOR NEW COMPONENTS

When adding new features or components, use this checklist:

- [ ] **Colors:** Headings in `text-slate-700`, buttons in purple
- [ ] **Button Size:** `px-3 py-1.5 text-xs` for CTAs, `px-2 py-1 text-xs` for secondary
- [ ] **Dark Mode:** All colors have `dark:` variants
- [ ] **Spacing:** Consistent padding (`p-4`, `p-6`) and gaps (`gap-3`, `gap-4`)
- [ ] **Typography:** Proper heading hierarchy (H1 `text-lg`, H2 `text-base`, H3 `text-sm`)
- [ ] **Badges:** Neutral gray (`bg-slate-100 text-slate-600`), not purple
- [ ] **Borders:** `border-slate-200 dark:border-slate-700`
- [ ] **Hover States:** All interactive elements have hover variants
- [ ] **Rounded Corners:** Consistent `rounded-lg` for cards/buttons
- [ ] **Transitions:** Smooth `transition-colors` on all interactive elements

---

## 📚 REFERENCE IMPLEMENTATIONS

### Creating a Card with Form
```html
<div class="bg-slate-50/30 dark:bg-slate-800/30 rounded-lg p-6 border border-slate-200 dark:border-slate-700 mb-6">
  <h2 class="text-base font-semibold text-slate-900 dark:text-white mb-4">
    Create New Role
  </h2>
  
  <div class="space-y-4">
    <input
      type="text"
      placeholder="Role name (e.g., Manager)"
      class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
    />
    
    <button
      class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-xs transition-colors"
    >
      Create Role
    </button>
  </div>
</div>
```

### Tab Navigation
```html
<div class="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-x-auto">
  <div class="flex gap-1 p-2 min-w-min">
    <button class="px-3 py-2 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600">
      Active Tab
    </button>
    <button class="px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent">
      Inactive Tab
    </button>
  </div>
</div>
```

---

## 🎯 PROMPT USAGE INSTRUCTIONS

**When asking Claude to build new features:**

1. Copy the relevant section from this document
2. Include it in your prompt like:
   ```
   Follow the Surface Styling System:
   - Use slate-700 for headings (not purple)
   - Buttons should be px-3 py-1.5 text-xs
   - Include dark mode variants for all colors
   - See SurfaceStylingSystemPrompt.md for full guidelines
   ```

3. Refer to specific sections for complex components
4. Use the anti-patterns section to call out what NOT to do

---

## 📝 UPDATES & VERSIONING

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-17 | Initial system documentation. Includes button sizing, color usage, typography, dark mode, and component guidelines. |

---

**Created:** 2026-07-17  
**Maintained By:** Design & Frontend Team  
**Review Frequency:** Quarterly or as needed
