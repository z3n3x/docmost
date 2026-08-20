"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrailingNode = void 0;
const core_1 = require("@tiptap/core");
const state_1 = require("@tiptap/pm/state");
function nodeEqualsType({ types, node }) {
    if (!node)
        return false;
    return (Array.isArray(types) && types.includes(node.type)) || node.type === types;
}
function lastNodeBeforeFootnotes(doc) {
    const lastChild = doc.lastChild;
    if (lastChild?.type.name === 'footnotes') {
        return doc.childCount > 1 ? doc.child(doc.childCount - 2) : null;
    }
    return lastChild;
}
exports.TrailingNode = core_1.Extension.create({
    name: 'trailingNode',
    addOptions() {
        return {
            node: 'paragraph',
            notAfter: [
                'paragraph',
            ],
        };
    },
    addProseMirrorPlugins() {
        const plugin = new state_1.PluginKey(this.name);
        const disabledNodes = Object.entries(this.editor.schema.nodes)
            .map(([, value]) => value)
            .filter(node => this.options.notAfter.includes(node.name));
        return [
            new state_1.Plugin({
                key: plugin,
                appendTransaction: (_, __, state) => {
                    const { doc, tr, schema } = state;
                    const shouldInsertNodeAtEnd = plugin.getState(state);
                    const type = schema.nodes[this.options.node];
                    if (!shouldInsertNodeAtEnd) {
                        return;
                    }
                    const lastChild = doc.lastChild;
                    const endPosition = lastChild?.type.name === 'footnotes'
                        ? doc.content.size - lastChild.nodeSize
                        : doc.content.size;
                    return tr.insert(endPosition, type.create());
                },
                state: {
                    init: (_, state) => {
                        try {
                            const lastNode = lastNodeBeforeFootnotes(state.tr.doc);
                            return !nodeEqualsType({ node: lastNode, types: disabledNodes });
                        }
                        catch (err) {
                            console.log(err);
                        }
                        return true;
                    },
                    apply: (tr, value) => {
                        if (!tr.docChanged) {
                            return value;
                        }
                        if (tr.getMeta('__uniqueIDTransaction')) {
                            return value;
                        }
                        const lastNode = lastNodeBeforeFootnotes(tr.doc);
                        return !nodeEqualsType({ node: lastNode, types: disabledNodes });
                    },
                },
            }),
        ];
    }
});
//# sourceMappingURL=trailing-node.js.map