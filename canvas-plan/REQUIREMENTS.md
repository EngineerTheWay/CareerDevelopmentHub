# Career Quick Capture — mobile canvas companion

> **Design snapshot — 2026-08-18.** This is a plan written *before* the canvas app was built,
> kept as a record of intent. It is not maintained against the shipped implementation and
> may describe fields or behaviour that changed during the build. For what actually
> exists, read the code.

Environment: <ENVIRONMENT_NAME> (<ENVIRONMENT_ID>)
Solution: CareerDevelopmentHub ("Career Development Hub - Dataverse")
Layout: Phone. Purpose: fast data ENTRY on a call or at an event — not data management.

## Confirmed decisions (2026-08-18)

1. Entry scope: Networking Contact, Interaction, Follow Up. No Job Application entry.
2. New company: create inline on the spot (create cws_company, link immediately).
   Business Group stays optional and filters to the selected company.
3. Home: three large quick-add tiles + today's/overdue follow-ups, tappable to complete.
4. Post-save: toast + contextual next step (Contact -> Log interaction / Add follow-up,
   prefilled to that contact).
5. Reminders: do NOT touch cws_reminder_* fields. Plain follow-ups only.
6. Interaction contact picker offers "+ New contact" -> quick contact form -> returns
   with the new contact prefilled.
7. Theme: match the code app.

## Theme tokens (converted from code app src/index.css oklch)

background   RGBA(252, 246, 233, 1)
foreground   RGBA(8, 19, 28, 1)
card         RGBA(255, 255, 255, 1)
primary      RGBA(0, 72, 126, 1)
primaryFg    RGBA(252, 248, 240, 1)
secondary    RGBA(232, 221, 196, 1)
muted        RGBA(239, 231, 215, 1)
mutedFg      RGBA(45, 63, 78, 1)
accent       RGBA(213, 141, 37, 1)
destructive  RGBA(176, 10, 29, 1)
border       RGBA(211, 201, 185, 1)
radius       12 (0.75rem)

## Field rules to mirror from the code app

### cws_networkingcontact
- cws_ContactName    String   REQUIRED
- cws_Company        Lookup -> cws_company   REQUIRED (inline-create allowed)
- cws_Relationship   Choice   REQUIRED  {New, Recruiter, Hiring Manager, Warm, Mentor, Dormant}
- cws_BusinessGroup  Lookup -> cws_businessgroup  Recommended
  FILTER: only groups whose cws_Company = the selected company.
  Empty label: "No groups by this name for <Company>" / "Enter a company first".
- cws_Role, cws_Email, cws_City  String optional
- cws_Notes          Memo optional

### cws_interaction
- cws_Contact          Lookup -> cws_networkingcontact  REQUIRED
- cws_InteractionDate  DateTime  REQUIRED  (default today)
- cws_InteractionType  Choice    REQUIRED
  {Networking Chat, LinkedIn, Email, Call, Meeting, Event, Interview, Other}
- cws_RelatedApplication Lookup -> cws_jobapplication  optional
- cws_Notes            Memo optional
- cws_InteractionName  String optional

### cws_followup
- cws_Title       String  REQUIRED
- cws_DueDate     Date-only / UserLocal  REQUIRED (default today)
- cws_Status      Choice  REQUIRED {Open=771670000, Completed=771670001}, default Open
- cws_RelatedType Choice  REQUIRED {Contact=771670000, Application=771670001, None=771670002}
  RULE: switching type clears the other lookup.
  Contact -> show cws_RelatedContact; Application -> show cws_RelatedApplication;
  None -> show neither.
- cws_Notes       Memo optional
- cws_CompletedDate set only when marking complete.
- DO NOT write cws_reminder_* fields.

## Date trap (carried from prior work)

cws_DueDate / cws_CompletedDate are Date-only + User-Local. Equality filtering in OData
is unreliable. Fetch open follow-ups by cws_Status alone and bucket overdue/today
client-side on local date keys, exactly as the model app dashboard does.

---

# VERIFIED SCHEMA (from get_data_source_schema — do not guess these)

Data sources present in the app (all CdsNative, Writable, Delegatable):
Business Groups, Companies, Contact Applications, Follow Ups, Interactions,
Job Applications, Networking Contacts.

## Column names (Power Fx)

### Networking Contacts
cws_contactname (String), cws_Company (DataEntity), cws_BusinessGroup (DataEntity),
cws_relationship (OptionSetValue), cws_role (String), cws_email (String),
cws_city (String), cws_notes (String), cws_networkingcontactid (Guid)

### Interactions
cws_Contact (DataEntity), cws_interactiondate (DateTime),
cws_interactiontype (OptionSetValue), cws_RelatedApplication (DataEntity),
cws_notes (String), cws_interactionname (String), cws_interactionid (Guid)

### Follow Ups
cws_title (String), cws_duedate (DateTime), cws_status (OptionSetValue),
cws_relatedtype (OptionSetValue), cws_RelatedContact (DataEntity),
cws_RelatedApplication (DataEntity), cws_notes (String),
cws_completeddate (DateTime), cws_followupid (Guid)

### Companies
cws_companyname (String), cws_companyid (Guid)

### Business Groups
cws_businessgroupname (String), cws_Company (DataEntity), cws_businessgroupid (Guid)

## Option set names — EXACT, quoted as shown

'Relationship (Networking Contacts)'    -> New, Recruiter, 'Hiring Manager', Warm, Mentor, Dormant
'Interaction Type (Interactions)'       -> 'Networking Chat', LinkedIn, Email, Call, Meeting, Event, Interview, Other
'Related Type (Follow Ups)'             -> Contact, Application, 'None/Standalone'
'Status (Follow Ups)'                   -> Open, Completed        <-- this is cws_status

### TRAP 1 — two option sets differ by a numeric suffix
cws_status  uses option set 'Status (Follow Ups)'
statecode   uses option set 'Status (Follow Ups)_1'  (Active/Inactive)
Never write 'Status (Follow Ups)'.Active — that member does not exist.
Open follow-ups are cws_status = 'Status (Follow Ups)'.Open.

### TRAP 2 — members needing quotes
'Hiring Manager', 'Networking Chat', 'None/Standalone' contain a space or slash and
MUST be single-quoted after the dot: 'Related Type (Follow Ups)'.'None/Standalone'.

## Lookup writes (Patch)

Set DataEntity lookups to a whole record, not a Guid:
  cws_Company: LookUp(Companies, cws_companyid = varCompanyId)
Or to the record already held in a variable/gallery selection.

## Delegation

cws_notes is a multiline String; StartsWith/Filter on it is not delegable — do not
filter on notes. Filter Companies/Contacts by name with StartsWith (delegable).
Follow-up bucketing stays client-side per the date trap above.
