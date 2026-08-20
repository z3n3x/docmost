"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseFormulaGraph = void 0;
class BaseFormulaGraph {
    direct = new Map();
    reverse = new Map();
    constructor(properties) {
        for (const p of properties) {
            if (p.type !== "formula")
                continue;
            const deps = Array.isArray(p.typeOptions?.dependencies)
                ? p.typeOptions.dependencies
                : [];
            this.direct.set(p.id, deps);
            for (const d of deps) {
                if (!this.reverse.has(d))
                    this.reverse.set(d, new Set());
                this.reverse.get(d).add(p.id);
            }
        }
    }
    directDeps(propId) { return this.direct.get(propId) ?? []; }
    dependents(propId) { return Array.from(this.reverse.get(propId) ?? []); }
    affectedFormulas(changedPropIds) {
        const out = new Set();
        const stack = [...changedPropIds];
        while (stack.length) {
            const id = stack.pop();
            for (const d of this.reverse.get(id) ?? []) {
                if (!out.has(d)) {
                    out.add(d);
                    stack.push(d);
                }
            }
        }
        return Array.from(out).sort();
    }
    evalOrder() {
        const order = [];
        const visited = new Set();
        const temp = new Set();
        const visit = (id) => {
            if (visited.has(id))
                return;
            if (temp.has(id))
                return;
            temp.add(id);
            for (const d of this.direct.get(id) ?? [])
                visit(d);
            temp.delete(id);
            visited.add(id);
            order.push(id);
        };
        for (const id of this.direct.keys())
            visit(id);
        return order;
    }
    detectCycle(newProp) {
        const local = new Map(this.direct);
        if (newProp.type === "formula") {
            local.set(newProp.id, newProp.typeOptions?.dependencies ?? []);
        }
        const WHITE = 0, GRAY = 1, BLACK = 2;
        const color = new Map();
        const path = [];
        const dfs = (id) => {
            color.set(id, GRAY);
            path.push(id);
            for (const d of local.get(id) ?? []) {
                const c = color.get(d) ?? WHITE;
                if (c === GRAY) {
                    return [...path.slice(path.indexOf(d)), d];
                }
                if (c === WHITE) {
                    const r = dfs(d);
                    if (r)
                        return r;
                }
            }
            path.pop();
            color.set(id, BLACK);
            return null;
        };
        for (const id of local.keys()) {
            if ((color.get(id) ?? WHITE) === WHITE) {
                const r = dfs(id);
                if (r)
                    return r;
            }
        }
        return null;
    }
}
exports.BaseFormulaGraph = BaseFormulaGraph;
//# sourceMappingURL=graph.js.map