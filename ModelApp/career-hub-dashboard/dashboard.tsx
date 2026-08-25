import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Divider, Spinner, Text, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import {
    AddRegular,
    ArrowClockwiseRegular,
    BriefcaseRegular,
    CalendarLtrRegular,
    ChatRegular,
    ChevronRightRegular,
    ClipboardTaskListLtrRegular,
    PeopleRegular,
    WarningRegular,
} from "@fluentui/react-icons";
import type { GeneratedComponentProps } from "./RuntimeTypes";

// ---------------------------------------------------------------------------
// Choice values. RuntimeTypes declares these as non-exported `const enum`s, so
// they are re-declared here as plain constants for runtime use.
// ---------------------------------------------------------------------------

const FOLLOWUP_STATUS_OPEN = 771670000;

const FOLLOWUP_TYPE_CONTACT = 771670000;
const FOLLOWUP_TYPE_APPLICATION = 771670001;

const STAGE_RESEARCHING = 771670000;
const STAGE_APPLIED = 771670001;
const STAGE_INTERVIEWING = 771670002;
const STAGE_OFFER = 771670003;
const STAGE_CLOSED = 771670004;

const STAGE_OPTIONS: Array<{ value: number; label: string }> = [
    { value: STAGE_RESEARCHING, label: "Researching" },
    { value: STAGE_APPLIED, label: "Applied" },
    { value: STAGE_INTERVIEWING, label: "Interviewing" },
    { value: STAGE_OFFER, label: "Offer" },
    { value: STAGE_CLOSED, label: "Closed" },
];

const ACTIVE_STAGES = [STAGE_RESEARCHING, STAGE_APPLIED, STAGE_INTERVIEWING, STAGE_OFFER];

const FORMATTED = "@OData.Community.Display.V1.FormattedValue";

// Saved views the stat tiles drill into.
const VIEW_OPEN_FOLLOWUPS = "a1c0de01-0b18-4e0a-9c31-000000000101";
const VIEW_OVERDUE_FOLLOWUPS = "a1c0de02-0b18-4e0a-9c31-000000000102";
const VIEW_ACTIVE_APPLICATIONS = "<VIEW_ACTIVE_APPLICATIONS_ID>";
const VIEW_ACTIVE_CONTACTS = "<VIEW_ACTIVE_CONTACTS_ID>";

// ---------------------------------------------------------------------------
// Navigation. Xrm.Navigation.navigateTo is the only supported in-app navigation
// (never raw URLs). `entityrecord` / `entitylist` are correct here because the
// targets are real Dataverse forms and views, not other generative pages.
// ---------------------------------------------------------------------------

type XrmLike = {
    Navigation?: {
        navigateTo: (pageInput: Record<string, unknown>, navigationOptions?: Record<string, unknown>) => Promise<unknown>;
    };
};

function getXrm(): XrmLike | null {
    const xrm = (window as unknown as { Xrm?: XrmLike }).Xrm;
    return xrm && xrm.Navigation ? xrm : null;
}

function openNewRecord(entityName: string): void {
    const xrm = getXrm();
    if (!xrm || !xrm.Navigation) return;
    // No entityId => the main form opens in create mode.
    xrm.Navigation.navigateTo({ pageType: "entityrecord", entityName }).catch(() => undefined);
}

function openRecord(entityName: string, entityId: string): void {
    const xrm = getXrm();
    if (!xrm || !xrm.Navigation || !entityId) return;
    xrm.Navigation.navigateTo({ pageType: "entityrecord", entityName, entityId }).catch(() => undefined);
}

