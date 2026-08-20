"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShortId = createShortId;
exports.buildDoc = buildDoc;
exports.createDocFromState = createDocFromState;
exports.writeDocx = writeDocx;
exports.getLatexFromNode = getLatexFromNode;
const docx_1 = require("docx");
function createShortId() {
    return Math.random().toString(36).slice(2, 11);
}
function buildDoc(state, opts) {
    let sections = state?.sections?.length
        ? state.sections.map((section) => ({
            properties: section.config.properties || {
                type: docx_1.SectionType.CONTINUOUS,
            },
            headers: section.config.headers,
            footers: section.config.footers,
            children: section.children,
        }))
        : undefined;
    if (!sections) {
        sections = [
            {
                headers: undefined,
                footers: undefined,
                properties: {
                    type: docx_1.SectionType.CONTINUOUS,
                },
                children: state?.children || [],
            },
        ];
    }
    const doc = new docx_1.Document({
        footnotes: state.footnotes,
        numbering: {
            config: state.numbering,
        },
        sections,
        ...(opts || {}),
    });
    return doc;
}
function createDocFromState(state) {
    return buildDoc({
        numbering: state.numbering,
        sections: [
            {
                config: {},
                children: state.children,
            },
        ],
        footnotes: state.footnotes,
    });
}
async function writeDocx(doc, write) {
    const buffer = await docx_1.Packer.toBuffer(doc);
    await write?.(buffer);
    return buffer;
}
function getLatexFromNode(node) {
    let math = '';
    node.forEach((child) => {
        if (child.isText)
            math += child.text;
    });
    return math;
}
//# sourceMappingURL=utils.js.map