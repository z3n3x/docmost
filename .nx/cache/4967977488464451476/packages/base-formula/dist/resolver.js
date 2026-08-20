"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = resolve;
const error_1 = require("./error");
function resolve(raw, nameToId) {
    const deps = new Set();
    const ast = walk(raw, nameToId, deps);
    return { ast, dependencies: Array.from(deps).sort() };
}
function walk(node, nameToId, deps) {
    switch (node.t) {
        case "num":
        case "str":
        case "bool":
        case "null":
            return node;
        case "propName": {
            const id = nameToId.get(node.name);
            if (!id) {
                throw new error_1.FormulaParseError([{
                        code: "UNKNOWN_PROPERTY",
                        message: `Unknown property '${node.name}'`,
                        span: { start: 0, end: 0 },
                    }]);
            }
            deps.add(id);
            return { t: "prop", id };
        }
        case "op":
            return {
                t: "op",
                op: node.op,
                args: node.args.map((a) => walk(a, nameToId, deps)),
            };
        case "if":
            return {
                t: "if",
                cond: walk(node.cond, nameToId, deps),
                then: walk(node.then, nameToId, deps),
                else: walk(node.else, nameToId, deps),
            };
        case "and":
            return {
                t: "and",
                args: node.args.map((a) => walk(a, nameToId, deps)),
            };
        case "or":
            return {
                t: "or",
                args: node.args.map((a) => walk(a, nameToId, deps)),
            };
        case "call":
            return {
                t: "call",
                fn: node.fn,
                args: node.args.map((a) => walk(a, nameToId, deps)),
            };
    }
}
//# sourceMappingURL=resolver.js.map