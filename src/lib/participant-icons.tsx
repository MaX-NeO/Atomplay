'use client'

/**
 * participant-icons.tsx
 *
 * A curated set of 100 unique Lucide icons assigned to quiz participants.
 * Each participant (by join-order index) gets exactly one icon — the first
 * joiner gets icon #0, the second gets icon #1, and so on. With 100 icons
 * we cover the 99-user hard cap enforced by the join API (see
 * `src/app/api/join/route.ts`); the admin-facing UI advertises a smaller
 * "recommended" number (MAX_PARTICIPANTS_DISPLAY = 80) per the product spec.
 *
 * The list mixes two packages:
 *   - 61 icons from the stable `lucide-react` package (already React components).
 *   - 39 icons from `@lucide/lab` (experimental "lab" icons). The lab package
 *     ships icon NODES (plain `[tag, props]` arrays), not React components, so
 *     we wrap each one with `createLucideIcon` from lucide-react to turn it
 *     into a renderable `<Icon/>` component. See:
 *       - https://lucide.dev/icons/lab
 *       - https://lucide.dev/docs/lucide-react/customize-icons
 *
 * Substitutions (user-provided names that don't exist in either package):
 *   hat-glasses           -> glasses            (stable)
 *   birdhouse             -> egg                (stable)
 *   chess-bishop          -> crown              (stable)
 *   chess-king            -> dices              (stable)
 *   chess-knight          -> target             (stable)
 *   chess-pawn            -> flag               (stable)
 *   chess-queen           -> trophy             (stable)
 *   chess-rook            -> castle             (stable)
 *   face-slightly-smiling -> smile              (stable)
 *   sport-shoe            -> footprints         (stable)
 *
 * Why index-based (not hash-based) assignment: a hash of the participant id
 * would give the SAME person the same icon across reloads, but two different
 * people could collide on the same icon if their hashes mapped to the same
 * slot. Index-based assignment guarantees uniqueness for the first 100
 * joiners. The trade-off (a person's icon can shift if someone ahead of them
 * is kicked) is acceptable because the icon is decorative, not identifying.
 */

import { createLucideIcon } from 'lucide-react'

import {
  // ---- stable lucide-react icons (61) — these are already React components ----
  Moon, Sun, User, Bird, Egg, Bone, Cat, Dog, Feather, Fish, Origami, Panda,
  Rabbit, Rat, Shell, Shrimp, Snail, Squirrel, Turtle, Worm,
  Send, Zap, Binoculars, Gem, Gamepad2,
  Crown, Dices, Target, Flag, Trophy, Castle, Smile,
  Heart, Star, Apple, Cake, CakeSlice, Candy, Carrot, Cherry, Citrus, Coffee,
  Cookie, CupSoda, Croissant, Grape, Hamburger, IceCreamCone, Popsicle, Popcorn,
  Pizza, Lollipop, Nut, Rocket, Music, Flower2, Snowflake, CloudDrizzle,
  Umbrella, Glasses, Footprints,
} from 'lucide-react'

import {
  // ---- @lucide/lab icons (39) — these are IconNode arrays, wrapped below ----
  yinYang, planet, houseRoof, bearFace, bee, bullHead, butterfly, chameleon,
  cowHead, crab, elephant, foxFaceTail, frogFace, hedgehog, horseHead, owl,
  penguin, shark, spider, unicornHead, whale, igloo, windmill, candlestickLit,
  cheese, hexagons7, kiwi, pepperChilli, pear, flowerTulip, basketball,
  tennisBall, pacManGhost, pacMan, soccerBall, flowerRose, flowerLotus,
  snowman, hatTop,
} from '@lucide/lab'

