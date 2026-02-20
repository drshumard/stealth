{
  "product": {
    "name": "StealthTrack",
    "type": "saas_app_analytics_dashboard",
    "design_personality": [
      "quietly-premium",
      "data-dense but breathable",
      "dark-first (low-glare)",
      "trustworthy (audit-log vibes)",
      "fast/real-time (live pulse cues)"
    ],
    "north_star": "Make lead attribution readable in 10 seconds: search → scan → open contact → understand source + journey → copy script."
  },

  "inspiration_fusion": {
    "sources": [
      {
        "reference": "Muzli curated 2026 dashboards",
        "url": "https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/",
        "takeaways": [
          "dark dashboards with soft lighting + clear hierarchy",
          "neon accents used sparingly as status/active highlights",
          "modular cards + crisp tables + roomy spacing"
        ]
      }
    ],
    "fusion_recipe": {
      "layout_principle": "Swiss-style grid + F-pattern scanning (left controls, right data)",
      "surface_style": "Cinematic dark + subtle grain + thin borders (no heavy gradients)",
      "accent_strategy": "Cyan for primary actions/data focus, Mint for success/live, Amber for warnings/attention"
    }
  },

  "typography": {
    "font_pairing": {
      "display": {
        "family": "Space Grotesk",
        "fallback": "ui-sans-serif, system-ui",
        "usage": "App name, page title, numeric KPIs, modal titles"
      },
      "body": {
        "family": "Work Sans",
        "fallback": "ui-sans-serif, system-ui",
        "usage": "Tables, forms, labels, help text"
      },
      "mono": {
        "family": "IBM Plex Mono",
        "fallback": "ui-monospace, SFMono-Regular",
        "usage": "UUIDs, URLs, query params, embed script snippet"
      }
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg text-muted-foreground",
      "section_title": "text-sm font-medium uppercase tracking-widest text-muted-foreground",
      "table_primary": "text-sm font-medium",
      "table_secondary": "text-xs text-muted-foreground",
      "code": "text-xs font-mono"
    },
    "numeric_format": {
      "use_tabular_nums": true,
      "tailwind": "[font-variant-numeric:tabular-nums]"
    }
  },

  "color_system": {
    "mode": "dark_default",
    "notes": [
      "Avoid purple as a dominant accent. Use cyan/mint/amber instead.",
      "Gradients are decorative only and must not exceed 20% of viewport."
    ],
    "tokens_hsl_for_shadcn": {
      "root": {
        "background": "222 22% 7%",
        "foreground": "210 20% 96%",
        "card": "222 22% 9%",
        "card-foreground": "210 20% 96%",
        "popover": "222 22% 9%",
        "popover-foreground": "210 20% 96%",

        "primary": "188 86% 45%",
        "primary-foreground": "222 20% 10%",

        "secondary": "220 17% 14%",
        "secondary-foreground": "210 20% 96%",

        "muted": "220 14% 14%",
        "muted-foreground": "215 16% 68%",

        "accent": "220 17% 14%",
        "accent-foreground": "210 20% 96%",

        "destructive": "0 72% 52%",
        "destructive-foreground": "210 20% 98%",

        "border": "220 14% 18%",
        "input": "220 14% 18%",
        "ring": "188 86% 45%",

        "chart-1": "188 86% 45%",
        "chart-2": "151 55% 48%",
        "chart-3": "38 92% 56%",
        "chart-4": "205 80% 55%",
        "chart-5": "0 72% 52%",

        "radius": "0.75rem"
      }
    },
    "semantic_hex": {
      "bg": "#0B0F14",
      "bg_elev_1": "#0F1620",
      "bg_elev_2": "#111C28",
      "stroke": "#1F2A37",
      "stroke_soft": "#1A2330",
      "text": "#E6EDF6",
      "text_muted": "#A9B4C3",
      "text_dim": "#7C8797",
      "primary_cyan": "#15B8C8",
      "primary_cyan_hover": "#0FA4B3",
      "mint_success": "#45D19C",
      "amber_warn": "#F59E0B",
      "red_error": "#EF4444"
    },
    "gradients_decorative_only": {
      "allowed_usage": [
        "hero header strip",
        "top-of-page ambient glow",
        "very subtle card sheen overlays"
      ],
      "recipes": [
        {
          "name": "cyan_mint_ambient",
          "css": "radial-gradient(900px 400px at 20% -10%, rgba(21,184,200,0.22), rgba(21,184,200,0) 60%), radial-gradient(700px 320px at 80% 0%, rgba(69,209,156,0.16), rgba(69,209,156,0) 55%)"
        }
      ]
    },
    "textures": {
      "noise_overlay_css": "background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"3\" stitchTiles=\"stitch\"/></filter><rect width=\"120\" height=\"120\" filter=\"url(%23n)\" opacity=\"0.035\"/></svg>');",
      "usage": "Apply on the main app background only (not inside table cells)."
    }
  },

  "layout": {
    "app_shell": {
      "pattern": "Top nav + content area",
      "max_width": "max-w-7xl",
      "page_padding": "px-4 sm:px-6 lg:px-8",
      "vertical_rhythm": "space-y-4 sm:space-y-6",
      "background": "solid dark with small ambient radial glow at top"
    },
    "grid": {
      "desktop": "12-col; cards typically span 12; optional side panel spans 4",
      "mobile": "single column; sticky search + table below",
      "table_area": "full width with horizontal scroll on very small screens"
    },
    "sections": [
      {
        "name": "header",
        "content": [
          "Brand + environment chip (MVP)",
          "Live status indicator",
          "Copy script button"
        ]
      },
      {
        "name": "controls_row",
        "content": [
          "Search input",
          "Filters (date range popover w calendar)",
          "Refresh button"
        ]
      },
      {
        "name": "contacts_table_card",
        "content": [
          "Table header with count",
          "Contacts table",
          "Empty state"
        ]
      }
    ]
  },

  "components": {
    "primary_shadcn_paths": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "label": "/app/frontend/src/components/ui/label.jsx",
      "separator": "/app/frontend/src/components/ui/separator.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "popover": "/app/frontend/src/components/ui/popover.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "sonner": "/app/frontend/src/components/ui/sonner.jsx"
    },
    "dashboard_specific_composites_to_build": [
      {
        "name": "TopNav",
        "description": "Brand left; live status pill center/right; actions: Copy Script, Refresh.",
        "key_parts": ["Badge", "Button", "Tooltip"],
        "data_testids": [
          "top-nav",
          "live-status-pill",
          "copy-script-button",
          "refresh-contacts-button"
        ]
      },
      {
        "name": "ScriptEmbedCard",
        "description": "Copyable script snippet with mono font, inline docs and a 'Copied' toast.",
        "key_parts": ["Card", "Button", "Sonner"],
        "data_testids": [
          "script-embed-card",
          "tracking-script-snippet",
          "copy-script-snippet-button"
        ]
      },
      {
        "name": "ContactsTable",
        "description": "Dense table with sticky header, row hover glow, and keyboard focus ring.",
        "key_parts": ["Table", "Badge"],
        "data_testids": [
          "contacts-table",
          "contacts-table-search-input",
          "contacts-table-row"
        ]
      },
      {
        "name": "ContactDetailModal",
        "description": "Dialog with tabs: Overview + URLs timeline. URL rows use mono + copy buttons.",
        "key_parts": ["Dialog", "Tabs", "ScrollArea", "Button", "Separator"],
        "data_testids": [
          "contact-detail-modal",
          "contact-detail-modal-close-button",
          "contact-overview-tab",
          "contact-urls-tab",
          "contact-url-row",
          "copy-url-button",
          "copy-contact-id-button"
        ]
      },
      {
        "name": "LiveEventPulse",
        "description": "Small pulsing dot + 'Receiving events'/'Disconnected' label.",
        "key_parts": ["Badge"],
        "data_testids": ["live-event-pulse"]
      }
    ]
  },

  "component_specs": {
    "buttons": {
      "style": "Professional / Corporate with subtle cinematic glow",
      "tokens": {
        "--btn-radius": "12px",
        "--btn-shadow": "0 10px 30px rgba(0,0,0,0.35)",
        "--btn-shadow-hover": "0 14px 40px rgba(0,0,0,0.45)",
        "--btn-press-scale": "0.98"
      },
      "variants": {
        "primary": {
          "use_for": ["Copy script", "Primary confirm actions"],
          "tailwind": "bg-[color:var(--primary-cyan)] text-black hover:bg-[color:var(--primary-cyan-hover)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        },
        "secondary": {
          "use_for": ["Refresh", "Filter"],
          "tailwind": "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))] border border-[hsl(var(--border))]"
        },
        "ghost": {
          "use_for": ["Icon actions in rows"],
          "tailwind": "hover:bg-white/5 text-[hsl(var(--foreground))]"
        }
      },
      "micro_interactions": {
        "hover": "Increase border contrast + subtle glow; never use transition-all.",
        "press": "scale-[0.98] with duration-150",
        "loading": "Use inline spinner (lucide) + reduced opacity",
        "tailwind": "transition-colors duration-200"
      }
    },

    "table": {
      "density": "High information; 44px row height; zebra via subtle alpha",
      "header": "sticky top-0 with bg-elev-2 and border",
      "row_interactions": {
        "hover": "bg-white/3 + left border accent",
        "selected": "bg-white/5 + ring",
        "focus": "focus-visible:ring-2 ring-cyan"
      },
      "columns": [
        {"key": "name", "width": "min-w-[180px]"},
        {"key": "email", "width": "min-w-[220px]"},
        {"key": "created", "width": "min-w-[160px]"},
        {"key": "visit_count", "width": "min-w-[120px] text-right"}
      ],
      "empty_state": {
        "message": "No contacts yet — paste the tracking script into your webinar page header and submit the form.",
        "cta": "Copy script",
        "data_testids": ["contacts-empty-state", "contacts-empty-state-copy-script"]
      }
    },

    "modal": {
      "size": "max-w-3xl",
      "layout": "Left: identity + lead source; Right: timeline",
      "timeline": {
        "style": "Vertical rail with dots; each item shows URL (mono), timestamp, and params chips",
        "chips": "Use Badge variant=secondary for UTM params"
      }
    },

    "status_indicators": {
      "live": {
        "dot": "bg-[color:var(--mint-success)]",
        "pulse": "animate-pulse (respect reduced motion)",
        "label": "Receiving"
      },
      "idle": {"dot": "bg-white/30", "label": "Idle"},
      "error": {"dot": "bg-[color:var(--red-error)]", "label": "Disconnected"}
    }
  },

  "motion": {
    "library": "framer-motion (optional but recommended)",
    "install": {
      "command": "npm i framer-motion",
      "usage": "Use for modal entrance, table row highlight, and subtle header fade-in. Prefer CSS for simple hovers."
    },
    "principles": [
      "Motion communicates system state (live tracking, copy feedback).",
      "Use short durations (150–220ms).",
      "Avoid large parallax; this is a data app. Use micro-animations only.",
      "Respect prefers-reduced-motion: disable pulse and heavy animations."
    ],
    "patterns": {
      "page_enter": "opacity 0 → 1, y 8 → 0, duration 0.22",
      "modal_enter": "overlay fade + dialog scale 0.98 → 1",
      "row_hover": "background-color transition only (no transform)"
    }
  },

  "data_visualization_optional": {
    "why": "Small KPI strip (Today events, New contacts, Active visitors) increases 'analytics' credibility.",
    "library": "recharts (optional)",
    "install": {
      "command": "npm i recharts",
      "usage": "Add tiny 7-day sparkline in header card; keep it subtle."
    },
    "chart_style": {
      "stroke": "var(--primary-cyan)",
      "grid": "rgba(255,255,255,0.06)",
      "tooltip": "bg-elev-2 border stroke soft shadow"
    }
  },

  "accessibility": {
    "contrast": "Meet WCAG AA for text and iconography; muted text only for secondary info.",
    "focus": "Always visible focus rings: focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0",
    "keyboard": [
      "Table rows must be keyboard-selectable (role=button, tabIndex=0) and open modal on Enter/Space.",
      "Modal traps focus (shadcn Dialog)."
    ],
    "aria": [
      "Add aria-label to icon-only buttons (copy, close).",
      "Live region: announce 'Copied' via toast; optionally aria-live polite on status."
    ]
  },

  "testing_conventions": {
    "rule": "All interactive and key informational elements must have data-testid in kebab-case.",
    "examples": [
      "data-testid=\"contacts-table-search-input\"",
      "data-testid=\"contact-detail-modal\"",
      "data-testid=\"copy-script-snippet-button\"",
      "data-testid=\"live-status-pill\""
    ]
  },

  "images": {
    "image_urls": [
      {
        "category": "background_ambient_reference",
        "description": "Optional: faint header ambient art used behind the top nav area (blurred, opacity < 0.12).",
        "url": "https://images.pexels.com/photos/30175347/pexels-photo-30175347.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
      },
      {
        "category": "background_texture_reference",
        "description": "Optional: use as inspiration for grid/noise (do not place as full-screen photo; recreate via CSS).",
        "url": "https://images.unsplash.com/photo-1589383612851-b9ff23e137cb?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      },
      {
        "category": "accent_texture_reference",
        "description": "Optional: amber highlight texture inspiration for empty states or onboarding card (very small usage).",
        "url": "https://images.unsplash.com/photo-1577451581538-67043aba1116?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85"
      }
    ]
  },

  "implementation_notes_for_main_agent": {
    "instructions_to_main_agent": [
      "Set dark mode by default: add `className=\"dark\"` on the root wrapper (or `document.documentElement.classList.add('dark')`).",
      "Replace starter CRA App.css centering styles; do NOT center the app container.",
      "Update `/app/frontend/src/index.css` HSL tokens to match `tokens_hsl_for_shadcn.root` (dark-first).",
      "Add Google Fonts in `public/index.html`: Space Grotesk + Work Sans + IBM Plex Mono. Use them via Tailwind `fontFamily` or global CSS.",
      "Use shadcn components from `/app/frontend/src/components/ui/*.jsx` only (no raw HTML dropdowns/calendars/toasts).",
      "Ensure table rows are clickable + keyboard accessible; open `Dialog` modal with contact details.",
      "All buttons/inputs/table rows/modal elements must include `data-testid` (kebab-case).",
      "Use `ScrollArea` inside modal for URL history; URLs and params in mono; add copy buttons with Sonner toast.",
      "Live status pill: small dot + label; if websocket later, animate pulse when connected; otherwise show 'Idle' state for MVP. If websocket is MOCKED, label it clearly in UI."
    ],
    "css_scaffolds": {
      "app_background": "bg-[color:var(--bg)] text-[color:var(--text)]",
      "ambient_top_glow": "before:content-[''] before:fixed before:inset-x-0 before:top-0 before:h-[220px] before:bg-[radial-gradient(700px_220px_at_50%_-20%,rgba(21,184,200,0.22),rgba(21,184,200,0))] before:pointer-events-none",
      "card": "bg-[color:var(--bg-elev-1)] border border-[color:var(--stroke)] rounded-xl",
      "hairline_divider": "border-t border-white/5"
    }
  },

  "GRADIENT_RESTRICTION_RULE": {
    "rules": [
      "NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.",
      "NEVER let gradients cover more than 20% of the viewport.",
      "NEVER apply gradients to text-heavy content or reading areas.",
      "NEVER use gradients on small UI elements (<100px width).",
      "NEVER stack multiple gradient layers in the same viewport."
    ],
    "enforcement": "IF gradient area exceeds 20% of viewport OR affects readability THEN use solid colors",
    "allowed": [
      "Section backgrounds (not content backgrounds)",
      "Hero section header content (subtle)",
      "Decorative overlays and accent elements only"
    ]
  },

  "General_UI_UX_Design_Guidelines": [
    "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms",
    "- You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text",
    "- NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json",
    "\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.",
    "</General UI UX Design Guidelines>"
  ]
}
