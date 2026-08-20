"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@tiptap/core");
const model_1 = require("@tiptap/pm/model");
const state_1 = require("@tiptap/pm/state");
const utils_1 = require("../utils");
const REFNUM_ATTR = "data-reference-number";
const REF_CLASS = "footnote-ref";
const FootnoteReference = core_1.Node.create({
    name: "footnoteReference",
    inline: true,
    content: "text*",
    group: "inline",
    atom: true,
    draggable: true,
    parseHTML() {
        return [
            {
                tag: `sup`,
                priority: 1000,
                getAttrs(node) {
                    const anchor = node.querySelector(`a.${REF_CLASS}:first-child`);
                    if (!anchor) {
                        return false;
                    }
                    const id = anchor.getAttribute("data-id");
                    const ref = anchor.getAttribute(REFNUM_ATTR);
                    return {
                        "data-id": id ?? (0, utils_1.generateNodeId)(),
                        referenceNumber: ref ?? anchor.innerText,
                    };
                },
                contentElement(node) {
                    return node.firstChild;
                },
            },
        ];
    },
    addAttributes() {
        return {
            class: {
                default: REF_CLASS,
            },
            "data-id": {
                renderHTML(attributes) {
                    return {
                        "data-id": attributes["data-id"] || (0, utils_1.generateNodeId)(),
                    };
                },
            },
            referenceNumber: {},
            href: {
                renderHTML(attributes) {
                    return {
                        href: `#fn:${attributes["referenceNumber"]}`,
                    };
                },
            },
        };
    },
    renderHTML({ HTMLAttributes }) {
        const { referenceNumber, ...attributes } = HTMLAttributes;
        const attrs = (0, core_1.mergeAttributes)(this.options.HTMLAttributes, attributes);
        attrs[REFNUM_ATTR] = referenceNumber;
        return [
            "sup",
            { id: `fnref:${referenceNumber}` },
            ["a", attrs, HTMLAttributes.referenceNumber],
        ];
    },
    addProseMirrorPlugins() {
        const { editor } = this;
        const mapNode = (node) => {
            if (node.type.name === this.name) {
                const newAttrs = { ...node.attrs, "data-id": (0, utils_1.generateNodeId)() };
                return node.type.create(newAttrs, node.content, node.marks);
            }
            if (node.content && node.content.size > 0) {
                const newChildren = [];
                let changed = false;
                node.content.forEach((child) => {
                    const mapped = mapNode(child);
                    if (mapped !== child) {
                        changed = true;
                    }
                    newChildren.push(mapped);
                });
                if (changed) {
                    return node.copy(model_1.Fragment.from(newChildren));
                }
            }
            return node;
        };
        return [
            new state_1.Plugin({
                key: new state_1.PluginKey("footnotePasteHandler"),
                props: {
                    transformPasted(slice) {
                        const mappedNodes = [];
                        let changed = false;
                        slice.content.forEach((node) => {
                            const mapped = mapNode(node);
                            if (mapped !== node) {
                                changed = true;
                            }
                            mappedNodes.push(mapped);
                        });
                        if (!changed) {
                            return slice;
                        }
                        return new model_1.Slice(model_1.Fragment.from(mappedNodes), slice.openStart, slice.openEnd);
                    },
                },
            }),
            new state_1.Plugin({
                key: new state_1.PluginKey("footnoteRefClick"),
                props: {
                    handleDoubleClickOn(view, pos, node, nodePos, event) {
                        if (node.type.name != "footnoteReference")
                            return false;
                        event.preventDefault();
                        const id = node.attrs["data-id"];
                        return editor.commands.focusFootnote(id);
                    },
                    handleClickOn(view, pos, node, nodePos, event) {
                        if (node.type.name != "footnoteReference")
                            return false;
                        event.preventDefault();
                        const { selection } = editor.state.tr;
                        if (selection instanceof state_1.NodeSelection && selection.node.eq(node)) {
                            const id = node.attrs["data-id"];
                            return editor.commands.focusFootnote(id);
                        }
                        else {
                            editor.chain().setNodeSelection(nodePos).run();
                            return true;
                        }
                    },
                },
            }),
        ];
    },
    addCommands() {
        return {
            addFootnote: () => ({ state, tr }) => {
                const node = this.type.create({
                    "data-id": (0, utils_1.generateNodeId)(),
                });
                tr.insert(state.selection.anchor, node);
                return true;
            },
        };
    },
    addInputRules() {
        return [
            {
                find: /\[\^(.*?)\]/,
                type: this.type,
                undoable: true,
                handler({ range, match, chain }) {
                    const start = range.from;
                    let end = range.to;
                    if (match[1]) {
                        chain().deleteRange({ from: start, to: end }).addFootnote().run();
                    }
                },
            },
        ];
    },
});
exports.default = FootnoteReference;
//# sourceMappingURL=reference.js.map