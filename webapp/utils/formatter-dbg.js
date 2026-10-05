sap.ui.define([
    "sap/ui/core/format/NumberFormat"
], (NumberFormat) => {
    "use strict";

    const floatFormatter = NumberFormat.getFloatInstance({
        minFractionDigits: 0,
        maxFractionDigits: 2,
        groupingEnabled: true
    });

    return {
        formatQuantity: function (value) {
            if (!value) return 0;

            const hasDecimals = (value % 1 !== 0);
            return hasDecimals ? floatFormatter.format(value) : floatFormatter.format(Math.trunc(value));
        },

        valueParse: function (value) {
            if (!value) return 0;
            return floatFormatter.parse(value);
        }
    }
})