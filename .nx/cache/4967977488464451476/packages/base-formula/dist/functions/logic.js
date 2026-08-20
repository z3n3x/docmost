"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("./registry");
(0, registry_1.register)({
    name: "empty",
    arity: { min: 1, max: 1 },
    paramTypes: "any",
    returnType: "boolean",
    eval: ([v]) => v == null || v === "" || (typeof v === "object" && v !== null && "__err" in v),
    doc: "Returns true if the value is null or empty string or an error.",
    category: "logic",
});
//# sourceMappingURL=logic.js.map