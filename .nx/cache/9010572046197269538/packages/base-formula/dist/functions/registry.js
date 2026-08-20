"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = void 0;
exports.register = register;
exports.registry = new Map();
function register(fn) {
    const key = fn.name.toLowerCase();
    if (exports.registry.has(key)) {
        throw new Error(`Duplicate formula function: ${fn.name}`);
    }
    exports.registry.set(key, fn);
}
//# sourceMappingURL=registry.js.map