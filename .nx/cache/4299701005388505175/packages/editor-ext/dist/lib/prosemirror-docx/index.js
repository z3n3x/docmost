"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDoc = exports.createDocFromState = exports.writeDocx = exports.pageNodeToDocxBuffer = exports.defaultMarks = exports.defaultAsyncNodes = exports.MAX_IMAGE_WIDTH = exports.DocxSerializer = exports.DocxSerializerState = exports.DocxSerializerAsync = exports.DocxSerializerStateAsync = void 0;
var serializer_1 = require("./serializer");
Object.defineProperty(exports, "DocxSerializerStateAsync", { enumerable: true, get: function () { return serializer_1.DocxSerializerStateAsync; } });
Object.defineProperty(exports, "DocxSerializerAsync", { enumerable: true, get: function () { return serializer_1.DocxSerializerAsync; } });
Object.defineProperty(exports, "DocxSerializerState", { enumerable: true, get: function () { return serializer_1.DocxSerializerState; } });
Object.defineProperty(exports, "DocxSerializer", { enumerable: true, get: function () { return serializer_1.DocxSerializer; } });
Object.defineProperty(exports, "MAX_IMAGE_WIDTH", { enumerable: true, get: function () { return serializer_1.MAX_IMAGE_WIDTH; } });
var schema_1 = require("./schema");
Object.defineProperty(exports, "defaultAsyncNodes", { enumerable: true, get: function () { return schema_1.defaultAsyncNodes; } });
Object.defineProperty(exports, "defaultMarks", { enumerable: true, get: function () { return schema_1.defaultMarks; } });
Object.defineProperty(exports, "pageNodeToDocxBuffer", { enumerable: true, get: function () { return schema_1.pageNodeToDocxBuffer; } });
var utils_1 = require("./utils");
Object.defineProperty(exports, "writeDocx", { enumerable: true, get: function () { return utils_1.writeDocx; } });
Object.defineProperty(exports, "createDocFromState", { enumerable: true, get: function () { return utils_1.createDocFromState; } });
Object.defineProperty(exports, "buildDoc", { enumerable: true, get: function () { return utils_1.buildDoc; } });
//# sourceMappingURL=index.js.map