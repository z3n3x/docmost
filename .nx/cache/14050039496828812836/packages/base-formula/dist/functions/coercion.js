"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("./registry");
const number_1 = require("../number");
(0, registry_1.register)({
    name: "toNumber", arity: { min: 1, max: 1 }, paramTypes: "any", returnType: "number",
    eval: ([v]) => {
        if (v == null)
            return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    },
    doc: "Parses the value as a number, or null.", category: "coercion",
});
(0, registry_1.register)({
    name: "toString", arity: { min: 1, max: 1 }, paramTypes: "any", returnType: "string",
    eval: ([v]) => (0, number_1.valueToString)(v),
    doc: "Converts the value to a string.", category: "coercion",
});
//# sourceMappingURL=coercion.js.map