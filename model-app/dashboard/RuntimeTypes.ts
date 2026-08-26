// ---------------- Type Definitions which can be imported from ./RuntimeTypes -------------------------
export interface TableRegistrations extends BaseTableRegistrations {
    "cws_company": cws_company,
    "cws_followup": cws_followup,
    "cws_interaction": cws_interaction,
    "cws_jobapplication": cws_jobapplication,
    "cws_networkingcontact": cws_networkingcontact,
}
export interface EnumRegistrations extends BaseEnumRegistrations {
    "cws_company-statecode": cws_company_statecode,
    "cws_company-statuscode": cws_company_statuscode,
    "cws_followup-cws_relatedtype": cws_followup_cws_relatedtype,
    "cws_followup-cws_reminder_all_day": cws_followup_cws_reminder_all_day,
    "cws_followup-cws_reminder_enabled": cws_followup_cws_reminder_enabled,
    "cws_followup-cws_reminder_snyc_status": cws_followup_cws_reminder_snyc_status,
    "cws_followup-cws_status": cws_followup_cws_status,
    "cws_followup-statecode": cws_followup_statecode,
    "cws_followup-statuscode": cws_followup_statuscode,
    "cws_interaction-cws_interactiontype": cws_interaction_cws_interactiontype,
    "cws_interaction-statecode": cws_interaction_statecode,
    "cws_interaction-statuscode": cws_interaction_statuscode,
    "cws_jobapplication-cws_arrangement": cws_jobapplication_cws_arrangement,
    "cws_jobapplication-cws_priority": cws_jobapplication_cws_priority,
    "cws_jobapplication-cws_stage": cws_jobapplication_cws_stage,
    "cws_jobapplication-statecode": cws_jobapplication_statecode,
    "cws_jobapplication-statuscode": cws_jobapplication_statuscode,
    "cws_networkingcontact-cws_relationship": cws_networkingcontact_cws_relationship,
    "cws_networkingcontact-statecode": cws_networkingcontact_statecode,
    "cws_networkingcontact-statuscode": cws_networkingcontact_statuscode,
}
export type cws_company = TableRow<{
    // Primary Key Column
    readonly cws_companyid: string,
    readonly createdbyname: string,
    readonly createdbyyominame: string,
    readonly createdonbehalfbyname: string,
    readonly createdonbehalfbyyominame: string,
    cws_companyname: string,
    readonly modifiedbyname: string,
    readonly modifiedbyyominame: string,
    readonly modifiedonbehalfbyname: string,
    readonly modifiedonbehalfbyyominame: string,
    readonly owningbusinessunitname: string,
    statecode: cws_company_statecode,
    statuscode: cws_company_statuscode,
}>

export type cws_followup = TableRow<{
    // Primary Key Column
    readonly cws_followupid: string,
    readonly createdbyname: string,
    readonly createdbyyominame: string,
    readonly createdonbehalfbyname: string,
    readonly createdonbehalfbyyominame: string,
    cws_completeddate: Date,
    cws_duedate: Date,
    cws_notes: string,
    cws_outlook_calendar_id: string,
    cws_outlook_event_id: string,
    // Foreign Key Column
    _cws_relatedapplication_value: `/cws_jobapplication(${string})`,
    readonly cws_relatedapplicationname: string,
    // Foreign Key Column
    _cws_relatedcontact_value: `/cws_networkingcontact(${string})`,
    readonly cws_relatedcontactname: string,
    cws_relatedtype: cws_followup_cws_relatedtype,
    cws_reminder_all_day: cws_followup_cws_reminder_all_day,
    cws_reminder_enabled: cws_followup_cws_reminder_enabled,
    cws_reminder_end_at: Date,
    cws_reminder_last_synced_at: Date,
    cws_reminder_snyc_status: cws_followup_cws_reminder_snyc_status,
    cws_reminder_start_at: Date,
    cws_reminder_sync_error: string,
    cws_reminder_time_zone: string,
    cws_status: cws_followup_cws_status,
    cws_title: string,
    readonly modifiedbyname: string,
    readonly modifiedbyyominame: string,
    readonly modifiedonbehalfbyname: string,
    readonly modifiedonbehalfbyyominame: string,
    readonly owningbusinessunitname: string,
    statecode: cws_followup_statecode,
    statuscode: cws_followup_statuscode,
}>

export type cws_interaction = TableRow<{
    // Primary Key Column
    readonly cws_interactionid: string,
    readonly createdbyname: string,
    readonly createdbyyominame: string,
    readonly createdonbehalfbyname: string,
    readonly createdonbehalfbyyominame: string,
    // Foreign Key Column
    _cws_contact_value: `/cws_networkingcontact(${string})`,
    readonly cws_contactname: string,
    cws_interactiondate: Date,
    cws_interactionname: string,
    cws_interactiontype: cws_interaction_cws_interactiontype,
    cws_notes: string,
    // Foreign Key Column
    _cws_relatedapplication_value: `/cws_jobapplication(${string})`,
    readonly cws_relatedapplicationname: string,
    readonly modifiedbyname: string,
    readonly modifiedbyyominame: string,
    readonly modifiedonbehalfbyname: string,
    readonly modifiedonbehalfbyyominame: string,
    readonly owningbusinessunitname: string,
    statecode: cws_interaction_statecode,
    statuscode: cws_interaction_statuscode,
}>

