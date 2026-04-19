/**
 * MobileScreenHeader
 *
 * Universal mobile screen header — owns the consistent
 * `// PULSE / <ROLE> / <PAGE>` breadcrumb plus the screen H1
 * across every mobile tab and any mobile-fullscreen surface.
 *
 * Why this exists
 * ---------------
 * Each mobile tab used to inline its own breadcrumb + h1 with
 * slightly different content, tones, container structures, and
 * vertical offsets. The result was visible drift when switching
 * tabs (HOME pushed the marker down because it was center-aligned
 * against a StatusPill; MobileLiveOps used `tone="muted"` instead
 * of `tone="dim"`; HOME's middle slug was the role while every
 * other tab was the literal "MOBILE"; MobileLiveOps' h1 was h3
 * sized while every other tab was h1 sized — etc.).
 *
 * This component centralizes the pattern. Drop it as the FIRST
 * child of every mobile tab's outer container. The marker baseline,
 * tone, font scale, and spacing are then guaranteed identical.
 *
 * Pattern: `// PULSE / <ROLE> / <PAGE>`
 * - ROLE comes from `currentUser.role` (uppercased here)
 * - PAGE is the tab/screen slug — pass the lowercase tab name
 *   ("HOME", "ACTIONS", "PATIENTS", "ALERTS", "COMMS") and we
 *   uppercase it. Sub-screens may pass their own slug.
 *
 * Usage
 * -----
 *   <MobileScreenHeader
 *     role={currentUser.role}
 *     page="ACTIONS"
 *     title="Actions Queue"
 *     right={<StatusPill label="LIVE" tone="ok" pulse />}
 *   />
 *
 * Omit `title` for a breadcrumb-only header (HOME's intentional
 * "no h1" pattern — see decision log entry where `Overview` was
 * removed because it wasted the most prominent slot on a label
 * that said nothing). The breadcrumb still anchors the same
 * vertical position so cross-tab drift is impossible.
 */

import React, { type ReactNode } from 'react';
import { COLORS, FONTS, SPACE, TYPE } from './design/tokens';
import { Mono } from './design/primitives';

export interface MobileScreenHeaderProps {
  /** The user's role string (any case). Uppercased for the breadcrumb. */
  role: string;
  /** The page slug — e.g. "HOME", "ACTIONS". Uppercased for the breadcrumb. */
  page: string;
  /** Optional H1 title. Omit for breadcrumb-only headers. */
  title?: string;
  /**
   * Optional element rendered on the right side of the header
   * (top-aligned with the breadcrumb so the marker never drifts
   * regardless of what's next to it). E.g. a StatusPill or unread
   * count.
   */
  right?: ReactNode;
}

export function MobileScreenHeader({
  role,
  page,
  title,
  right,
}: MobileScreenHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: SPACE.sm,
        marginTop: SPACE.xs,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 0,
        }}
      >
        <Mono tone="dim" size="xs">
          // PULSE / {role.toUpperCase()} / {page.toUpperCase()}
        </Mono>
        {title ? (
          <h1
            style={{
              fontFamily: FONTS.sans,
              fontSize: TYPE.h1.size,
              fontWeight: TYPE.h1.weight,
              letterSpacing: TYPE.h1.tracking,
              lineHeight: TYPE.h1.lineHeight,
              color: COLORS.textPrimary,
              margin: 0,
            }}
          >
            {title}
          </h1>
        ) : null}
      </div>
      {right ?? null}
    </div>
  );
}
