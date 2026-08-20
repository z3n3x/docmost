"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluate = evaluate;
const error_1 = require("./error");
const number_1 = require("./number");
const types_1 = require("./types");
function evaluate(ast, row, ctx, astDepth = 0) {
    const depth = astDepth + 1;
    if (depth > types_1.MAX_EVAL_DEPTH) {
        return (0, error_1.makeErrorCell)("DEPTH_EXCEEDED", `formula too deeply nested (max ${types_1.MAX_EVAL_DEPTH})`);
    }
    switch (ast.t) {
        case "num": return ast.v;
        case "str": return ast.v;
        case "bool": return ast.v;
        case "null": return null;
        case "prop": return evalProp(ast.id, row, ctx, depth);
        case "op": return evalOp(ast.op, ast.args, row, ctx, depth);
        case "if": {
            const c = evaluate(ast.cond, row, ctx, depth);
            if ((0, error_1.isErrorCell)(c))
                return c;
            return evaluate(c === true ? ast.then : ast.else, row, ctx, depth);
        }
        case "and": {
            const xs = ast.args;
            for (let i = 0; i < xs.length; i++) {
                const v = evaluate(xs[i], row, ctx, depth);
                if ((0, error_1.isErrorCell)(v))
                    return v;
                if (v === false)
                    return false;
                if (v == null)
                    return null;
            }
            return true;
        }
        case "or": {
            const xs = ast.args;
            for (let i = 0; i < xs.length; i++) {
                const v = evaluate(xs[i], row, ctx, depth);
                if ((0, error_1.isErrorCell)(v))
                    return v;
                if (v === true)
                    return true;
            }
            return false;
        }
        case "call": {
            const fn = ctx.registry.get(ast.fn.toLowerCase());
            if (!fn)
                return (0, error_1.makeErrorCell)("MISSING_PROP", `unknown function ${ast.fn}`);
            const xs = ast.args;
            const args = new Array(xs.length);
            for (let i = 0; i < xs.length; i++) {
                const v = evaluate(xs[i], row, ctx, depth);
                if ((0, error_1.isErrorCell)(v))
                    return { ...v, __err: "DEPENDENCY_ERROR" };
                args[i] = v;
            }
            try {
                return fn.eval(args, ctx);
            }
            catch (e) {
                return (0, error_1.makeErrorCell)("TYPE_MISMATCH", e.message);
            }
        }
    }
}
function evalProp(id, row, ctx, astDepth) {
    if (ctx.memo.has(id))
        return ctx.memo.get(id);
    const prop = ctx.properties.get(id);
    if (!prop)
        return (0, error_1.makeErrorCell)("MISSING_PROP", `missing property ${id}`);
    if (prop.type !== "formula")
        return normalize(row[id] ?? null);
    if (ctx.depth >= ctx.maxDepth)
        return (0, error_1.makeErrorCell)("DEPTH_EXCEEDED", `max depth ${ctx.maxDepth}`);
    const opts = prop.typeOptions;
    const nested = { ...ctx, depth: ctx.depth + 1, memo: ctx.memo };
    const v = evaluate(opts.ast, row, nested, astDepth);
    ctx.memo.set(id, v);
    return v;
}
function normalize(v) {
    if (v === undefined)
        return null;
    if (v === null)
        return null;
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean")
        return v;
    if ((0, error_1.isErrorCell)(v))
        return v;
    return null;
}
function evalOp(op, args, row, ctx, astDepth) {
    const a = evaluate(args[0], row, ctx, astDepth);
    if ((0, error_1.isErrorCell)(a))
        return { ...a, __err: "DEPENDENCY_ERROR" };
    if (op === "neg")
        return a == null ? null : -Number(a);
    if (op === "not")
        return a == null ? null : !Boolean(a);
    const b = evaluate(args[1], row, ctx, astDepth);
    if ((0, error_1.isErrorCell)(b))
        return { ...b, __err: "DEPENDENCY_ERROR" };
    switch (op) {
        case "+":
            if (typeof a === "string" || typeof b === "string")
                return (0, number_1.valueToString)(a) + (0, number_1.valueToString)(b);
            if (a == null || b == null)
                return null;
            return Number(a) + Number(b);
        case "-": return a == null || b == null ? null : Number(a) - Number(b);
        case "*": return a == null || b == null ? null : Number(a) * Number(b);
        case "/":
            if (a == null || b == null)
                return null;
            if (Number(b) === 0)
                return (0, error_1.makeErrorCell)("DIV_BY_ZERO", "division by zero");
            return Number(a) / Number(b);
        case "%":
            if (a == null || b == null)
                return null;
            if (Number(b) === 0)
                return (0, error_1.makeErrorCell)("DIV_BY_ZERO", "modulo by zero");
            return Number(a) % Number(b);
        case "==": return a === b;
        case "!=": return a !== b;
        case ">": return a != null && b != null && a > b;
        case "<": return a != null && b != null && a < b;
        case ">=": return a != null && b != null && a >= b;
        case "<=": return a != null && b != null && a <= b;
    }
}
//# sourceMappingURL=eval.js.map