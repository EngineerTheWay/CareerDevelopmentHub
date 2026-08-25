# Career Copilot — Portfolio Demo Script

A ten-turn conversation that shows the system at its best in about four minutes. Distinct
from `test-conversation.md`, which is the exhaustive 22-turn regression pass — this one is
built to be recorded.

**Design choices:** it avoids anything destructive so it can be re-run, it never sends an
email, and it front-loads the behaviour that makes the build interesting rather than the
CRUD that makes it ordinary.

**Before recording**
- Publish the agent, and confirm `SendDraft` resolves (or stay off the send path entirely)
- Clear the Drafts folder of earlier `ZZ Test` drafts
- Delete any interaction whose note literally reads `none`
- Have Outlook open in a second tab — turn 4 is worth showing there

---

## Act 1 — Orientation (1 turn)

### 1. "What's on my plate today?"

Returns overdue / due soon / upcoming follow-ups, active applications, and today's calendar
in one pass.

**Say while it runs:** every date bucket is computed server-side on local calendar dates.
Dataverse stores these as Date-only with User-Local behaviour, which makes equality filters
silently return zero rows — so the flow never filters on dates in the query at all.

---

## Act 2 — The part worth leading with (3 turns)

### 2. "Draft a thank-you to Caleb Way for the coffee chat last Thursday."

Watch for three things happening in sequence:

- It resolves the contact and pulls his real email and history
- It saves the draft **immediately** and shows it, rather than asking permission to save
- It notices the coffee chat **isn't in the interaction history** and offers to log it

**The point:** it had every reason to just write a nice email. Instead it flagged that the
record was incomplete. Nothing in the draft was invented — the details came from Dataverse
or from what you just said, never from the model's imagination.

### 3. "Leave it in drafts for now. And yes, log the chat — we caught up on work and his new dog."

Logs the interaction against the contact. Note it did **not** ask you for an application id
or a timestamp — the flow supplies those.

### 4. "Update the email with that context."

The revised draft now references the actual conversation. **Switch to Outlook and show the
draft sitting there** — real artifact, correct recipient, formatting intact.

---

## Act 3 — The engineering story (3 turns)

This is the differentiator. Each refusal comes from the flow, not the prompt.

### 5. "Replace the notes on my Cloud Adoption Manager application with 'starting over'."

**Refused.** Notes are append-only, and it redirects you to the right tool.

**Say:** the model isn't choosing to refuse. The flow physically cannot overwrite a notes
field — `AppendNotes` is read-modify-write, and `UpdateRecordFields` rejects any attempt to
touch notes at all. A prompt can be talked out of a rule. This can't.

### 6. "Fine — append a note that the recruiter mentioned a second round."

Appends with today's date, existing content preserved.

### 7. "Close my Customer Insights Manager application at Apex Financial."

**Refused**, asks you to confirm. Say yes and it closes, reporting `Offer → Closed`.

**Say:** the flow returns the previous stage, so the agent states what actually changed
rather than restating what it intended to do.

---

## Act 4 — Judgment (2 turns)

### 8. "Find my contact Caleb."

Two real matches — **Caleb Way** at Microsoft and **Caleb Price** at Northstar Analytics.
It presents both and asks. It does not guess.

### 9. "Clean up my old applications."

Refuses to act on a vague instruction and asks which ones.

---

## Close (1 turn)

### 10. "How's my search going overall?"

Stage counts, stalled applications, dormant contacts, follow-up completion rate.

---

## What to capture

If you only screenshot four moments, use these:

1. **Turn 2** — the unprompted "this isn't logged, want me to record it?"
2. **Turn 5** — the append-only refusal
3. **Turn 7** — the close guard
4. **Turn 8** — two Calebs, asking instead of guessing

An agent that declines to overwrite, declines to guess, and volunteers that your records are
incomplete is a more interesting artifact than one that cheerfully does all three.

---

## Talking points

**The architecture.** The agent has no generic database access. Nineteen typed flows, each
with a fixed contract. Its entire data layer used to be one generic Dataverse tool that
re-improvised every query — which is why the same question could produce different results
on different days.

**Where the rules live.** Seven safety behaviours are enforced in the flows, not the prompt:
append-only notes, no stage writes through the generic updater, confirmation before closing,
exact-name match before deleting, same-company-only contact links, drafts that cannot send,
and sends that require the exact subject echoed back.

**Business logic parity.** Contacts can only link to applications at the same company —
because the apps filter those pairs out. An agent that could create records the UI can't
show would be worse than one that's slightly less capable.

**Rules the apps couldn't enforce.** Two behaviours previously lived only in model-driven
form scripts and never ran for API writes: stamping a follow-up's completed date, and
building an interaction's display name. Both now run server-side, so the agent and the app
produce identical records.

**What testing caught.** Building it surfaced bugs that all looked like inert configuration:
`filter()` isn't a Power Automate function, `{ }` in instructions is parsed as Power Fx, a
parameter without `x-ms-dynamically-added` doesn't exist to the agent, and Outlook bodies are
HTML so plain newlines vanish. Each validated fine and only failed in conversation.
