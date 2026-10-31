# WorkoutBoard Product Plan

## Product principle

WorkoutBoard is a training log first and a workout-program app second.

A user must always be able to train today, enter sets quickly, finish the session, and keep that history forever regardless of which program they are following.

Programs, weekly plans, community, and shared workouts organize training. They do not own the user's history.

## Data safety

- Supabase is the source of truth for signed-in users.
- Existing `workout_logs` remain intact.
- New completed workouts dual-write into `training_sessions`.
- The platform migration copies existing completed logs into `training_sessions`.
- Do not delete legacy data during the migration period.
- Autosave remains enabled while a workout is being entered.
- A future offline queue/PWA sync layer should persist in-progress sets locally and replay them to Supabase after connectivity returns.
- Add account-level JSON export/import before calling the application feature-complete.

## Core navigation

- Today
- Together
- Progress
  - My Progress
  - Community
- Plan
- Me

## Today

Primary goal: fastest possible workout entry.

Features:
- Resume current/in-progress workout.
- Previous weight/reps shown inline.
- Direct number entry plus +/- controls.
- Set completion taps.
- Main work, backoff work, assistance, conditioning, RPE, bodyweight, notes.
- Autosave.
- Finish workout summary.
- Next workout suggestion.
- Eventually starts today's item from the flexible weekly plan when one exists.
- "Start anything" option for an unplanned session.

## Flexible weekly planning

A week can mix unrelated training styles.

Example:
- Monday: Tracey-style 3x10
- Wednesday: 5/3/1 + FSL
- Friday: custom conditioning
- Next week: return to the user's normal program

Planned workouts are independent records. Changing a plan never rewrites completed history.

Quick schemes:
- 3x10
- 5x5
- 5/3/1 + FSL 5x5
- custom

Users can also schedule workouts from program-library entries.

## Program library

Sources:
- WorkoutBoard built-ins
- user's own builds
- community-shared plans
- external URL submissions

Current built-ins:
- 12 Week Andy Hybrid
- 8 Week Powerbuilding
- 6 Week Strength + Power
- 4 Week Reset

### Submit Workout Plan

Two entry methods:

1. Build
   - plan name
   - outline
   - visibility
   - later: structured weeks/days/exercises builder

2. Link
   - source URL
   - server-side page import
   - source title
   - likely set/rep/exercise lines
   - review before it becomes runnable

Do not blindly republish full third-party page text. Store the source URL and structured/reviewed training data.

## Progress

Personal dashboard:
- workouts completed
- per-workout volume
- 7-day volume
- 30-day volume
- weekly volume trend
- best sets
- estimated 1RM by main lift
- change since first log
- PR detection
- training-max history
- bodyweight trend
- workout frequency/streaks
- program/week adherence
- exercise-level progression
- filters by date/program/lift/exercise

Volume should distinguish:
- barbell/main-lift volume
- supplemental volume
- assistance volume
- total tracked volume

## Community

Community is opt-in. Default is OFF.

Privacy:
- no email in community feed
- bodyweight is separately opt-in
- disabling Community removes the user's community posts
- private workout history remains private

Community feed:
- completed workout summaries
- volume
- best set / estimated 1RM
- PR badges
- program used
- optional notes
- reactions/comments later
- program sharing/discovery later

## Workout Together

- host creates a 6-character join code
- other signed-in users join
- shared program/week/workout
- each person enters their own weights/reps
- live participant status
- individual volume and e1RM
- combined session volume
- final shared summary
- each result still saves to that person's private history

Future:
- partner visibility controls
- shared timer
- shared exercise order
- "your turn" rotation
- teams/groups

## History

History must ultimately read from `training_sessions`, not from a program/week uniqueness rule.

Required:
- multiple workouts on the same day
- repeat the same lift more than once in a week
- ad-hoc sessions
- planned sessions
- shared sessions
- old legacy sessions

Each completed session is immutable history. Editing a program must never edit an old completed session.

## External program import

Use the Netlify server-side importer.

Safety:
- authenticated requests only
- http/https only
- block local/private network targets
- fetch limited page size
- extract likely workout lines
- user review before saving as runnable structure

Sites that block automated requests can still be saved as source links and manually built.

## Mobile / reliability

Web/PWA remains the first client.

Before native packaging:
- local in-progress workout cache
- offline write queue
- reconnect sync
- visible sync state
- JSON account export
- error recovery
- larger mobile tap targets
- installable PWA

Then:
- Android APK via Capacitor
- iOS wrapper if desired

## Near-term implementation order

1. Run platform-foundation migration.
2. Verify legacy workouts copied to training_sessions.
3. Verify dual-write on a test workout.
4. Wire Today to scheduled flexible workouts.
5. Move History and Progress reads to training_sessions.
6. Add structured custom-workout builder.
7. Add PR detection and exercise-level analytics.
8. Add offline in-progress cache and account export.
9. Improve community feed and program discovery.
10. Package mobile clients.
