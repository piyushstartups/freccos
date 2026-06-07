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

## Design refinements (Feb 2026)
- iOS-standard headers across all internal pages: left-aligned, 28px bold title, secondary subtitle, dark #1C1C1E
- Explore is the only centred header — Vogue-style serif Wordmark (Cormorant Garamond/Playfair, 38px, 600, +2px letter-spacing) + bell-only top-right
- Logo mark removed from every screen except Splash and Login (Signup/Forgot/AuthCallback now show the Wordmark)
- Profile hero redesigned: avatar left, name + lock inline, bio + IG handle, single-line stats row, compact flag grid, horizontally scrollable milestone chips, joined date as tertiary text — Apple-Music/iOS-contact card density

## Saved tab tick-off lifecycle (Feb 2026)
- Friend Profile: Follow/Following pill is a compact 96×30 inline button next to the user's name (verified in iteration_2)
- Backend `/api/trip-plans/{city_id}/check` now returns `{ok, prompt_add_to_trips, auto_removed}`; deletes the trip plan when every saved rec is ticked
- TripDetail.jsx: ticking a saved friend's rec shows an iOS-style "Did you love it? Add your own rec for [place]?" ConfirmDialog. Confirm → AddRecommendationSheet pre-filled (place + category, city locked). Decline → toast + navigate back to /trips if all are ticked off
- AddRecommendationSheet: new `prefillRec` prop pre-fills place_name, place_id, place_address, and category for fresh-add (non-edit) mode. Also fixed an unrelated `photoPath` ReferenceError on submit
- TripDetail Delete uses ConfirmDialog (no more window.confirm)
- pytest module `/app/backend/tests/test_trip_check_lifecycle.py` covers the auto-remove flag end-to-end

## Next tasks
- Wire optional email provider for password reset
- Add web push for "new rec in [City] from [Friend]"
- Bump BottomNav z-index above #emergent-badge (pre-existing pointer-event overlap at 390px on right-side tabs)
- Migrate remaining `window.confirm` usages in FriendProfile.jsx (unfollow/block) to ConfirmDialog
- Add per-rec photo viewer + zoom