function openList(entityName: string, viewId: string): void {
    const xrm = getXrm();
    if (!xrm || !xrm.Navigation) return;
    xrm.Navigation.navigateTo({
        pageType: "entitylist",
        entityName,
        viewId,
        viewType: "savedquery",
    }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Date helpers.
//
// cws_duedate / cws_completeddate / cws_dateapplied are Date-only FORMAT with
// User-Local BEHAVIOUR: the stored instant is local-midnight-in-UTC (an 8/17
// date in PDT is stored as 2026-08-17T07:00:00Z). Reading that instant back
// through the local getters (getFullYear/getMonth/getDate) therefore returns
// the intended calendar date, while ISO/UTC getters do NOT.
//
// All comparisons below run on local YYYY-MM-DD keys, which is why no bare-date
// OData filter is used anywhere: open follow-ups are fetched by status alone
// and bucketed client-side.
// ---------------------------------------------------------------------------

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(value: number): string {
    return value < 10 ? `0${value}` : String(value);
}

function toLocalDate(value: unknown): Date | null {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDateKey(value: unknown): string {
    const parsed = toLocalDate(value);
    if (!parsed) return "";
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function todayKey(): string {
    return localDateKey(new Date());
}

function addDaysKey(days: number): string {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + days);
    return localDateKey(target);
}

function formatDisplayDate(value: unknown): string {
    const parsed = toLocalDate(value);
    if (!parsed) return "—";
    return `${MONTH_LABELS[parsed.getMonth()]} ${pad2(parsed.getDate())}, ${parsed.getFullYear()}`;
}

function relativeDueLabel(dueKey: string): string {
    if (!dueKey) return "No due date";
    const today = todayKey();
    if (dueKey < today) return "Overdue";
    if (dueKey === today) return "Due today";
    if (dueKey === addDaysKey(1)) return "Due tomorrow";
    return "Upcoming";
}

// ---------------------------------------------------------------------------
// Row shapes actually selected by this page
// ---------------------------------------------------------------------------

interface FollowUpRow {
    id: string;
    title: string;
    dueKey: string;
    dueRaw: unknown;
    relatedType: number | null;
    relatedId: string;
    relatedName: string;
}

interface ApplicationRow {
    id: string;
    role: string;
    stage: number | null;
    companyName: string;
}

interface ContactRow {
    id: string;
    name: string;
    companyName: string;
}

interface InteractionRow {
    id: string;
    name: string;
    dateRaw: unknown;
}

interface DashboardData {
    followUps: FollowUpRow[];
    applications: ApplicationRow[];
    contacts: ContactRow[];
    interactions: InteractionRow[];
    companyCount: number;
}

const EMPTY_DATA: DashboardData = {
    followUps: [],
    applications: [],
    contacts: [],
    interactions: [],
    companyCount: 0,
};

// ---------------------------------------------------------------------------
// Host read de-dupe + cache (rules.md Rule 15 / data-caching.md Pattern 1).
// Keys are scoped to this page, not just the entities.
// ---------------------------------------------------------------------------

const winAny = window as unknown as Record<string, unknown>;
const CACHE_KEY = "__ppCareerHubDashboardCache";
const INFLIGHT_KEY = "__ppCareerHubDashboardInflight";

type QueryCapableApi = {
    queryTable: (table: string, options: Record<string, unknown>) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

function asQueryApi(dataApi: unknown): QueryCapableApi {
    return dataApi as unknown as QueryCapableApi;
}

function textOf(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    if (typeof value === "string") return value;
    return value === null || value === undefined ? "" : String(value);
}

function numberOf(row: Record<string, unknown>, key: string): number | null {
    const value = row[key];
    return typeof value === "number" ? value : null;
}

function guidOf(row: Record<string, unknown>, key: string): string {
    // Foreign-key columns come back either as a bare guid or as
    // "/cws_jobapplication(<guid>)" depending on the call path.
    const raw = textOf(row, key);
    const match = raw.match(/\(([^)]+)\)/);
    return (match ? match[1] : raw).toLowerCase();
}

async function loadDashboard(dataApi: unknown): Promise<DashboardData> {
    const api = asQueryApi(dataApi);

    const [followUpResult, applicationResult, contactResult, interactionResult, companyResult] = await Promise.all([
        // Open follow-ups only - bucketing into overdue/today/upcoming happens
        // client-side on local date keys (see the date-handling note above).
        api.queryTable("cws_followup", {
            select: [
                "cws_followupid",
                "cws_title",
                "cws_duedate",
                "cws_relatedtype",
                "_cws_relatedapplication_value",
                "_cws_relatedcontact_value",
            ],
            filter: `cws_status eq ${FOLLOWUP_STATUS_OPEN}`,
            orderBy: "cws_duedate asc",
            pageSize: 200,
        }),
        api.queryTable("cws_jobapplication", {
            select: ["cws_jobapplicationid", "cws_role", "cws_stage", "_cws_company_value"],
            orderBy: "cws_role asc",
            pageSize: 500,
        }),
        api.queryTable("cws_networkingcontact", {
            select: ["cws_networkingcontactid", "cws_contactname", "_cws_company_value"],
            orderBy: "cws_contactname asc",
            pageSize: 500,
        }),
        api.queryTable("cws_interaction", {
            select: ["cws_interactionid", "cws_interactionname", "cws_interactiondate"],
            orderBy: "cws_interactiondate desc",
            pageSize: 5,
        }),
        api.queryTable("cws_company", {
            select: ["cws_companyid"],
            pageSize: 500,
        }),
    ]);

    const followUps: FollowUpRow[] = followUpResult.rows.map((row) => {
        const relatedType = numberOf(row, "cws_relatedtype");
        const isApplication = relatedType === FOLLOWUP_TYPE_APPLICATION;
        const isContact = relatedType === FOLLOWUP_TYPE_CONTACT;
        const fkKey = isApplication ? "_cws_relatedapplication_value" : "_cws_relatedcontact_value";
        return {
            id: textOf(row, "cws_followupid"),
            title: textOf(row, "cws_title") || "Untitled follow-up",
            dueKey: localDateKey(row["cws_duedate"]),
            dueRaw: row["cws_duedate"],
            relatedType,
            relatedId: isApplication || isContact ? guidOf(row, fkKey) : "",
            relatedName: isApplication || isContact ? textOf(row, `${fkKey}${FORMATTED}`) : "",
        };
    });

    const applications: ApplicationRow[] = applicationResult.rows.map((row) => ({
        id: textOf(row, "cws_jobapplicationid"),
        role: textOf(row, "cws_role") || "Untitled role",
        stage: numberOf(row, "cws_stage"),
        companyName: textOf(row, `_cws_company_value${FORMATTED}`),
    }));

    const contacts: ContactRow[] = contactResult.rows.map((row) => ({
        id: textOf(row, "cws_networkingcontactid"),
        name: textOf(row, "cws_contactname") || "Unnamed contact",
        companyName: textOf(row, `_cws_company_value${FORMATTED}`),
    }));

    const interactions: InteractionRow[] = interactionResult.rows.map((row) => ({
        id: textOf(row, "cws_interactionid"),
        name: textOf(row, "cws_interactionname") || "Interaction",
        dateRaw: row["cws_interactiondate"],
    }));

    return { followUps, applications, contacts, interactions, companyCount: companyResult.rows.length };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
    root: {
        position: "relative",
        contain: "layout",
        height: "100%",
        ...shorthands.overflow("hidden"),
        display: "flex",
        flexDirection: "column",
        backgroundColor: tokens.colorNeutralBackground2,
        color: tokens.colorNeutralForeground1,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        ...shorthands.gap(tokens.spacingHorizontalM),
        ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalXL, tokens.spacingVerticalS),
    },
    headerText: { display: "flex", flexDirection: "column", minWidth: 0 },
    scrollArea: {
        flexGrow: 1,
        minHeight: 0,
        overflowY: "auto",
        ...shorthands.padding(0, tokens.spacingHorizontalXL, tokens.spacingVerticalXL),
        display: "flex",
        flexDirection: "column",
        ...shorthands.gap(tokens.spacingVerticalL),
    },
    quickBar: {
        display: "flex",
        flexWrap: "wrap",
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
    tileGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        ...shorthands.gap(tokens.spacingHorizontalM),
        "@media (max-width: 1024px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
        "@media (max-width: 560px)": { gridTemplateColumns: "1fr" },
    },
    // A real <button> so the tile is keyboard reachable and announced as a
    // control. Raw buttons default to `buttontext` (black), so the foreground
    // colour is set explicitly rather than inherited.
    tileButton: {
        display: "block",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        backgroundColor: "transparent",
        color: tokens.colorNeutralForeground1,
        font: "inherit",
        ...shorthands.padding(0),
        ...shorthands.border("0"),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ":focus-visible": {
            ...shorthands.outline("2px", "solid", tokens.colorStrokeFocus2),
            outlineOffset: "2px",
        },
    },
    tile: {
        display: "flex",
        flexDirection: "column",
        ...shorthands.gap(tokens.spacingVerticalXS),
        ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
        minWidth: 0,
        height: "100%",
        ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    },
    tileTop: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...shorthands.gap(tokens.spacingHorizontalS),
        color: tokens.colorNeutralForeground3,
    },
    tileTopLeft: { display: "flex", alignItems: "center", ...shorthands.gap(tokens.spacingHorizontalS), minWidth: 0 },
    tileValue: { fontVariantNumeric: "tabular-nums", fontFamily: tokens.fontFamilyBase },
    panelGrid: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
        ...shorthands.gap(tokens.spacingHorizontalM),
        alignItems: "start",
        "@media (max-width: 900px)": { gridTemplateColumns: "1fr" },
    },
    panel: {
        display: "flex",
        flexDirection: "column",
        ...shorthands.gap(tokens.spacingVerticalS),
        ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
        minWidth: 0,
    },
    panelTitle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
    actionCard: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        color: tokens.colorNeutralForeground1,
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.gap(tokens.spacingHorizontalM),
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        minWidth: 0,
        ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
        ":focus-visible": {
            ...shorthands.outline("2px", "solid", tokens.colorStrokeFocus2),
            outlineOffset: "2px",
        },
    },
    listText: { display: "flex", flexDirection: "column", minWidth: 0 },
    muted: { color: tokens.colorNeutralForeground3 },
    stageRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...shorthands.gap(tokens.spacingHorizontalS),
        ...shorthands.padding(tokens.spacingVerticalXXS, 0),
    },
    centered: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalL),
    },
    errorText: { color: tokens.colorStatusDangerForeground1 },
    truncate: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