// Wrap each lab IconNode into a renderable React component. The first arg is
// the kebab-case icon name (used for the CSS class + displayName).
const YinYang        = createLucideIcon('yin-yang', yinYang)
const Planet         = createLucideIcon('planet', planet)
const HouseRoof      = createLucideIcon('house-roof', houseRoof)
const BearFace       = createLucideIcon('bear-face', bearFace)
const Bee            = createLucideIcon('bee', bee)
const BullHead       = createLucideIcon('bull-head', bullHead)
const Butterfly      = createLucideIcon('butterfly', butterfly)
const Chameleon      = createLucideIcon('chameleon', chameleon)
const CowHead        = createLucideIcon('cow-head', cowHead)
const Crab           = createLucideIcon('crab', crab)
const Elephant       = createLucideIcon('elephant', elephant)
const FoxFaceTail    = createLucideIcon('fox-face-tail', foxFaceTail)
const FrogFace       = createLucideIcon('frog-face', frogFace)
const Hedgehog       = createLucideIcon('hedgehog', hedgehog)
const HorseHead      = createLucideIcon('horse-head', horseHead)
const Owl            = createLucideIcon('owl', owl)
const Penguin        = createLucideIcon('penguin', penguin)
const Shark          = createLucideIcon('shark', shark)
const Spider         = createLucideIcon('spider', spider)
const UnicornHead    = createLucideIcon('unicorn-head', unicornHead)
const Whale          = createLucideIcon('whale', whale)
const Igloo          = createLucideIcon('igloo', igloo)
const Windmill       = createLucideIcon('windmill', windmill)
const CandlestickLit = createLucideIcon('candlestick-lit', candlestickLit)
const Cheese         = createLucideIcon('cheese', cheese)
const Hexagons7      = createLucideIcon('hexagons-7', hexagons7)
const Kiwi           = createLucideIcon('kiwi', kiwi)
const PepperChilli   = createLucideIcon('pepper-chilli', pepperChilli)
const Pear           = createLucideIcon('pear', pear)
const FlowerTulip    = createLucideIcon('flower-tulip', flowerTulip)
const Basketball     = createLucideIcon('basketball', basketball)
const TennisBall     = createLucideIcon('tennis-ball', tennisBall)
const PacManGhost    = createLucideIcon('pac-man-ghost', pacManGhost)
const PacMan         = createLucideIcon('pac-man', pacMan)
const SoccerBall     = createLucideIcon('soccer-ball', soccerBall)
const FlowerRose     = createLucideIcon('flower-rose', flowerRose)
const FlowerLotus    = createLucideIcon('flower-lotus', flowerLotus)
const Snowman        = createLucideIcon('snowman', snowman)
const HatTop         = createLucideIcon('hat-top', hatTop)

export type ParticipantIcon = React.ComponentType<{
  className?: string
  style?: React.CSSProperties
  strokeWidth?: number
}>

// ----------------------------------------------------------------------------
// Participant colors — shared between the lobby bubble stage (in
// live-presentation-screen.tsx) and the participants sheet (in
// participants-sheet.tsx) so a given participant shows the EXACT same color in
// both views. Previously the sheet used a different hue formula
// (`iconIndex * 137 % 360`) which produced mismatched colors; now both views
// derive the color from the same `colorForParticipant(name, idx)` function.
// ----------------------------------------------------------------------------

export interface ParticipantColor {
  /** vivid ring/border color (hsl string) */
  border: string
  /** soft outer glow (hsl string with alpha) */
  glow: string
  /** bright readable icon/foreground color (hsl string) */
  text: string
  /** soft translucent fill for the bubble/avatar background (hsl string with alpha) */
  soft: string
}

// 70-color palette generated by hue rotation around the full color wheel.
// Each entry has a vivid border + matching soft glow + readable text color.
export const PARTICIPANT_COLORS: ParticipantColor[] = Array.from(
  { length: 70 },
  (_, i) => {
    const hue = Math.round((i * 360) / 70)
    return {
      border: `hsl(${hue} 85% 65%)`,
      glow: `hsl(${hue} 85% 55% / 0.45)`,
      text: `hsl(${hue} 90% 82%)`,
      soft: `hsl(${hue} 85% 55% / 0.16)`,
    }
  },
)

// Deterministic color assignment — mix the name hash with the index so visually
// nearby bubbles don't always clash, and the same person always gets the same
// color across reloads. Both the lobby bubble stage and the participants sheet
// call this with the SAME (displayName, index) pair so the color is identical.
export function colorForParticipant(name: string, idx: number): ParticipantColor {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PARTICIPANT_COLORS[Math.abs(hash + idx * 7) % PARTICIPANT_COLORS.length]
}

