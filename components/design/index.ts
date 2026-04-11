/**
 * PULSE Tactical Design System
 *
 * Single entry point for the Tactical visual direction. Import everything
 * from here rather than from individual files:
 *
 *   import { COLORS, FONTS, Mono, TacticalCard, SectionTitle } from '../design';
 *
 * Any surface that wants to look Tactical should compose from these
 * primitives — if a component is rolling its own palette, corner brackets,
 * or status pills, refactor it to use these instead.
 */

export * from './tokens';
export * from './primitives';
