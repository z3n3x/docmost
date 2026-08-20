"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultMarks = exports.defaultAsyncNodes = void 0;
exports.pageNodeToDocxBuffer = pageNodeToDocxBuffer;
const docx_1 = require("docx");
const serializer_1 = require("./serializer");
const utils_1 = require("./utils");
function toDocxColor(input) {
    if (!input)
        return undefined;
    const value = input.trim().toLowerCase();
    const hex = value.startsWith('#') ? value.slice(1) : value;
    if (/^[0-9a-f]{6}$/.test(hex))
        return hex;
    if (/^[0-9a-f]{3}$/.test(hex)) {
        return hex
            .split('')
            .map((ch) => ch + ch)
            .join('');
    }
    const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
        const channel = (n) => Math.max(0, Math.min(255, parseInt(n, 10)))
            .toString(16)
            .padStart(2, '0');
        return channel(rgb[1]) + channel(rgb[2]) + channel(rgb[3]);
    }
    return undefined;
}
const renderImage = async (state, node) => {
    const src = node.attrs?.src || node.attrs?.attachmentId;
    if (src) {
        try {
            await state.image(src, 100);
        }
        catch {
        }
    }
    state.closeBlock(node);
};
const renderFileLine = (state, node) => {
    const label = node.attrs?.name || node.attrs?.src || node.attrs?.url || 'attachment';
    state.text(label);
    state.closeBlock(node);
};
const renderEmbedLine = (state, node) => {
    const label = node.attrs?.src || node.attrs?.url || 'embed';
    state.text(label);
    state.closeBlock(node);
};
exports.defaultAsyncNodes = {
    text(state, node) {
        state.text(node.text ?? '');
    },
    async paragraph(state, node) {
        await state.renderInline(node);
        state.closeBlock(node);
    },
    async heading(state, node) {
        await state.renderInline(node);
        const heading = [
            docx_1.HeadingLevel.HEADING_1,
            docx_1.HeadingLevel.HEADING_2,
            docx_1.HeadingLevel.HEADING_3,
            docx_1.HeadingLevel.HEADING_4,
            docx_1.HeadingLevel.HEADING_5,
            docx_1.HeadingLevel.HEADING_6,
        ][(node.attrs.level ?? 1) - 1];
        state.closeBlock(node, { heading });
    },
    async blockquote(state, node) {
        await state.renderContent(node, { style: 'IntenseQuote' });
    },
    async codeBlock(state, node) {
        await state.renderContent(node);
        state.closeBlock(node);
    },
    horizontalRule(state, node) {
        state.closeBlock(node, { thematicBreak: true });
        state.closeBlock(node);
    },
    hardBreak(state) {
        state.addRunOptions({ break: 1 });
    },
    async bulletList(state, node) {
        await state.renderList(node, 'bullets');
    },
    async orderedList(state, node) {
        await state.renderList(node, 'numbered');
    },
    async listItem(state, node) {
        await state.renderListItem(node);
    },
    async taskList(state, node) {
        await state.renderList(node, 'bullets');
    },
    async taskItem(state, node) {
        if (state.currentNumbering) {
            state.addParagraphOptions({ numbering: state.currentNumbering });
        }
        state.text(node.attrs?.checked ? '☑ ' : '☐ ');
        await state.renderContent(node);
    },
    async table(state, node) {
        await state.table(node);
    },
    mathInline(state, node) {
        state.math(node.attrs?.text ?? '', { inline: true });
    },
    mathBlock(state, node) {
        state.math(node.attrs?.text ?? '', { inline: false, numbered: false });
        state.closeBlock(node);
    },
    image: renderImage,
    drawio: renderImage,
    excalidraw: renderImage,
    video: renderFileLine,
    audio: renderFileLine,
    pdf: renderFileLine,
    attachment: renderFileLine,
    embed: renderEmbedLine,
    youtube: renderEmbedLine,
    async callout(state, node) {
        await state.renderContent(node, { style: 'IntenseQuote' });
    },
    async details(state, node) {
        await state.renderContent(node);
    },
    async detailsSummary(state, node) {
        await state.renderInline(node);
        state.closeBlock(node, { heading: docx_1.HeadingLevel.HEADING_4 });
    },
    async detailsContent(state, node) {
        await state.renderContent(node);
    },
    async columns(state, node) {
        await state.renderContent(node);
    },
    async column(state, node) {
        await state.renderContent(node);
    },
    async transclusionSource(state, node) {
        await state.renderContent(node);
    },
    mention(state, node) {
        state.text(`@${node.attrs?.label ?? ''}`);
    },
    status(state, node) {
        state.text(`[${node.attrs?.text ?? ''}]`);
    },
    pageBreak(state, node) {
        state.closeBlock(node, { pageBreakBefore: true });
    },
    footnoteReference(state, node) {
        const number = Number(node.attrs?.referenceNumber) || state.$footnoteCounter + 1;
        state.$footnoteCounter = Math.max(state.$footnoteCounter, number);
        if (!state.footnotes[number]) {
            state.footnotes[number] = { children: [new docx_1.Paragraph('')] };
        }
        state.current.push(new docx_1.FootnoteReferenceRun(number));
    },
    async footnotes(state, node) {
        for (let i = 0; i < node.childCount; i += 1) {
            const item = node.child(i);
            const number = Number(String(item.attrs?.id ?? '').replace('fn:', '')) || i + 1;
            await state.footnoteDefinition(item, number);
        }
    },
    footnote() { },
    subpages() { },
    transclusionReference() { },
    base() { },
};
exports.defaultMarks = {
    bold() {
        return { bold: true };
    },
    italic() {
        return { italics: true };
    },
    strike() {
        return { strike: true };
    },
    underline() {
        return { underline: {} };
    },
    code() {
        return {
            font: { name: 'Monospace' },
            color: '000000',
            shading: { type: docx_1.ShadingType.SOLID, color: 'D2D3D2', fill: 'D2D3D2' },
        };
    },
    superscript() {
        return { superScript: true };
    },
    subscript() {
        return { subScript: true };
    },
    link() {
        return {};
    },
    highlight(_state, _node, mark) {
        const fill = toDocxColor(mark.attrs?.color);
        return fill
            ? { shading: { type: docx_1.ShadingType.CLEAR, fill } }
            : { highlight: 'yellow' };
    },
    textStyle(_state, _node, mark) {
        const color = toDocxColor(mark.attrs?.color);
        return color ? { color } : {};
    },
    comment() {
        return {};
    },
};
async function pageNodeToDocxBuffer(doc, getImageBuffer) {
    const serializer = new serializer_1.DocxSerializerAsync(exports.defaultAsyncNodes, exports.defaultMarks);
    const wordDoc = await serializer.serializeAsync(doc, { getImageBuffer }, () => ({
        styles: {
            default: {
                document: { paragraph: { spacing: { after: 160 } } },
                heading1: {
                    run: { color: '000000', size: 32 },
                    paragraph: {
                        keepNext: true,
                        keepLines: true,
                        spacing: { before: 240, after: 0 },
                    },
                },
                heading2: {
                    run: { color: '000000', size: 26 },
                    paragraph: {
                        keepNext: true,
                        keepLines: true,
                        spacing: { before: 40, after: 0 },
                    },
                },
                heading3: {
                    run: { color: '000000', size: 24 },
                    paragraph: {
                        keepNext: true,
                        keepLines: true,
                        spacing: { before: 40, after: 0 },
                    },
                },
                heading4: {
                    run: { color: '000000', italics: true },
                    paragraph: {
                        keepNext: true,
                        keepLines: true,
                        spacing: { before: 40, after: 0 },
                    },
                },
                heading5: {
                    run: { color: '000000' },
                    paragraph: {
                        keepNext: true,
                        keepLines: true,
                        spacing: { before: 40, after: 0 },
                    },
                },
                heading6: {
                    run: { color: '000000' },
                    paragraph: {
                        keepNext: true,
                        keepLines: true,
                        spacing: { before: 40, after: 0 },
                    },
                },
            },
        },
    }));
    return (0, utils_1.writeDocx)(wordDoc);
}
//# sourceMappingURL=schema.js.map