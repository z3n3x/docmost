"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("./registry");
const error_1 = require("../error");
const toDate = (v) => {
    if (v == null)
        return null;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
};
(0, registry_1.register)({
    name: "now", arity: { min: 0, max: 0 }, paramTypes: [], returnType: "date",
    eval: () => new Date().toISOString(),
    doc: "Current timestamp.", category: "date",
});
(0, registry_1.register)({
    name: "today", arity: { min: 0, max: 0 }, paramTypes: [], returnType: "date",
    eval: () => {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        return d.toISOString();
    },
    doc: "Midnight UTC of today.", category: "date",
});
(0, registry_1.register)({
    name: "dateAdd", arity: { min: 3, max: 3 }, paramTypes: ["date", "number", "string"], returnType: "date",
    eval: ([base, amt, unit]) => {
        const d = toDate(base);
        if (!d)
            return (0, error_1.makeErrorCell)("DATE_INVALID", "invalid date");
        const n = Number(amt);
        const u = String(unit);
        const r = new Date(d);
        if (u === "days")
            r.setUTCDate(r.getUTCDate() + n);
        else if (u === "hours")
            r.setUTCHours(r.getUTCHours() + n);
        else if (u === "minutes")
            r.setUTCMinutes(r.getUTCMinutes() + n);
        else if (u === "months")
            r.setUTCMonth(r.getUTCMonth() + n);
        else if (u === "years")
            r.setUTCFullYear(r.getUTCFullYear() + n);
        else
            return (0, error_1.makeErrorCell)("TYPE_MISMATCH", `unknown unit ${u}`);
        return r.toISOString();
    },
    doc: "Adds a duration to a date. Units: days, hours, minutes, months, years.", category: "date",
});
(0, registry_1.register)({
    name: "dateBetween", arity: { min: 3, max: 3 }, paramTypes: ["date", "date", "string"], returnType: "number",
    eval: ([a, b, unit]) => {
        const da = toDate(a), db = toDate(b);
        if (!da || !db)
            return (0, error_1.makeErrorCell)("DATE_INVALID", "invalid date");
        const ms = db.getTime() - da.getTime();
        const u = String(unit);
        if (u === "days")
            return Math.floor(ms / 86_400_000);
        if (u === "hours")
            return Math.floor(ms / 3_600_000);
        if (u === "minutes")
            return Math.floor(ms / 60_000);
        return (0, error_1.makeErrorCell)("TYPE_MISMATCH", `unknown unit ${u}`);
    },
    doc: "Difference between two dates in a given unit.", category: "date",
});
//# sourceMappingURL=date.js.map