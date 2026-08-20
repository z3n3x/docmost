"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("./registry");
const error_1 = require("../error");
const num = (v) => v == null ? null : Number(v);
(0, registry_1.register)({
    name: "round", arity: { min: 1, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
    eval: ([v, places]) => {
        const n = num(v);
        if (n == null)
            return null;
        const p = places == null ? 0 : Math.trunc(Number(places));
        const factor = Math.pow(10, p);
        return Math.round(n * factor) / factor;
    },
    doc: "Rounds to the nearest integer, or to `places` decimals if given.", category: "math",
});
(0, registry_1.register)({
    name: "floor", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
    eval: ([v]) => { const n = num(v); return n == null ? null : Math.floor(n); },
    doc: "Rounds down.", category: "math",
});
(0, registry_1.register)({
    name: "ceil", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
    eval: ([v]) => { const n = num(v); return n == null ? null : Math.ceil(n); },
    doc: "Rounds up.", category: "math",
});
(0, registry_1.register)({
    name: "abs", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
    eval: ([v]) => { const n = num(v); return n == null ? null : Math.abs(n); },
    doc: "Absolute value.", category: "math",
});
(0, registry_1.register)({
    name: "min", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
    eval: (args) => {
        const nums = args.map(num).filter((n) => n != null);
        return nums.length ? Math.min(...nums) : null;
    },
    doc: "Minimum of the arguments.", category: "math",
});
(0, registry_1.register)({
    name: "max", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
    eval: (args) => {
        const nums = args.map(num).filter((n) => n != null);
        return nums.length ? Math.max(...nums) : null;
    },
    doc: "Maximum of the arguments.", category: "math",
});
(0, registry_1.register)({
    name: "mod", arity: { min: 2, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
    eval: ([a, b]) => {
        const na = num(a), nb = num(b);
        if (na == null || nb == null)
            return null;
        if (nb === 0)
            return (0, error_1.makeErrorCell)("DIV_BY_ZERO", "modulo by zero");
        return na % nb;
    },
    doc: "Remainder after division.", category: "math",
});
(0, registry_1.register)({
    name: "add", arity: { min: 2, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
    eval: ([a, b]) => {
        const na = num(a), nb = num(b);
        return na == null || nb == null ? null : na + nb;
    },
    doc: "Sum of two numbers.", category: "math",
});
(0, registry_1.register)({
    name: "subtract", arity: { min: 2, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
    eval: ([a, b]) => {
        const na = num(a), nb = num(b);
        return na == null || nb == null ? null : na - nb;
    },
    doc: "Difference of two numbers.", category: "math",
});
(0, registry_1.register)({
    name: "multiply", arity: { min: 2, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
    eval: ([a, b]) => {
        const na = num(a), nb = num(b);
        return na == null || nb == null ? null : na * nb;
    },
    doc: "Product of two numbers.", category: "math",
});
(0, registry_1.register)({
    name: "divide", arity: { min: 2, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
    eval: ([a, b]) => {
        const na = num(a), nb = num(b);
        if (na == null || nb == null)
            return null;
        if (nb === 0)
            return (0, error_1.makeErrorCell)("DIV_BY_ZERO", "division by zero");
        return na / nb;
    },
    doc: "Quotient of two numbers.", category: "math",
});
(0, registry_1.register)({
    name: "pow", arity: { min: 2, max: 2 }, paramTypes: ["number", "number"], returnType: "number",
    eval: ([a, b]) => {
        const na = num(a), nb = num(b);
        return na == null || nb == null ? null : Math.pow(na, nb);
    },
    doc: "Base raised to an exponent.", category: "math",
});
(0, registry_1.register)({
    name: "sqrt", arity: { min: 1, max: 1 }, paramTypes: ["number"], returnType: "number",
    eval: ([v]) => {
        const n = num(v);
        if (n == null)
            return null;
        if (n < 0)
            return (0, error_1.makeErrorCell)("TYPE_MISMATCH", "sqrt of negative number");
        return Math.sqrt(n);
    },
    doc: "Positive square root.", category: "math",
});
(0, registry_1.register)({
    name: "sum", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
    eval: (args) => {
        let total = 0;
        for (const v of args) {
            const n = num(v);
            if (n != null && Number.isFinite(n))
                total += n;
        }
        return total;
    },
    doc: "Sum of the arguments.", category: "math",
});
const meanEval = (args) => {
    const nums = [];
    for (const v of args) {
        const n = num(v);
        if (n != null && Number.isFinite(n))
            nums.push(n);
    }
    if (nums.length === 0)
        return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
};
(0, registry_1.register)({
    name: "mean", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
    eval: meanEval,
    doc: "Arithmetic average of the arguments.", category: "math",
});
(0, registry_1.register)({
    name: "average", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
    eval: meanEval,
    doc: "Arithmetic average of the arguments (alias of mean).", category: "math",
});
(0, registry_1.register)({
    name: "median", arity: { min: 1, max: null }, paramTypes: "variadic-any", returnType: "number",
    eval: (args) => {
        const nums = [];
        for (const v of args) {
            const n = num(v);
            if (n != null && Number.isFinite(n))
                nums.push(n);
        }
        if (nums.length === 0)
            return null;
        nums.sort((a, b) => a - b);
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 === 0
            ? (nums[mid - 1] + nums[mid]) / 2
            : nums[mid];
    },
    doc: "Middle value of the arguments.", category: "math",
});
//# sourceMappingURL=math.js.map