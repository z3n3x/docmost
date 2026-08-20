"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("./registry");
const number_1 = require("../number");
const s = (v) => (0, number_1.valueToString)(v);
(0, registry_1.register)({
    name: "concat", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "string",
    eval: (args) => args.map(s).join(""),
    doc: "Concatenates strings.", category: "string",
});
(0, registry_1.register)({
    name: "length", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "number",
    eval: ([v]) => s(v).length,
    doc: "Length of a string.", category: "string",
});
(0, registry_1.register)({
    name: "contains", arity: { min: 2, max: 2 }, paramTypes: ["string", "string"], returnType: "boolean",
    eval: ([a, b]) => s(a).includes(s(b)),
    doc: "Returns true if the first string contains the second.", category: "string",
});
(0, registry_1.register)({
    name: "lower", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
    eval: ([v]) => s(v).toLowerCase(),
    doc: "Lowercases the string.", category: "string",
});
(0, registry_1.register)({
    name: "upper", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
    eval: ([v]) => s(v).toUpperCase(),
    doc: "Uppercases the string.", category: "string",
});
(0, registry_1.register)({
    name: "trim", arity: { min: 1, max: 1 }, paramTypes: ["string"], returnType: "string",
    eval: ([v]) => s(v).trim(),
    doc: "Strips whitespace from both ends.", category: "string",
});
//# sourceMappingURL=string.js.map