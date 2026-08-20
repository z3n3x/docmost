"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const extension_ordered_list_1 = __importDefault(require("@tiptap/extension-ordered-list"));
const rules_1 = __importDefault(require("./rules"));
const Footnotes = extension_ordered_list_1.default.extend({
    name: "footnotes",
    group: "",
    isolating: true,
    defining: true,
    draggable: false,
    content() {
        return "footnote*";
    },
    addAttributes() {
        return {
            class: {
                default: "footnotes",
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: "ol.footnotes",
                priority: 1000,
            },
        ];
    },
    addKeyboardShortcuts() {
        return {};
    },
    addCommands() {
        return {};
    },
    addInputRules() {
        return [];
    },
    addExtensions() {
        return [rules_1.default];
    },
});
exports.default = Footnotes;
//# sourceMappingURL=footnotes.js.map