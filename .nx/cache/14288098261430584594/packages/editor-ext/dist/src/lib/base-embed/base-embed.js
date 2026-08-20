"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEmbed = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
exports.BaseEmbed = core_1.Node.create({
    name: 'base',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    addOptions() {
        return { HTMLAttributes: {} };
    },
    extendNodeSchema(extension) {
        return extension.name === 'base'
            ? { disableDropCursor: true }
            : {};
    },
    addAttributes() {
        return {
            pageId: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-page-id'),
                renderHTML: (attrs) => attrs.pageId ? { 'data-page-id': attrs.pageId } : {},
            },
            pendingKey: {
                default: null,
                parseHTML: () => null,
                renderHTML: () => ({}),
            },
        };
    },
    parseHTML() {
        return [{ tag: 'div[data-type="base-embed"]' }];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            (0, core_1.mergeAttributes)(this.options.HTMLAttributes, HTMLAttributes, {
                'data-type': 'base-embed',
            }),
        ];
    },
    addCommands() {
        return {
            insertBaseEmbed: (attrs) => ({ commands }) => commands.insertContent({
                type: this.name,
                attrs,
            }),
        };
    },
    addKeyboardShortcuts() {
        const isThisNodeSelected = () => {
            const { selection } = this.editor.state;
            return (selection instanceof state_1.NodeSelection &&
                selection.node.type.name === this.name);
        };
        return {
            Backspace: () => isThisNodeSelected(),
            Delete: () => isThisNodeSelected(),
        };
    },
    addProseMirrorPlugins() {
        const nodeName = this.name;
        const isThisNodeSelected = (state) => {
            const { selection } = state;
            return (selection instanceof state_1.NodeSelection &&
                selection.node.type.name === nodeName);
        };
        return [
            new state_1.Plugin({
                props: {
                    handleTextInput: (view) => isThisNodeSelected(view.state),
                    handlePaste: (view) => isThisNodeSelected(view.state),
                },
            }),
        ];
    },
});
//# sourceMappingURL=base-embed.js.map