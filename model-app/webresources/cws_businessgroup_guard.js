"use strict";

// Keeps Company and Business Group consistent on the Contact and Application
// forms, mirroring the company-scoped business group resolution in the Career
// Hub code app.
//
// The forms already use out-of-the-box related-records filtering
// (DependentAttributeName + FilterRelationshipName) plus DisableMru, which
// together constrain what the lookup will OFFER. Neither one re-checks a value
// that is already in the field, so the platform still allows this sequence:
//
//   pick Company A -> pick Business Group "Sales" (belongs to A)
//   -> change Company to B -> save
//
// leaving a contact at company B carrying a business group owned by A. This
// script closes that gap from both directions.
//
// Registered on the OnChange events of cws_company and cws_businessgroup on
// both the Contact and Application main forms. Both tables use the same two
// logical names, so one library serves both without per-form configuration.
//
// Note this is a client-side guard only - it protects the model-driven app, not
// direct API writes. Dataverse cannot express "lookup B's parent must equal
// lookup A" declaratively; enforcing it everywhere would need a synchronous
// plug-in on Create/Update.

var CDH = window.CDH || {};
CDH.BusinessGroupGuard = (function () {
    var COMPANY = "cws_company";
    var BUSINESS_GROUP = "cws_businessgroup";
    var COMPANY_LOOKUP_ON_GROUP = "_cws_company_value";
    var NOTIFICATION_ID = "cdh_businessgroup_company_mismatch";

    // Dataverse returns lookup ids wrapped in braces from getValue() but bare
    // from the Web API, so normalise before comparing.
    function normalizeId(id) {
        return id ? String(id).replace(/[{}]/g, "").toLowerCase() : null;
    }

    function lookupValue(formContext, attributeName) {
        var attribute = formContext.getAttribute(attributeName);
        if (!attribute) return null;
        var value = attribute.getValue();
        return value && value.length ? value[0] : null;
    }

    function clearBusinessGroup(formContext, message) {
        var attribute = formContext.getAttribute(BUSINESS_GROUP);
        if (attribute) attribute.setValue(null);

        var control = formContext.getControl(BUSINESS_GROUP);
        if (control && message) {
            control.setNotification(message, NOTIFICATION_ID);
            // The notification describes a value that is no longer in the
            // field, so retire it once the user has had a chance to read it.
            window.setTimeout(function () {
                try {
                    control.clearNotification(NOTIFICATION_ID);
                } catch (e) {
                    // The form can navigate away before the timer fires.
                }
            }, 6000);
        }
    }

    // Resolves the company that owns a business group. Results are cached for
    // the life of the form: a business group's parent company effectively never
    // changes, and this runs on every company edit.
    var companyCache = {};
    function companyForBusinessGroup(businessGroupId) {
        var key = normalizeId(businessGroupId);
        if (companyCache[key]) return companyCache[key];

        companyCache[key] = Xrm.WebApi.retrieveRecord(
            "cws_businessgroup",
            key,
            "?$select=" + COMPANY_LOOKUP_ON_GROUP
        ).then(function (record) {
            return {
                id: normalizeId(record[COMPANY_LOOKUP_ON_GROUP]),
                // The formatted-value annotation carries the company name, so
                // adopting a company below does not need a second retrieve.
                name: record[COMPANY_LOOKUP_ON_GROUP + "@OData.Community.Display.V1.FormattedValue"] || ""
            };
        });

        return companyCache[key];
    }

    // OnChange of cws_company: drop a business group that belongs to a
    // different company than the one now selected.
    function onCompanyChange(executionContext) {
        var formContext = executionContext.getFormContext();
        var businessGroup = lookupValue(formContext, BUSINESS_GROUP);
        if (!businessGroup) return;

        var company = lookupValue(formContext, COMPANY);
        if (!company) {
            clearBusinessGroup(formContext, "Business group cleared because the company was removed.");
            return;
        }

        var companyId = normalizeId(company.id);
        companyForBusinessGroup(businessGroup.id).then(function (owner) {
            if (owner.id === companyId) return;
            clearBusinessGroup(
                formContext,
                "“" + businessGroup.name + "” belongs to a different company. Select a business group under " + company.name + "."
            );
        }, function () {
            // If the group cannot be read, leave the value alone rather than
            // silently discarding the user's input on a transient failure.
        });
    }

    // OnChange of cws_businessgroup: catch a group picked from outside the
    // filtered view. When no company is set yet, adopt the group's company
    // instead of rejecting the selection - it is the only valid answer.
    function onBusinessGroupChange(executionContext) {
        var formContext = executionContext.getFormContext();
        var businessGroup = lookupValue(formContext, BUSINESS_GROUP);
        if (!businessGroup) return;

        var company = lookupValue(formContext, COMPANY);
        var companyId = company ? normalizeId(company.id) : null;

        companyForBusinessGroup(businessGroup.id).then(function (owner) {
            if (!owner.id || owner.id === companyId) return;

            if (!companyId) {
                var companyAttribute = formContext.getAttribute(COMPANY);
                if (companyAttribute) {
                    companyAttribute.setValue([{ id: owner.id, entityType: "cws_company", name: owner.name }]);
                }
                return;
            }

            clearBusinessGroup(
                formContext,
                "“" + businessGroup.name + "” belongs to a different company. Select a business group under " + company.name + "."
            );
        }, function () {
            // Transient read failure - keep the selection.
        });
    }

    return {
        onCompanyChange: onCompanyChange,
        onBusinessGroupChange: onBusinessGroupChange
    };
})();
window.CDH = CDH;
