"use strict";

// Hides related-record sections while a record is being created.
//
// Subgrids cannot resolve a relationship until the record has an id, so on a
// Create form (getFormType() === 1) the platform renders them empty. The
// section that contains them is NOT hidden automatically, which leaves an
// empty bordered container on the form.
//
// Business rules cannot help here: their Set Visibility action targets columns
// only, never sections or tabs. Hence this script.
//
// Registered on the form OnLoad event of any form that carries subgrids.
// It is generic - it hides any section whose controls are ALL subgrids - so the
// same library can be attached to every form without per-form configuration.
// After the first save the form reloads as an Update form and the sections
// appear normally.

var CDH = window.CDH || {};
CDH.FormSections = (function () {
    var FORM_TYPE_CREATE = 1;

    function isSubgrid(control) {
        if (!control || typeof control.getControlType !== "function") return false;
        var type = control.getControlType();
        // "subgrid" covers related-record grids; the editable-grid PCF reports a
        // custom control name, so treat that as a grid too.
        return type === "subgrid" || type === "customsubgrid:MscrmControls.Grid.ReadOnlyGrid";
    }

    function sectionIsOnlySubgrids(section) {
        if (!section || typeof section.controls === "undefined") return false;
        var controls = section.controls.get();
        if (!controls || controls.length === 0) return false;
        for (var i = 0; i < controls.length; i++) {
            if (!isSubgrid(controls[i])) return false;
        }
        return true;
    }

    function applySectionVisibility(executionContext) {
        var formContext = executionContext.getFormContext();
        if (!formContext || !formContext.ui) return;

        var isCreate = formContext.ui.getFormType() === FORM_TYPE_CREATE;

        formContext.ui.tabs.forEach(function (tab) {
            tab.sections.forEach(function (section) {
                if (!sectionIsOnlySubgrids(section)) return;
                try {
                    section.setVisible(!isCreate);
                } catch (e) {
                    // A locked or already-removed section can throw; skip it
                    // rather than breaking the rest of the form load.
                }
            });
        });
    }

    return { applySectionVisibility: applySectionVisibility };
})();
window.CDH = CDH;
