"use strict";

// Builds the Interaction primary name from Type + Contact + Date as the user
// edits the form, mirroring getInteractionTitle() in the Career Hub code app.
// Registered on the OnChange event of cws_interactiontype, cws_contact and
// cws_interactiondate. setValue() does not raise OnChange, so this cannot loop.

var CDH = window.CDH || {};
CDH.Interaction = (function () {
    var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var MAX_LENGTH = 850;

    function formatDate(value) {
        if (!value) { return ""; }
        var day = value.getDate();
        return MONTHS[value.getMonth()] + " " + (day < 10 ? "0" + day : day) +
               ", " + value.getFullYear();
    }

    function optionLabel(attribute) {
        if (!attribute || attribute.getValue() === null) { return ""; }
        return attribute.getText() || "";
    }

    function lookupName(attribute) {
        var value = attribute ? attribute.getValue() : null;
        if (!value || !value.length) { return ""; }
        return value[0].name || "";
    }

    function updateName(executionContext) {
        var formContext = executionContext.getFormContext();
        var nameAttribute = formContext.getAttribute("cws_interactionname");
        if (!nameAttribute) { return; }

        var type = optionLabel(formContext.getAttribute("cws_interactiontype"));
        var contact = lookupName(formContext.getAttribute("cws_contact"));
        var dateAttribute = formContext.getAttribute("cws_interactiondate");
        var date = formatDate(dateAttribute ? dateAttribute.getValue() : null);

        // Nothing to build from yet - leave whatever is there for the
        // server-side workflow to finish.
        if (!type && !contact && !date) { return; }

        var title = type || "Interaction";
        if (contact) { title += " with " + contact; }
        if (date) { title += " on " + date; }
        if (title.length > MAX_LENGTH) { title = title.substring(0, MAX_LENGTH); }

        if (nameAttribute.getValue() !== title) {
            nameAttribute.setValue(title);
        }
    }

    return { updateName: updateName };
})();
window.CDH = CDH;