// ---------------------------------------------------------------------------
// Presentational sub-components
// ---------------------------------------------------------------------------

function StatTile(props: {
    label: string;
    value: number;
    icon: React.ReactElement;
    caption?: string;
    accent?: string;
    onOpen: () => void;
    openLabel: string;
}) {
    const styles = useStyles();
    return (
        <button type="button" className={styles.tileButton} onClick={props.onOpen} aria-label={props.openLabel}>
            <Card className={styles.tile}>
                <div className={styles.tileTop}>
                    <span className={styles.tileTopLeft}>
                        {props.icon}
                        <Text size={200}>{props.label}</Text>
                    </span>
                    <ChevronRightRegular />
                </div>
                <Text
                    as="p"
                    size={800}
                    weight="semibold"
                    className={styles.tileValue}
                    style={props.accent ? { color: props.accent } : undefined}
                >
                    {props.value}
                </Text>
                {props.caption ? (
                    <Text size={200} className={styles.muted}>
                        {props.caption}
                    </Text>
                ) : null}
            </Card>
        </button>
    );
}

function ActionNeededCard(props: { item: FollowUpRow; context: string }) {
    const styles = useStyles();
    const { item, context } = props;
    const state = relativeDueLabel(item.dueKey);
    const isOverdue = state === "Overdue";
    const isToday = state === "Due today";
    let badgeColor: "danger" | "warning" | "informative" = "informative";
    if (isOverdue) badgeColor = "danger";
    else if (isToday) badgeColor = "warning";
    return (
        <button
            type="button"
            className={styles.actionCard}
            onClick={() => openRecord("cws_followup", item.id)}
            aria-label={`Open follow-up ${item.title}`}
        >
            <span className={styles.listText}>
                <Text weight="semibold" className={styles.truncate}>
                    {item.title}
                </Text>
                <Text size={200} className={`${styles.muted} ${styles.truncate}`}>
                    {context}
                </Text>
            </span>
            <Badge appearance="filled" color={badgeColor} icon={isOverdue ? <WarningRegular /> : undefined}>
                {state}
            </Badge>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const GeneratedComponent = (props: GeneratedComponentProps) => {
    const { dataApi } = props;
    const styles = useStyles();

    const [reloadKey, setReloadKey] = useState(0);
    const dataReady = !!dataApi;

    const [{ data, loading, error }, setState] = useState<{
        data: DashboardData;
        loading: boolean;
        error: string | null;
    }>(() => {
        const cached = winAny[CACHE_KEY] as DashboardData | undefined;
        return { data: cached ?? EMPTY_DATA, loading: cached === undefined, error: null };
    });

    useEffect(() => {
        if (!dataReady) return;

        const cached = winAny[CACHE_KEY] as DashboardData | undefined;
        if (cached !== undefined) {
            if (data !== cached) setState({ data: cached, loading: false, error: null });
            return;
        }

        let cancelled = false;

        let inflight = winAny[INFLIGHT_KEY] as Promise<DashboardData> | undefined;
        if (!inflight) {
            inflight = loadDashboard(dataApi)
                .then((result) => {
                    winAny[CACHE_KEY] = result;
                    return result;
                })
                .finally(() => {
                    if (winAny[INFLIGHT_KEY] === inflight) delete winAny[INFLIGHT_KEY];
                });
            winAny[INFLIGHT_KEY] = inflight;
        }

        inflight
            .then((result) => {
                if (!cancelled) setState({ data: result, loading: false, error: null });
            })
            .catch(() => {
                if (!cancelled) {
                    setState({ data: EMPTY_DATA, loading: false, error: "Unable to load dashboard data." });
                }
            });

        return () => {
            cancelled = true;
        };
        // Readiness + explicit reload key only - never `dataApi` (Rule 15).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataReady, reloadKey]);

    // All hooks stay above every early return (Rule 19) and tolerate empty data.
    const today = todayKey();
    const weekOut = addDaysKey(7);

    const overdue = useMemo(
        () => data.followUps.filter((item) => item.dueKey !== "" && item.dueKey <= today),
        [data.followUps, today],
    );

    const upcoming = useMemo(
        () => data.followUps.filter((item) => item.dueKey > today && item.dueKey <= weekOut),
        [data.followUps, today, weekOut],
    );

    const actionNeeded = useMemo(() => [...overdue, ...upcoming].slice(0, 8), [overdue, upcoming]);

    // Company lookups for the action-needed subheader: the follow-up carries the
    // related record's name via its formatted value, but not the company, so the
    // related id is resolved against the already-fetched application/contact rows.
    const applicationById = useMemo(() => {
        const map = new Map<string, ApplicationRow>();
        data.applications.forEach((application) => map.set(application.id.toLowerCase(), application));
        return map;
    }, [data.applications]);

    const contactById = useMemo(() => {
        const map = new Map<string, ContactRow>();
        data.contacts.forEach((contact) => map.set(contact.id.toLowerCase(), contact));
        return map;
    }, [data.contacts]);

    // [Role OR Contact name] · Company name · Date
    const contextFor = useCallback(
        (item: FollowUpRow): string => {
            let label = item.relatedName;
            let company = "";
            if (item.relatedType === FOLLOWUP_TYPE_APPLICATION) {
                const application = applicationById.get(item.relatedId);
                if (application) {
                    label = application.role;
                    company = application.companyName;
                }
            } else if (item.relatedType === FOLLOWUP_TYPE_CONTACT) {
                const contact = contactById.get(item.relatedId);
                if (contact) {
                    label = contact.name;
                    company = contact.companyName;
                }
            }
            return [label, company, formatDisplayDate(item.dueRaw)].filter((part) => !!part).join(" · ");
        },
        [applicationById, contactById],
    );

    const stageCounts = useMemo(() => {
        const counts = new Map<number, number>();
        data.applications.forEach((application) => {
            if (application.stage === null) return;
            counts.set(application.stage, (counts.get(application.stage) ?? 0) + 1);
        });
        return counts;
    }, [data.applications]);

    const activeApplicationCount = useMemo(
        () => ACTIVE_STAGES.reduce((total, stage) => total + (stageCounts.get(stage) ?? 0), 0),
        [stageCounts],
    );

    const invalidateAndReload = useCallback(() => {
        delete winAny[CACHE_KEY];
        delete winAny[INFLIGHT_KEY];
        setState((prev) => ({ ...prev, loading: true }));
        setReloadKey((key) => key + 1);
    }, []);

    let body: React.ReactNode;
    if (error) {
        body = (
            <Card className={styles.panel}>
                <Text className={styles.errorText}>{error}</Text>
                <div>
                    <Button appearance="primary" onClick={invalidateAndReload}>
                        Try again
                    </Button>
                </div>
            </Card>
        );
    } else if (loading) {
        body = (
            <div className={styles.centered}>
                <Spinner label="Loading dashboard…" />
            </div>
        );
    } else {
        body = (
            <>
                <div className={styles.tileGrid}>
                    <StatTile
                        label="Open follow-ups"
                        value={data.followUps.length}
                        icon={<ClipboardTaskListLtrRegular />}
                        caption={`${upcoming.length} due in the next 7 days`}
                        onOpen={() => openList("cws_followup", VIEW_OPEN_FOLLOWUPS)}
                        openLabel="Open follow-ups: open the Open Follow-ups view"
                    />
                    <StatTile
                        label="Overdue"
                        value={overdue.length}
                        icon={<WarningRegular />}
                        accent={overdue.length > 0 ? tokens.colorStatusDangerForeground1 : undefined}
                        caption={overdue.length > 0 ? "Needs attention today" : "Nothing overdue"}
                        onOpen={() => openList("cws_followup", VIEW_OVERDUE_FOLLOWUPS)}
                        openLabel="Overdue: open the Overdue Follow-ups view"
                    />
                    <StatTile
                        label="Active applications"
                        value={activeApplicationCount}
                        icon={<BriefcaseRegular />}
                        caption={`${stageCounts.get(STAGE_CLOSED) ?? 0} closed`}
                        onOpen={() => openList("cws_jobapplication", VIEW_ACTIVE_APPLICATIONS)}
                        openLabel="Active applications: open the Active Job Applications view"
                    />
                    <StatTile
                        label="Contacts"
                        value={data.contacts.length}
                        icon={<PeopleRegular />}
                        caption={`${data.companyCount} companies`}
                        onOpen={() => openList("cws_networkingcontact", VIEW_ACTIVE_CONTACTS)}
                        openLabel="Contacts: open the Active Networking Contacts view"
                    />
                </div>

                <div className={styles.panelGrid}>
                    <Card className={styles.panel}>
                        <div className={styles.panelTitle}>
                            <Text weight="semibold" size={400}>
                                Action needed
                            </Text>
                            <Text size={200} className={styles.muted}>
                                {overdue.length} overdue · {upcoming.length} upcoming
                            </Text>
                        </div>
                        <Divider />
                        {actionNeeded.length === 0 ? (
                            <Text size={200} className={styles.muted}>
                                Nothing needs attention in the next 7 days.
                            </Text>
                        ) : (
                            actionNeeded.map((item) => (
                                <ActionNeededCard key={item.id} item={item} context={contextFor(item)} />
                            ))
                        )}
                    </Card>

                    <Card className={styles.panel}>
                        <div className={styles.panelTitle}>
                            <Text weight="semibold" size={400}>
                                Pipeline
                            </Text>
                            <CalendarLtrRegular />
                        </div>
                        <Divider />
                        {STAGE_OPTIONS.map((stage) => (
                            <div key={stage.value} className={styles.stageRow}>
                                <Text size={300}>{stage.label}</Text>
                                <Badge
                                    appearance={stage.value === STAGE_CLOSED ? "outline" : "filled"}
                                    color={stage.value === STAGE_OFFER ? "success" : "informative"}
                                >
                                    {stageCounts.get(stage.value) ?? 0}
                                </Badge>
                            </div>
                        ))}
                        <Divider />
                        <div className={styles.panelTitle}>
                            <Text weight="semibold" size={300}>
                                Recent interactions
                            </Text>
                            <ChatRegular />
                        </div>
                        {data.interactions.length === 0 ? (
                            <Text size={200} className={styles.muted}>
                                No interactions logged yet.
                            </Text>
                        ) : (
                            data.interactions.map((interaction) => (
                                <div key={interaction.id} className={styles.listText}>
                                    <Text size={300} className={styles.truncate}>
                                        {interaction.name}
                                    </Text>
                                    <Text size={200} className={styles.muted}>
                                        {formatDisplayDate(interaction.dateRaw)}
                                    </Text>
                                </div>
                            ))
                        )}
                    </Card>
                </div>
            </>
        );
    }

    return (
        <div className={styles.root}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <Text as="h1" size={600} weight="semibold">
                        Career Data Management Dashboard
                    </Text>
                    <Text size={200} className={styles.muted}>
                        Applications, contacts and follow-ups at a glance
                    </Text>
                </div>
                <Button
                    appearance="subtle"
                    icon={<ArrowClockwiseRegular />}
                    onClick={invalidateAndReload}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </div>

            <div className={styles.scrollArea}>
                {/* Each button opens the table's real main form in create mode, so
                    the full form logic (business rules, scripts, subgrids) applies. */}
                <div className={styles.quickBar}>
                    <Button
                        appearance="primary"
                        icon={<AddRegular />}
                        onClick={() => openNewRecord("cws_jobapplication")}
                    >
                        New application
                    </Button>
                    <Button icon={<AddRegular />} onClick={() => openNewRecord("cws_networkingcontact")}>
                        New contact
                    </Button>
                    <Button icon={<AddRegular />} onClick={() => openNewRecord("cws_followup")}>
                        New follow-up
                    </Button>
                    <Button icon={<AddRegular />} onClick={() => openNewRecord("cws_interaction")}>
                        New interaction
                    </Button>
                </div>

                {body}
            </div>
        </div>
    );
};

export default GeneratedComponent;
