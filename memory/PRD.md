# Freccos — Product Requirements

## Problem
Freccos is a private, invite-only travel recommendations PWA solving Discovery, Organisation, and Trust around friends' travel knowledge. Core loop: "I'm going somewhere → who among my friends knows this place → what did they think → save what matters." Attribution is always visible.

## Tech stack
- **Frontend**: React 19 (CRA + Craco), Tailwind v3, Lucide icons, Sonner toasts, framer-motion available, PWA (manifest + service worker)
- **Backend**: FastAPI + Motor (Mongo)
- **Storage**: Emergent Object Storage
- **Auth**: Custom JWT (httpOnly cookies) + Emergent-managed Google OAuth
- **Places**: Google Places API (New) — Autocomplete + Place Details (server-side, key never reaches client)

## What's been implemented (June 2026 — initial MVP)
- Auth: email/password JWT cookies, Emergent Google OAuth fallback, invite-code signup with auto-mutual-follow, forgot-password stub
- Multi-step signup (invite → name/email/password → photo + bio with skip)
- Splash → Login/Signup with iOS dark hero
- Bottom-tab shell (Explore / Friends / Trips / Profile) + FAB speed-dial (Add rec / Add trip / Add bucket-list)
- Explore: city grid for cities where followed users have recs (with friend avatars)
- City detail: dark header, friends-strip, category filter tabs, Top Picks grouping (multi-friend cards), Save + Undo, Add rec sheet
- Add a recommendation bottom sheet with Google Places autocomplete, 4-category chips, optional note + photo (4:3)
- Friend profile: dark stat header, country→city browser, Ask on WhatsApp deep-link, save friends' recs
- My profile: avatar/bio header, Trips + Bucket-list tabs, edit/delete own recs, shareable invite-code card, settings sheet (edit profile + logout)
- Trip Plans: upcoming trips + bucket list sections, trip detail with check-off (no deletion of data), "Add to trips?" prompt on first check
- Friends tab: search + following/discover sections + follow/unfollow
- PWA: manifest with Freccos branding, service worker (network-first nav, SWR static), iOS meta tags, install-banner
- Photo upload via Emergent Object Storage (8MB cap, multipart)

## Seeded data
- Users: Priya (FRECCOS1), Arjun, Sara — all mutually following; password Demo1234!
- Cities: Alibag, Goa, Paris, Tokyo with sample recs incl. Top Pick on "Sundowner Cafe"

## Deferred / backlog
- P1: real email provider (Resend) for password reset
- P1: push notifications (web push) for new friend recs in saved cities
- P2: PWA offline support for already-fetched recs
- P2: rich photo gallery view on rec detail
- P2: PWA icon-set generated from real brand artwork (currently programmatic)
- P2: rec save tied to per-place identity also across cities (cross-city dedupe)

## Next tasks
- Wire optional email provider for password reset
- Add web push for "new rec in [City] from [Friend]"
- Add per-rec photo viewer + zoom
