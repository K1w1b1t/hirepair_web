---
name: Hirepair Design System
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#434653'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#737784'
  outline-variant: '#c3c6d5'
  surface-tint: '#1d59c1'
  primary: '#003c90'
  on-primary: '#ffffff'
  primary-container: '#0f52ba'
  on-primary-container: '#bcceff'
  inverse-primary: '#b0c6ff'
  secondary: '#1b6d24'
  on-secondary: '#ffffff'
  secondary-container: '#a0f399'
  on-secondary-container: '#217128'
  tertiary: '#653400'
  on-tertiary: '#ffffff'
  tertiary-container: '#874700'
  on-tertiary-container: '#ffc292'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00419c'
  secondary-fixed: '#a3f69c'
  secondary-fixed-dim: '#88d982'
  on-secondary-fixed: '#002204'
  on-secondary-fixed-variant: '#005312'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 31px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  button-text:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 20px
---

## Brand & Style

The design system is built on a foundation of **Pragmatic Minimalism**. Its primary objective is to reduce cognitive load for users who may be navigating high-stress career transitions. The visual personality is functional and welcoming, prioritizing utility over decoration to ensure the resume-building process feels achievable and professional.

The style leverages high-contrast elements and clear information architecture to maintain accessibility. By combining a clean, "Corporate Modern" structure with approachable, "Soft-Modern" elements, the system evokes a sense of confidence and reliability. It avoids unnecessary visual noise, focusing instead on guided pathways and proactive assistance.

## Colors

The palette is engineered for high legibility and psychological reassurance.

*   **Primary (Sapphire Blue):** Used for core branding, progress indicators, and primary navigation. It represents stability and professional confidence.
*   **Accent (Conquest Green):** Reserved for "Positive Action" and success states, specifically the WhatsApp integration and final submission buttons.
*   **Alert/Advisor (Amber):** A specific functional palette for the proactive advisor, using a warm background and high-contrast border to denote helpful guidance without causing alarm.
*   **Text Hierarchy:** Dark Graphite (#1E293B) provides a high-contrast anchor for readability, while Neutral Gray (#64748B) is used for secondary metadata and instructional text.

## Typography

This design system utilizes **Inter** (system-fallback) to ensure maximum compatibility across mobile devices while maintaining a clean, systematic look.

*   **Headlines:** Focused on clarity; semi-bold weight ensures sections are easily identifiable during a quick scroll.
*   **Body:** Optimized for long-form reading and resume previewing with a generous 1.5 line-height.
*   **Help/Status:** Scaled down for auxiliary information, ensuring it doesn't compete with primary user tasks.

## Layout & Spacing

This design system follows a **Mobile-First Fluid Grid** philosophy. Because the primary use case is on handheld devices, the layout relies on a single-column stack with generous safe-area margins (20px).

*   **Rhythm:** An 8pt linear scale is used for all spatial relationships.
*   **Verticality:** Components are separated by `lg` (24px) spacing to prevent accidental taps and visual clutter.
*   **Touch Targets:** All interactive elements maintain a minimum height of 48px to ensure accessibility for all users.

## Elevation & Depth

To maintain the "Pragmatic" personality, the design system uses **Tonal Layering** rather than heavy shadows.

*   **Level 0 (Background):** #FAFAFA.
*   **Level 1 (Cards/Inputs):** Pure white (#FFFFFF) with a subtle 1px stroke (#E2E8F0).
*   **Advisor Layer:** Uses a tonal background (#FEF3C7) to pull forward from the white surface without needing a shadow.
*   **Interaction:** Active states for buttons use a subtle scale-down (98%) to provide tactile feedback without complex visual effects.

## Shapes

The design system employs a **Rounded** (0.5rem) shape language. This creates a "friendly and approachable" feel that softens the bureaucratic nature of resume building.

*   **Inputs & Buttons:** 8px (0.5rem) corner radius.
*   **Advisor Alerts:** 12px (0.75rem) corner radius to differentiate these as floating, supportive "containers."
*   **Chips:** Fully pill-shaped (100px) to indicate they are discrete, draggable/removable objects.

## Components

*   **WhatsApp Primary Button:** The highest-order CTA. It uses #2E7D32 with a white icon and label. It should always be anchored to the bottom of the viewport in the "Submit" phase.
*   **Progress Bars:** Thin (4px) or Medium (8px) tracks in a light gray, with the Sapphire Blue (#0F52BA) fill. No rounded caps on the fill to emphasize precision.
*   **Voice Recording:** A circular button (min 64x64px) with a Sapphire Blue pulse effect when active. Includes a clear microphone icon.
*   **Editable Chips:** Used for fact confirmation. These feature a light gray background with a "dismiss" (X) icon. When tapped, they transition to a text input.
*   **Advisor Alerts:** Styled with #FEF3C7 background and a 2px #D97706 left-border. These should contain a small "bulb" or "info" icon and the status typography.
*   **Input Fields:** Large, clear tap targets with labels always visible above the field. Border-color changes to Sapphire Blue on focus.