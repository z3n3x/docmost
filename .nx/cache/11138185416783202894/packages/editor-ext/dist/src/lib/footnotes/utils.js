"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFootnoteReferences = updateFootnoteReferences;
exports.updateFootnotesList = updateFootnotesList;
const model_1 = require("@tiptap/pm/model");
function updateFootnoteReferences(tr) {
    let count = 1;
    const nodes = [];
    tr.doc.descendants((node, pos) => {
        if (node.type.name == "footnoteReference") {
            tr.setNodeAttribute(pos, "referenceNumber", `${count}`);
            nodes.push(node);
            count += 1;
        }
    });
    return nodes;
}
function getFootnotes(tr) {
    let footnotesRange;
    const footnotes = [];
    tr.doc.descendants((node, pos) => {
        if (node.type.name == "footnote") {
            footnotes.push(node);
        }
        else if (node.type.name == "footnotes") {
            footnotesRange = { from: pos, to: pos + node.nodeSize };
        }
        else {
            return false;
        }
    });
    return { footnotesRange, footnotes };
}
function updateFootnotesList(tr, state) {
    const footnoteReferences = updateFootnoteReferences(tr);
    const footnoteType = state.schema.nodes.footnote;
    const footnotesType = state.schema.nodes.footnotes;
    const emptyParagraph = state.schema.nodeFromJSON({
        type: "paragraph",
        content: [],
    });
    const { footnotesRange, footnotes } = getFootnotes(tr);
    const footnoteIds = footnotes.reduce((obj, footnote) => {
        obj[footnote.attrs["data-id"]] = footnote;
        return obj;
    }, {});
    const newFootnotes = [];
    let footnoteRefIds = new Set(footnoteReferences.map((ref) => ref.attrs["data-id"]));
    const deleteFootnoteIds = new Set();
    for (let footnote of footnotes) {
        const id = footnote.attrs["data-id"];
        if (!footnoteRefIds.has(id) || deleteFootnoteIds.has(id)) {
            deleteFootnoteIds.add(id);
            footnote.content.descendants((node) => {
                if (node.type.name == "footnoteReference")
                    deleteFootnoteIds.add(node.attrs["data-id"]);
            });
        }
    }
    for (let i = 0; i < footnoteReferences.length; i++) {
        let refId = footnoteReferences[i].attrs["data-id"];
        if (deleteFootnoteIds.has(refId))
            continue;
        if (refId in footnoteIds) {
            let footnote = footnoteIds[refId];
            newFootnotes.push(footnoteType.create({ ...footnote.attrs, id: `fn:${i + 1}` }, footnote.content));
        }
        else {
            let newNode = footnoteType.create({
                "data-id": refId,
                id: `fn:${i + 1}`,
            }, [emptyParagraph]);
            newFootnotes.push(newNode);
        }
    }
    if (newFootnotes.length == 0) {
        if (footnotesRange) {
            tr.delete(footnotesRange.from, footnotesRange.to);
        }
    }
    else if (!footnotesRange) {
        tr.insert(tr.doc.content.size, footnotesType.create(undefined, model_1.Fragment.from(newFootnotes)));
    }
    else {
        tr.replaceWith(footnotesRange.from + 1, footnotesRange.to - 1, model_1.Fragment.from(newFootnotes));
    }
}
//# sourceMappingURL=utils.js.map