/**
 * The ordered list of 100 participant icons. Index N is shown to the (N+1)th
 * participant to join. DO NOT reorder — changing the order changes which icon
 * every existing participant sees.
 */
export const PARTICIPANT_ICONS: ParticipantIcon[] = [
  // 1-10
  Moon, Sun, YinYang, Glasses, User, Planet, HouseRoof, Bird, Egg, Bone,
  // 11-20
  Cat, Dog, Feather, Fish, Origami, Panda, Rabbit, Rat, Shell, Shrimp,
  // 21-30
  Snail, Squirrel, Turtle, Worm, BearFace, Bee, BullHead, Butterfly, Chameleon, CowHead,
  // 31-40
  Crab, Elephant, FoxFaceTail, FrogFace, Hedgehog, HorseHead, Owl, Penguin, Shark, Spider,
  // 41-50
  UnicornHead, Whale, Igloo, Windmill, Send, Zap, CandlestickLit, Binoculars, Gem, Gamepad2,
  // 51-60 (chess pieces substituted with crowns/flags/etc.)
  Crown, Dices, Target, Flag, Trophy, Castle, Smile, Heart, Star, Apple,
  // 61-70
  Cake, CakeSlice, Candy, Carrot, Cherry, Citrus, Coffee, Cookie, CupSoda, Croissant,
  // 71-80
  Grape, Hamburger, IceCreamCone, Popsicle, Popcorn, Pizza, Lollipop, Nut, Cheese, Hexagons7,
  // 81-90
  Kiwi, PepperChilli, Pear, Rocket, FlowerTulip, Basketball, TennisBall, PacManGhost, PacMan, SoccerBall,
  // 91-100
  FlowerRose, Music, FlowerLotus, Flower2, Snowflake, Snowman, HatTop, Footprints, CloudDrizzle, Umbrella,
]

/**
 * The hard cap on concurrent participants. The join API enforces this (see
 * `src/app/api/join/route.ts`); the admin-facing UI advertises a smaller
 * "recommended" number (MAX_PARTICIPANTS_DISPLAY = 80) per the product spec.
 */
export const MAX_PARTICIPANTS = 99
export const MAX_PARTICIPANTS_DISPLAY = 80

/**
 * Get the icon component for a participant at the given zero-based index.
 *
 * Falls back to the `User` icon if the index somehow exceeds the list length
 * — this should never happen because the join API caps at 99 participants,
 * but the guard keeps the UI from crashing if it ever does.
 */
export function getParticipantIcon(index: number): ParticipantIcon {
  if (!Number.isFinite(index) || index < 0) return User
  return PARTICIPANT_ICONS[index % PARTICIPANT_ICONS.length]
}

/**
 * Derive a STABLE index from a participant's ID.
 *
 * The lobby bubble stage assigns icons by join-order index (0, 1, 2, …), but
 * the leaderboard re-sorts participants by score — so the leaderboard's array
 * index does NOT match the join order. If we used the array index, a participant
 * would get a DIFFERENT icon/color on the leaderboard than in the lobby.
 *
 * This function hashes the participant ID to produce a stable number in
 * [0, 99]. The same participant always gets the same icon + color, regardless
 * of whether they're shown in the lobby, leaderboard, or final results.
 *
 * Note: this does NOT guarantee uniqueness across participants (two IDs could
 * hash to the same slot), but collisions are rare and the visual impact is
 * minimal. For the lobby (where uniqueness matters), the join-order index is
 * still used.
 */
export function stableParticipantIndex(participantId: string): number {
  let hash = 0
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash * 31 + participantId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % PARTICIPANT_ICONS.length
}

/**
 * Get the icon for a participant by their ID (stable across contexts).
 * Use this in the leaderboard / final results where join order is unknown.
 */
export function getParticipantIconById(participantId: string): ParticipantIcon {
  return getParticipantIcon(stableParticipantIndex(participantId))
}

/**
 * Get the color for a participant by their ID (stable across contexts).
 * Uses the same hash as stableParticipantIndex so icon + color always match.
 */
export function colorForParticipantById(
  participantId: string,
  displayName: string,
): ParticipantColor {
  const idx = stableParticipantIndex(participantId)
  return colorForParticipant(displayName, idx)
}
