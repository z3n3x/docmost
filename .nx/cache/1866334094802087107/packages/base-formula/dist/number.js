"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapNumber = snapNumber;
exports.valueToString = valueToString;
function snapNumber(n) {
    if (!Number.isFinite(n))
        return n;
    return Number(n.toPrecision(15));
}
function valueToString(v) {
    if (v == null)
        return "";
    if (typeof v === "number")
        return String(snapNumber(v));
    return String(v);
}
//# sourceMappingURL=number.js.map