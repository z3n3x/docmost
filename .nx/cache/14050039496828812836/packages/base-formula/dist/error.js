"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormulaParseError = void 0;
exports.makeErrorCell = makeErrorCell;
exports.isErrorCell = isErrorCell;
class FormulaParseError extends Error {
    errors;
    constructor(errors) {
        super(errors.map((e) => `${e.code}: ${e.message}`).join("; "));
        this.errors = errors;
        this.name = "FormulaParseError";
    }
}
exports.FormulaParseError = FormulaParseError;
function makeErrorCell(code, msg) {
    return { __err: code, msg, v: 1 };
}
function isErrorCell(v) {
    return (typeof v === "object" &&
        v !== null &&
        "__err" in v &&
        typeof v.__err === "string");
}
//# sourceMappingURL=error.js.map