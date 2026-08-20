"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.footnoteDefExtension = exports.footnoteRefExtension = void 0;
exports.resetFootnotes = resetFootnotes;
exports.renderFootnotesList = renderFootnotesList;
const marked_1 = require("marked");
const utils_1 = require("../../utils");
let footnoteRefs = [];
let footnoteDefs = new Map();
function resetFootnotes() {
    footnoteRefs = [];
    footnoteDefs = new Map();
}
function renderFootnotesList() {
    if (!footnoteRefs.length)
        return '';
    const items = footnoteRefs.map(({ label, id, number }) => {
        const body = footnoteDefs.get(label) || '<p></p>';
        return `<li id="fn:${number}" data-id="${id}">${body}</li>`;
    });
    return `<ol class="footnotes">\n${items.join('\n')}\n</ol>\n`;
}
exports.footnoteRefExtension = {
    name: 'footnoteRef',
    level: 'inline',
    start(src) {
        return src.indexOf('[^');
    },
    tokenizer(src) {
        const match = /^\[\^([^\]\s]+)\]/.exec(src);
        if (match) {
            return {
                type: 'footnoteRef',
                raw: match[0],
                label: match[1].toLowerCase(),
            };
        }
    },
    renderer(token) {
        const refToken = token;
        const number = footnoteRefs.length + 1;
        const id = (0, utils_1.generateNodeId)();
        footnoteRefs.push({ label: refToken.label, id, number });
        return `<sup id="fnref:${number}"><a class="footnote-ref" data-id="${id}" data-reference-number="${number}" href="#fn:${number}">${number}</a></sup>`;
    },
};
exports.footnoteDefExtension = {
    name: 'footnoteDef',
    level: 'block',
    start(src) {
        return src.match(/^\[\^[^\]\s]+\]:/m)?.index ?? -1;
    },
    tokenizer(src) {
        const firstLine = /^\[\^([^\]\s]+)\]:[ \t]*/.exec(src);
        if (!firstLine)
            return undefined;
        const lines = src.split('\n');
        const contentLines = [lines[0].slice(firstLine[0].length)];
        let consumed = 1;
        while (consumed < lines.length) {
            const line = lines[consumed];
            if (/^[ \t]{2,}\S/.test(line)) {
                contentLines.push(line.replace(/^[ \t]{1,4}/, ''));
                consumed += 1;
            }
            else if (/^[ \t]*$/.test(line) &&
                consumed + 1 < lines.length &&
                /^[ \t]{2,}\S/.test(lines[consumed + 1])) {
                contentLines.push('');
                consumed += 1;
            }
            else {
                break;
            }
        }
        const raw = lines.slice(0, consumed).join('\n') +
            (consumed < lines.length ? '\n' : '');
        return {
            type: 'footnoteDef',
            raw,
            label: firstLine[1].toLowerCase(),
            text: contentLines.join('\n').trim(),
        };
    },
    renderer(token) {
        const defToken = token;
        const body = defToken.text
            ? marked_1.marked.parse(defToken.text).toString()
            : '<p></p>';
        footnoteDefs.set(defToken.label, body);
        return '';
    },
};
//# sourceMappingURL=footnotes.marked.js.map