export type cws_jobapplication = TableRow<{
    // Primary Key Column
    readonly cws_jobapplicationid: string,
    readonly createdbyname: string,
    readonly createdbyyominame: string,
    readonly createdonbehalfbyname: string,
    readonly createdonbehalfbyyominame: string,
    cws_arrangement: cws_jobapplication_cws_arrangement,
    // Foreign Key Column
    readonly _cws_businessgroup_value: `/cws_businessgroup(${string})`,
    readonly cws_businessgroupname: string,
    cws_city: string,
    // Foreign Key Column
    _cws_company_value: `/cws_company(${string})`,
    readonly cws_companyname: string,
    cws_dateapplied: Date,
    cws_jobid: string,
    cws_joblink: string,
    cws_nextstep: string,
    cws_notes: string,
    cws_priority: cws_jobapplication_cws_priority,
    cws_role: string,
    cws_stage: cws_jobapplication_cws_stage,
    readonly modifiedbyname: string,
    readonly modifiedbyyominame: string,
    readonly modifiedonbehalfbyname: string,
    readonly modifiedonbehalfbyyominame: string,
    readonly owningbusinessunitname: string,
    statecode: cws_jobapplication_statecode,
    statuscode: cws_jobapplication_statuscode,
}>

export type cws_networkingcontact = TableRow<{
    // Primary Key Column
    readonly cws_networkingcontactid: string,
    readonly createdbyname: string,
    readonly createdbyyominame: string,
    readonly createdonbehalfbyname: string,
    readonly createdonbehalfbyyominame: string,
    // Foreign Key Column
    readonly _cws_businessgroup_value: `/cws_businessgroup(${string})`,
    readonly cws_businessgroupname: string,
    cws_city: string,
    // Foreign Key Column
    _cws_company_value: `/cws_company(${string})`,
    readonly cws_companyname: string,
    cws_contactname: string,
    cws_email: string,
    cws_notes: string,
    cws_relationship: cws_networkingcontact_cws_relationship,
    cws_role: string,
    readonly modifiedbyname: string,
    readonly modifiedbyyominame: string,
    readonly modifiedonbehalfbyname: string,
    readonly modifiedonbehalfbyyominame: string,
    readonly owningbusinessunitname: string,
    statecode: cws_networkingcontact_statecode,
    statuscode: cws_networkingcontact_statuscode,
}>

const enum cws_company_statecode {
"Active" = 0,
"Inactive" = 1,
}
const enum cws_company_statuscode {
"Active" = 1,
"Inactive" = 2,
}
const enum cws_followup_cws_relatedtype {
"Contact" = 771670000,
"Application" = 771670001,
"None/Standalone" = 771670002,
}
const enum cws_followup_cws_reminder_all_day {
"No" = 0,
"Yes" = 1,
}
const enum cws_followup_cws_reminder_enabled {
"No" = 0,
"Yes" = 1,
}
const enum cws_followup_cws_reminder_snyc_status {
"Not synced" = 771670000,
"Synced" = 771670001,
"Conflict" = 771670002,
"Error" = 771670003,
}
const enum cws_followup_cws_status {
"Open" = 771670000,
"Completed" = 771670001,
}
const enum cws_followup_statecode {
"Active" = 0,
"Inactive" = 1,
}
const enum cws_followup_statuscode {
"Active" = 1,
"Inactive" = 2,
}
const enum cws_interaction_cws_interactiontype {
"Networking Chat" = 771670000,
"LinkedIn" = 771670001,
"Email" = 771670002,
"Call" = 771670003,
"Meeting" = 771670004,
"Event" = 771670005,
"Interview" = 771670006,
"Other" = 771670009,
}
const enum cws_interaction_statecode {
"Active" = 0,
"Inactive" = 1,
}
const enum cws_interaction_statuscode {
"Active" = 1,
"Inactive" = 2,
}
const enum cws_jobapplication_cws_arrangement {
"Remote" = 771670000,
"On-site" = 771670001,
"Hybrid" = 771670002,
}
const enum cws_jobapplication_cws_priority {
"High" = 771670000,
"Medium" = 771670001,
"Low" = 771670002,
}
const enum cws_jobapplication_cws_stage {
"Researching" = 771670000,
"Applied" = 771670001,
"Interviewing" = 771670002,
"Offer" = 771670003,
"Closed" = 771670004,
}
const enum cws_jobapplication_statecode {
"Active" = 0,
"Inactive" = 1,
}
const enum cws_jobapplication_statuscode {
"Active" = 1,
"Inactive" = 2,
}
const enum cws_networkingcontact_cws_relationship {
"New" = 771670001,
"Recruiter" = 771670004,
"Hiring Manager" = 771670005,
"Warm" = 771670000,
"Mentor" = 771670003,
"Dormant" = 771670002,
}
const enum cws_networkingcontact_statecode {
"Active" = 0,
"Inactive" = 1,
}
const enum cws_networkingcontact_statuscode {
"Active" = 1,
"Inactive" = 2,
}

export interface UxAgentDataApi extends BaseUxAgentDataApi<TableRegistrations, EnumRegistrations> {}

export interface GeneratedComponentProps {
    dataApi: UxAgentDataApi;
}

