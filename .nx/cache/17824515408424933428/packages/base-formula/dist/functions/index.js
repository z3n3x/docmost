"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.registry = void 0;
require("./logic");
require("./math");
require("./string");
require("./date");
require("./coercion");
var registry_1 = require("./registry");
Object.defineProperty(exports, "registry", { enumerable: true, get: function () { return registry_1.registry; } });
Object.defineProperty(exports, "register", { enumerable: true, get: function () { return registry_1.register; } });
//# sourceMappingURL=index.js.map