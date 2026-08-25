"use strict";

// Keeps Completed Date in step with Status as the user edits the form,
// mirroring markComplete()/reopen() in the Career Hub code app.
// Registered on the OnChange event of cws_status.
//
// The date is snapped to LOCAL midnight so the stored value matches what the
// date picker writes when a date is chosen by hand. cws_completeddate is
// Date-only format with User Local behaviour, so a value carrying a real
// time-of-day would break equality filters against it.

var CDH = window.CDH || {};
CDH.FollowUp = (function () {
    var STATUS_OPEN = 771670000;
    var STATUS_COMPLETED = 771670001;

    function localToday() {
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
    }

    function syncCompletedDate(executionContext) {
        var formContext = executionContext.getFormContext();
        var statusAttribute = formContext.getAttribute("cws_status");
        var completedAttribute = formContext.getAttribute("cws_completeddate");
        if (!statusAttribute || !completedAttribute) { return; }

        var status = statusAttribute.getValue();

        if (status === STATUS_COMPLETED) {
            // Only stamp an empty value so a deliberately backdated
            // completion is never overwritten.
            if (!completedAttribute.getValue()) {
                completedAttribute.setValue(localToday());
            }
            return;
        }

        if (status === STATUS_OPEN && completedAttribute.getValue()) {
            completedAttribute.setValue(null);
        }
    }

    return { syncCompletedDate: syncCompletedDate };
})();
window.CDH = CDH;
