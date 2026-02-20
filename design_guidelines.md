{
  "project": {
    "name": "Shumard (Lead Tracking SaaS)",
    "goal": "Revamp from dark theme to a clean light SaaS dashboard matching the provided reference: warm beige outer canvas, white rounded main card, horizontal top tab navigation, orange primary CTA, table-centric pages with pagination.",
    "audience": ["Marketing professionals", "Webinar hosts", "Lead-gen teams"],
    "success_actions": [
      "Find a lead fast (search + filters)",
      "Scan table efficiently (sorting, badges, row hover)",
      "Bulk-select and delete safely",
      "Open contact detail modal quickly",
      "Navigate modules via top tabs"
    ]
  },

  "visual_personality": {
    "keywords": ["warm", "trustworthy", "calm", "high-clarity", "table-forward", "subtle premium"],
    "style_mix": [
      "Swiss-style information density (tables, typographic hierarchy)",
      "Soft editorial warmth (beige canvas + off-white surfaces)",
      "Modern SaaS chrome (pill tabs, compact toolbars, micro-interactions)"
    ],
    "do_not": [
      "Do not reintroduce dark theme.",
      "Do not add a left sidebar—navigation must be horizontal at top of the white card.",
      "Do not center align whole app container.",
      "Do not use purple (especially not for AI-like vibes)."
    ]
  },

  "typography": {
    "fonts": {
      "display": {
        "family": "Space Grotesk",
        "usage": "App title, page titles, KPI headings",
        "css": ".font-display / h1-h6 already map to Space Grotesk in index.css"
      },
      "body": {
        "family": "Work Sans",
        "usage": "All UI text, tables, filters",
        "css": "body already uses Work Sans"
      },
      "mono": {
        "family": "IBM Plex Mono",
        "usage": "Script snippet on /visitors (embed code), technical IDs"
      }
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs text-muted-foreground",
      "table_header": "text-xs uppercase tracking-wide"
    },
    "type_rules": [
      "Tables: use tabular numerals when showing counts/dates if possible (Tailwind: tabular-nums).",
      "Prefer short labels + helper tooltips over long labels.",
      "Use uppercase only for table headers and small section labels (not buttons)."
    ]
  },

  "color_system": {
    "reference_mapping": {
      "outer_background": "#ede9e3",
      "card_background": "#ffffff",
      "primary": "#f97316",
      "text": "#111827",
      "muted_text": "#6b7280",
      "border": "#e5e7eb"
    },
    "tokens_css_vars": {
      "instruction": "Main agent should replace dark-first tokens in /app/frontend/src/index.css :root with these HSL tokens for shadcn + add/replace custom semantic tokens. Keep radius ~16px.",
      "shadcn_hsl": {
        "--background": "30 22% 96%",
        "--foreground": "222 47% 11%",
        "--card": "0 0% 100%",
        "--card-foreground": "222 47% 11%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "222 47% 11%",
        "--primary": "24 95% 53%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "30 18% 92%",
        "--secondary-foreground": "222 47% 11%",
        "--muted": "30 14% 93%",
        "--muted-foreground": "215 16% 47%",
        "--accent": "30 18% 92%",
        "--accent-foreground": "222 47% 11%",
        "--destructive": "0 84% 60%",
        "--destructive-foreground": "0 0% 100%",
        "--border": "214 20% 90%",
        "--input": "214 20% 90%",
        "--ring": "24 95% 53%",
        "--radius": "1rem"
      },
      "semantic_hex": {
        "--app-canvas": "#ede9e3",
        "--surface": "#ffffff",
        "--surface-2": "#fbfaf8",
        "--text": "#111827",
        "--text-muted": "#6b7280",
        "--text-dimmer": "#9ca3af",
        "--stroke": "#e5e7eb",
        "--stroke-soft": "#f1f5f9",
        "--primary-orange": "#f97316",
        "--primary-orange-hover": "#ea580c",
        "--focus": "rgba(249, 115, 22, 0.35)",
        "--shadow": "0 10px 30px rgba(17, 24, 39, 0.08)",
        "--shadow-soft": "0 6px 18px rgba(17, 24, 39, 0.06)"
      }
    },
    "badges": {
      "instruction": "Source badges must be subtle (tinted background + dark text), not neon.",
      "palette": {
        "direct": {"bg": "#fff7ed", "text": "#9a3412", "border": "#fed7aa"},
        "google": {"bg": "#eff6ff", "text": "#1d4ed8", "border": "#bfdbfe"},
        "linkedin": {"bg": "#eef2ff", "text": "#3730a3", "border": "#c7d2fe"},
        "referral": {"bg": "#ecfdf5", "text": "#047857", "border": "#a7f3d0"},
        "unknown": {"bg": "#f8fafc", "text": "#334155", "border": "#e2e8f0"}
      }
    },
    "gradients_and_textures": {
      "allowed_usage": [
        "Only tiny decorative accents (<= 20% viewport) in hero-like top area of card header.",
        "Use as a soft corner glow behind page title area, not under tables."
      ],
      "safe_gradient_examples": [
        "radial-gradient(600px 200px at 20% 0%, rgba(249,115,22,0.14), rgba(249,115,22,0) 60%)",
        "radial-gradient(600px 200px at 80% 0%, rgba(244,63,94,0.08), rgba(244,63,94,0) 60%)"
      ],
      "noise": {
        "instruction": "Keep the existing noise-overlay concept but reduce opacity for light theme (0.02–0.035). Apply to app canvas only, not inside tables."
      }
    }
  },

  "layout_and_grid": {
    "canvas": {
      "outer": "Full viewport warm beige canvas (#ede9e3).",
      "inner": "Centered-but-not-text-centered white card container with max-w (e.g., max-w-6xl) and generous padding.",
      "padding": "px-4 sm:px-6 lg:px-8; vertical: py-6 sm:py-8",
      "card": "rounded-2xl border border-stroke shadow-[var(--shadow)]"
    },
    "structure": {
      "top_area": [
        "Top nav lives INSIDE the white card as a horizontal bar.",
        "Below nav: page header (title + optional actions).",
        "Below header: filter toolbar.",
        "Main: table in a Card or table container.",
        "Bottom: pagination bar."
      ]
    },
    "responsive": {
      "mobile_first_rules": [
        "On mobile: top nav becomes horizontally scrollable tabs (overflow-x-auto, hide scrollbar).",
        "Toolbar stacks: search full width, filters in 2-column grid, then actions.",
        "Table: allow horizontal scroll (ScrollArea) + sticky header optional.",
        "Pagination collapses: show previous/next + current page; move go-to-page input into a popover or second row."
      ]
    }
  },

  "components": {
    "component_path": {
      "shadcn": {
        "layout": [
          "/app/frontend/src/components/ui/card.jsx",
          "/app/frontend/src/components/ui/separator.jsx"
        ],
        "nav": [
          "/app/frontend/src/components/ui/tabs.jsx (for tab-like nav)",
          "/app/frontend/src/components/ui/navigation-menu.jsx (optional for overflow)"
        ],
        "forms_filters": [
          "/app/frontend/src/components/ui/input.jsx",
          "/app/frontend/src/components/ui/select.jsx",
          "/app/frontend/src/components/ui/popover.jsx",
          "/app/frontend/src/components/ui/calendar.jsx",
          "/app/frontend/src/components/ui/button.jsx",
          "/app/frontend/src/components/ui/checkbox.jsx"
        ],
        "data": [
          "/app/frontend/src/components/ui/table.jsx",
          "/app/frontend/src/components/ui/pagination.jsx",
          "/app/frontend/src/components/ui/badge.jsx",
          "/app/frontend/src/components/ui/skeleton.jsx",
          "/app/frontend/src/components/ui/scroll-area.jsx",
          "/app/frontend/src/components/ui/tooltip.jsx"
        ],
        "overlays": [
          "/app/frontend/src/components/ui/dialog.jsx (centered contact details)",
          "/app/frontend/src/components/ui/sheet.jsx (optional slide-in detail)",
          "/app/frontend/src/components/ui/alert-dialog.jsx (bulk delete confirmation)",
          "/app/frontend/src/components/ui/sonner.jsx (toasts)"
        ],
        "identity": [
          "/app/frontend/src/components/ui/avatar.jsx",
          "/app/frontend/src/components/ui/dropdown-menu.jsx"
        ]
      },
      "notes": [
        "Project uses .jsx components (not .tsx). Keep any new components in .jsx.",
        "Avoid raw HTML dropdown/calendar/toast; use shadcn components above."
      ]
    },

    "top_nav_spec": {
      "left": {
        "brand": "Shumard wordmark (text) + small mark (optional).",
        "tabs": [
          {"key": "leads", "label": "Leads", "icon": "Users"},
          {"key": "visitors", "label": "Visitors", "icon": "Globe"},
          {"key": "analytics", "label": "Analytics", "icon": "BarChart3"},
          {"key": "logs", "label": "Logs", "icon": "List"}
        ]
      },
      "right": {
        "controls": [
          "Icon button: search",
          "Icon button: bell",
          "Avatar with initials",
          "Company + user name dropdown (chevron)"
        ]
      },
      "active_tab": {
        "style": "pill with orange background and white text",
        "classes": "rounded-full bg-[var(--primary-orange)] text-white shadow-sm",
        "inactive": "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      },
      "data_testids": {
        "nav": "top-nav",
        "tab": "top-nav-tab-<route>",
        "user_menu": "top-nav-user-menu",
        "notif": "top-nav-notifications-button",
        "global_search": "top-nav-search-button"
      }
    },

    "filter_toolbar_spec": {
      "layout": "Inside a Card with subtle border; use flex-wrap gap-2/3; include 'Manage columns' and 'More' actions on the right.",
      "controls": [
        {
          "type": "search",
          "component": "Input",
          "placeholder": "Search name, email, phone",
          "data-testid": "leads-filter-search-input"
        },
        {
          "type": "source",
          "component": "Select",
          "data-testid": "leads-filter-source-select"
        },
        {
          "type": "date_range",
          "component": "Popover + Calendar (range mode)",
          "data-testid": "leads-filter-date-range"
        },
        {
          "type": "rows_per_page",
          "component": "Select",
          "data-testid": "leads-filter-rows-per-page"
        },
        {
          "type": "manage_columns",
          "component": "DropdownMenu",
          "data-testid": "leads-manage-columns-button"
        },
        {
          "type": "more",
          "component": "DropdownMenu",
          "data-testid": "leads-more-actions-button"
        }
      ],
      "bulk_actions": {
        "when": ">=1 row selected",
        "show": ["Selected count badge", "Bulk delete button"],
        "data_testids": {
          "bulk_bar": "leads-bulk-actions-bar",
          "bulk_delete": "leads-bulk-delete-button"
        }
      }
    },

    "table_spec": {
      "container": "Card or div with border border-stroke rounded-xl overflow-hidden",
      "header": "White background, uppercase small gray, sticky optional",
      "row": {
        "default": "border-b border-slate-100",
        "hover": "bg-slate-50",
        "selected": "bg-orange-50"
      },
      "cells": {
        "primary_text": "text-slate-900",
        "secondary": "text-slate-600 text-sm",
        "numbers": "tabular-nums"
      },
      "sort_icons": "Use lucide-react ArrowUpDown aligned right; only show on hover or muted by default",
      "checkbox": {
        "component": "Checkbox",
        "data_testids": {
          "header": "leads-table-select-all-checkbox",
          "row": "leads-table-row-select-checkbox-<id>"
        }
      },
      "row_click": {
        "behavior": "Click row opens contact detail modal/sheet; keep action buttons (edit/delete) stopping propagation.",
        "data-testid": "leads-table-row-<id>"
      },
      "action_icons": {
        "edit": {"icon": "Pencil", "data-testid": "leads-row-edit-button-<id>"},
        "delete": {"icon": "Trash2", "data-testid": "leads-row-delete-button-<id>"}
      },
      "empty_state": {
        "style": "Centered in table area with soft icon, title, helper text, and reset filters button",
        "data-testid": "leads-table-empty-state"
      },
      "loading_state": {
        "use": "Skeleton rows (5–8) + muted shimmer",
        "data-testid": "leads-table-loading"
      }
    },

    "pagination_spec": {
      "layout": "Bottom bar with 3 regions: left 'Showing X–Y of Z', center page numbers, right go-to-page input.",
      "component": "/app/frontend/src/components/ui/pagination.jsx",
      "data_testids": {
        "wrapper": "table-pagination",
        "prev": "table-pagination-prev",
        "next": "table-pagination-next",
        "page": "table-pagination-page-<n>",
        "goto": "table-pagination-goto-input"
      },
      "mobile": "Stack into 2 rows: info + prev/next, then page numbers as horizontally scrollable chips."
    },

    "contact_detail_modal": {
      "preferred": "Sheet (slide-in from right) for fast compare + keep context; Dialog acceptable if existing flow prefers centered.",
      "components": ["sheet.jsx", "dialog.jsx"],
      "sections": [
        "Header: avatar + name + source badge",
        "Contact fields: email, phone, last seen, total visits",
        "Activity snippets (optional): last 5 URLs",
        "Actions: edit, delete"
      ],
      "data_testids": {
        "open": "contact-detail-open",
        "sheet": "contact-detail-sheet",
        "close": "contact-detail-close-button"
      }
    },

    "analytics_page": {
      "cards": {
        "use": "Card",
        "layout": "2-up on md+, stacked on mobile",
        "kpi_style": "Large number (text-3xl font-display) + small label"
      },
      "top_sources": {
        "use": "Table",
        "rows": "source + visitors/leads + % share",
        "optional_chart": "Recharts horizontal bar for top 5 (keep minimalist)."
      },
      "data_testids": {
        "total_contacts": "analytics-total-contacts",
        "today_events": "analytics-today-events",
        "top_sources_table": "analytics-top-sources-table"
      }
    },

    "logs_page": {
      "feed": {
        "use": "Card + Separator + small timeline rail",
        "row": "Visitor identifier + URL (monospace optional) + source badge + timestamp",
        "interaction": "Hover highlights row; clicking opens related visitor detail if available."
      },
      "data_testids": {
        "logs-feed": "logs-activity-feed",
        "logs-item": "logs-item-<id>"
      }
    }
  },

  "motion_and_microinteractions": {
    "principles": [
      "Fast and subtle: 120–180ms for hover, 180–240ms for panels/modals.",
      "Use transforms sparingly; avoid layout shifts.",
      "Respect prefers-reduced-motion."
    ],
    "hover_states": {
      "tabs": "inactive tab: bg-slate-50 + text-slate-900; active stays orange",
      "table_rows": "bg-slate-50; show action icons at 80% opacity -> 100% on hover",
      "icon_buttons": "hover:bg-slate-100 focus:ring-2 focus:ring-[var(--focus)]"
    },
    "entrance": {
      "page": "Optional: small fade-up on main card content (opacity + translate-y-1) if framer-motion is available; otherwise simple CSS animation."
    },
    "toast": {
      "use": "sonner with neutral styling; success uses subtle green; destructive uses red; keep toasts top-right inside card area if possible."
    }
  },

  "accessibility": {
    "rules": [
      "WCAG AA contrast: text on white must be >= 4.5:1 (use #111827 primary text).",
      "Visible focus rings on all interactive elements (ring color orange focus).",
      "Hit targets >= 40px for icon buttons on mobile.",
      "Keyboard: tab through filters, table actions, pagination; Esc closes dialogs/sheets.",
      "Use aria-labels on icon-only buttons in addition to data-testid."
    ]
  },

  "libraries_and_assets": {
    "icons": {
      "library": "lucide-react",
      "note": "Use lucide icons (already standard with shadcn). No emoji icons."
    },
    "optional_libs": {
      "recharts": {
        "use_case": "Analytics top sources mini chart",
        "install": "npm i recharts",
        "notes": "Keep charts minimal: 1 accent color (orange) + neutral grid."
      },
      "framer_motion": {
        "use_case": "Subtle entrance transitions for card sections",
        "install": "npm i framer-motion",
        "notes": "Do not animate tables heavily; keep it subtle to avoid perceived jank."
      }
    }
  },

  "image_urls": {
    "instruction": "This app is dashboard-first; avoid heavy stock imagery. Only use tiny brand marks or optional illustration in empty states.",
    "empty_state_optional": [
      {
        "category": "empty_state",
        "description": "Soft abstract line illustration (very light, monochrome). Use as <img> at ~120px width above empty message.",
        "url": "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=600&q=60"
      }
    ]
  },

  "implementation_notes_specific_to_repo": {
    "current_state": [
      "index.css currently defines a dark-first palette and custom tokens (--bg, --text, etc.) used by App.css.",
      "App.css uses var(--bg) and var(--text). These must be updated to reflect the new light tokens (canvas beige + dark text).",
      "Existing utility classes like .contact-row currently assume dark hover colors; they must be reworked for light theme."
    ],
    "css_changes": {
      "index_css": [
        "Replace :root tokens with the light theme tokens in this guideline.",
        "Update ::selection to a warm orange tint and dark text (avoid cyan + light text).",
        "Update scrollbar colors to light neutrals (track: #f8fafc, thumb: #cbd5e1).",
        "Keep noise-overlay but reduce opacity." 
      ],
      "app_css": [
        "Set .App background-color to var(--app-canvas) not var(--bg).",
        "Ensure .App has min-height: 100vh only; no text-align center.",
        "Remove/replace any dark ambient-glow; optional: a very subtle orange radial glow in top-left (<=20% viewport)."
      ]
    },
    "data_testid_enforcement": {
      "rule": "Add data-testid to all buttons, inputs, selects, table rows, pagination controls, modal close/open triggers, and any KPI/stat values.",
      "naming": "kebab-case describing role (not appearance)."
    }
  }
}

---

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
