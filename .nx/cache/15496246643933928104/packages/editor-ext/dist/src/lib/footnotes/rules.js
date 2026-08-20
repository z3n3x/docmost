"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("@tiptap/pm/state");
const transform_1 = require("@tiptap/pm/transform");
const core_1 = require("@tiptap/core");
const utils_1 = require("./utils");
const FootnoteRules = core_1.Extension.create({
    name: "footnoteRules",
    priority: 1000,
    addProseMirrorPlugins() {
        return [
            new state_1.Plugin({
                key: new state_1.PluginKey("footnoteRules"),
                filterTransaction(tr) {
                    const { from, to } = tr.selection;
                    if (from === 0 && to === tr.doc.content.size)
                        return true;
                    let selectedFootnotes = false;
                    let selectedContent = false;
                    let footnoteCount = 0;
                    tr.doc.nodesBetween(from, to, (node, _, parent) => {
                        if (parent?.type.name == "doc" && node.type.name != "footnotes") {
                            selectedContent = true;
                        }
                        else if (node.type.name == "footnote") {
                            footnoteCount += 1;
                        }
                        else if (node.type.name == "footnotes") {
                            selectedFootnotes = true;
                        }
                    });
                    const overSelected = selectedContent && selectedFootnotes;
                    return !overSelected && footnoteCount <= 1;
                },
                appendTransaction(transactions, oldState, newState) {
                    let newTr = newState.tr;
                    let refsChanged = false;
                    for (let tr of transactions) {
                        if (!tr.docChanged)
                            continue;
                        if (refsChanged)
                            break;
                        for (let step of tr.steps) {
                            if (!(step instanceof transform_1.ReplaceStep))
                                continue;
                            if (refsChanged)
                                break;
                            const isDelete = step.from != step.to;
                            const isInsert = step.slice.size > 0;
                            if (isInsert) {
                                step.slice.content.descendants((node) => {
                                    if (node?.type.name == "footnoteReference") {
                                        refsChanged = true;
                                        return false;
                                    }
                                });
                            }
                            if (isDelete && !refsChanged) {
                                tr.before.nodesBetween(step.from, Math.min(tr.before.content.size, step.to), (node) => {
                                    if (node.type.name == "footnoteReference") {
                                        refsChanged = true;
                                        return false;
                                    }
                                });
                            }
                        }
                    }
                    if (refsChanged) {
                        (0, utils_1.updateFootnotesList)(newTr, newState);
                        return newTr;
                    }
                    return null;
                },
            }),
        ];
    },
});
exports.default = FootnoteRules;
//# sourceMappingURL=rules.js.map