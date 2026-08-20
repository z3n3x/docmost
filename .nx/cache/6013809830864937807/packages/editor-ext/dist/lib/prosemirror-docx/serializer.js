"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxSerializerAsync = exports.DocxSerializerStateAsync = exports.DocxSerializer = exports.DocxSerializerState = exports.MAX_IMAGE_WIDTH = void 0;
const docx_1 = require("docx");
const image_dimensions_1 = require("image-dimensions");
const numbering_1 = require("./numbering");
const utils_1 = require("./utils");
exports.MAX_IMAGE_WIDTH = 600;
function createReferenceBookmark(id, kind, before, after) {
    const textBefore = before ? [new docx_1.TextRun(before)] : [];
    const textAfter = after ? [new docx_1.TextRun(after)] : [];
    return new docx_1.Bookmark({
        id,
        children: [...textBefore, new docx_1.SequentialIdentifier(kind), ...textAfter],
    });
}
class DocxSerializerState {
    nodes;
    options;
    marks;
    children;
    sections;
    currentSectionIndex = 0;
    numbering;
    footnotes = {};
    nextRunOpts;
    current = [];
    currentLink;
    nextParentParagraphOpts;
    currentNumbering;
    constructor(nodes, marks, options) {
        this.nodes = nodes;
        this.marks = marks;
        this.options = options ?? {};
        this.children = [];
        this.numbering = [];
        if (options.sections && options.sections.length > 0) {
            this.sections = options.sections.map((config) => ({
                config,
                children: [],
            }));
            this.children = this.sections[0].children;
        }
        else {
            this.sections = [];
        }
    }
    renderContent(parent, opts) {
        parent.forEach((node, _, i) => {
            if (opts)
                this.addParagraphOptions(opts);
            this.render(node, parent, i);
        });
    }
    render(node, parent, index) {
        if (typeof parent === 'number')
            throw new Error('!');
        if (!this.nodes[node.type.name])
            throw new Error(`Token type \`${node.type.name}\` not supported by Word renderer`);
        this.nodes[node.type.name](this, node, parent, index);
    }
    renderMarks(node, marks) {
        return marks
            .map((mark) => {
            return this.marks[mark.type.name]?.(this, node, mark);
        })
            .reduce((a, b) => ({ ...a, ...b }), {});
    }
    renderInline(parent) {
        let currentLink;
        const closeLink = () => {
            if (!currentLink)
                return;
            const hyperlink = new docx_1.ExternalHyperlink({
                link: currentLink.link,
                children: this.current,
            });
            this.current = [...currentLink.stack, hyperlink];
            currentLink = undefined;
        };
        const openLink = (href) => {
            const sameLink = href === currentLink?.link;
            this.addRunOptions({ style: 'Hyperlink' });
            const oneLink = true;
            if (!oneLink) {
                closeLink();
            }
            else {
                if (currentLink && sameLink)
                    return;
                if (currentLink && !sameLink) {
                    closeLink();
                }
            }
            currentLink = {
                link: href,
                stack: this.current,
            };
            this.current = [];
        };
        const progress = (node, offset, index) => {
            const links = node.marks.filter((m) => m.type.name === 'link');
            const hasLink = links.length > 0;
            if (hasLink) {
                openLink(links[0].attrs.href);
            }
            else if (!hasLink && currentLink) {
                closeLink();
            }
            if (node.isText) {
                this.text(node.text, this.renderMarks(node, [...node.marks]));
            }
            else {
                this.render(node, parent, index);
            }
        };
        parent.forEach(progress);
        closeLink();
    }
    renderList(node, style) {
        if (!this.currentNumbering) {
            const nextId = (0, utils_1.createShortId)();
            this.numbering.push((0, numbering_1.createNumbering)(nextId, style));
            this.currentNumbering = { reference: nextId, level: 0 };
        }
        else {
            const { reference, level } = this.currentNumbering;
            this.currentNumbering = { reference, level: level + 1 };
        }
        this.renderContent(node);
        if (this.currentNumbering.level === 0) {
            delete this.currentNumbering;
        }
        else {
            const { reference, level } = this.currentNumbering;
            this.currentNumbering = { reference, level: level - 1 };
        }
    }
    renderListItem(node) {
        if (!this.currentNumbering)
            throw new Error('Trying to create a list item without a list?');
        this.addParagraphOptions({ numbering: this.currentNumbering });
        this.renderContent(node);
    }
    addParagraphOptions(opts) {
        this.nextParentParagraphOpts = { ...this.nextParentParagraphOpts, ...opts };
    }
    addRunOptions(opts) {
        this.nextRunOpts = { ...this.nextRunOpts, ...opts };
    }
    text(text, opts) {
        if (!text)
            return;
        this.current.push(new docx_1.TextRun({ text, ...this.nextRunOpts, ...opts }));
        delete this.nextRunOpts;
    }
    math(latex, opts = { inline: true }) {
        if (opts.inline || !opts.numbered) {
            this.current.push(new docx_1.Math({ children: [new docx_1.MathRun(latex)] }));
            return;
        }
        const id = opts.id ?? (0, utils_1.createShortId)();
        this.current = [
            new docx_1.TextRun('\t'),
            new docx_1.Math({
                children: [new docx_1.MathRun(latex)],
            }),
            new docx_1.TextRun('\t('),
            createReferenceBookmark(id, 'Equation'),
            new docx_1.TextRun(')'),
        ];
        this.addParagraphOptions({
            tabStops: [
                {
                    type: docx_1.TabStopType.CENTER,
                    position: docx_1.TabStopPosition.MAX / 2,
                },
                {
                    type: docx_1.TabStopType.RIGHT,
                    position: docx_1.TabStopPosition.MAX,
                },
            ],
        });
    }
    maxImageWidth = exports.MAX_IMAGE_WIDTH;
    image(src, widthPercent = 70, align = 'center', imageRunOpts, imageType) {
        const buffer = this.options.getImageBuffer(src);
        const dimensions = (0, image_dimensions_1.imageDimensionsFromData)(buffer);
        if (!dimensions)
            return;
        const aspect = dimensions.height / dimensions.width;
        const width = this.maxImageWidth * (widthPercent / 100);
        let it;
        try {
            it = imageType || src.replace(/.*\./, '').toLowerCase();
        }
        catch (e) {
            it = 'png';
        }
        this.current.push(new docx_1.ImageRun({
            data: buffer,
            ...imageRunOpts,
            type: it,
            transformation: {
                ...(imageRunOpts?.transformation || {}),
                width,
                height: width * aspect,
            },
        }));
        let alignment;
        switch (align) {
            case 'right':
                alignment = docx_1.AlignmentType.RIGHT;
                break;
            case 'left':
                alignment = docx_1.AlignmentType.LEFT;
                break;
            default:
                alignment = docx_1.AlignmentType.CENTER;
        }
        this.addParagraphOptions({
            alignment: alignment,
        });
    }
    table(node, opts = {}) {
        const { getCellOptions, getRowOptions, tableOptions } = opts;
        const actualChildren = this.children;
        const rows = [];
        node.content.forEach((row) => {
            const cells = [];
            let tableHeader = true;
            row.content.forEach((cell) => {
                if (cell.type.name !== 'tableHeader') {
                    tableHeader = false;
                }
            });
            this.maxImageWidth = exports.MAX_IMAGE_WIDTH / row.content.childCount;
            row.content.forEach((cell) => {
                this.children = [];
                this.renderContent(cell);
                const tableCellOpts = { children: this.children };
                const colspan = cell.attrs.colspan ?? 1;
                const rowspan = cell.attrs.rowspan ?? 1;
                if (colspan > 1)
                    tableCellOpts.columnSpan = colspan;
                if (rowspan > 1)
                    tableCellOpts.rowSpan = rowspan;
                cells.push(new docx_1.TableCell({
                    ...tableCellOpts,
                    ...(getCellOptions?.(cell) || {}),
                }));
            });
            rows.push(new docx_1.TableRow({ ...(getRowOptions?.(row) || {}), children: cells, tableHeader }));
        });
        this.maxImageWidth = exports.MAX_IMAGE_WIDTH;
        const table = new docx_1.Table({ ...tableOptions, rows });
        actualChildren.push(table);
        actualChildren.push(new docx_1.Paragraph(''));
        this.children = actualChildren;
    }
    captionLabel(id, kind, { suffix } = { suffix: ': ' }) {
        this.current.push(...[createReferenceBookmark(id, kind, `${kind} `), new docx_1.TextRun(suffix)]);
    }
    $footnoteCounter = 0;
    footnote(node) {
        const { current, nextRunOpts } = this;
        this.current = [];
        delete this.nextRunOpts;
        this.$footnoteCounter += 1;
        this.renderInline(node);
        this.footnotes[this.$footnoteCounter] = {
            children: [new docx_1.Paragraph({ children: this.current })],
        };
        this.current = current;
        this.nextRunOpts = nextRunOpts;
        this.current.push(new docx_1.FootnoteReferenceRun(this.$footnoteCounter));
    }
    closeBlock(node, props) {
        const paragraph = new docx_1.Paragraph({
            children: this.current,
            ...this.nextParentParagraphOpts,
            ...props,
        });
        this.current = [];
        delete this.nextParentParagraphOpts;
        this.children.push(paragraph);
    }
    nextSection() {
        if (this.currentSectionIndex < this.sections.length - 1) {
            this.currentSectionIndex += 1;
            this.children = this.sections[this.currentSectionIndex].children;
        }
    }
    setSectionConfig(config) {
        this.sections[this.currentSectionIndex].config = {
            ...this.sections[this.currentSectionIndex].config,
            ...config,
        };
    }
    addSection(config = {}) {
        this.sections.push({
            config,
            children: [],
        });
        this.currentSectionIndex = this.sections.length - 1;
        this.children = this.sections[this.currentSectionIndex].children;
    }
    getCurrentSectionIndex() {
        return this.currentSectionIndex;
    }
    getCurrentSectionConfig() {
        return this.sections[this.currentSectionIndex].config;
    }
    getSerializationState() {
        return {
            numbering: this.numbering,
            sections: this.sections,
            footnotes: this.footnotes,
        };
    }
    createReference(id, before, after) {
        const children = [];
        if (before)
            children.push(new docx_1.TextRun(before));
        children.push(new docx_1.SimpleField(`REF ${id} \\h`));
        if (after)
            children.push(new docx_1.TextRun(after));
        const ref = new docx_1.InternalHyperlink({ anchor: id, children });
        this.current.push(ref);
    }
}
exports.DocxSerializerState = DocxSerializerState;
class DocxSerializer {
    nodes;
    marks;
    constructor(nodes, marks) {
        this.nodes = nodes;
        this.marks = marks;
    }
    serialize(content, options, getDocumentOptions) {
        const state = new DocxSerializerState(this.nodes, this.marks, options);
        state.renderContent(content);
        return (0, utils_1.buildDoc)(state, getDocumentOptions?.(state));
    }
}
exports.DocxSerializer = DocxSerializer;
class DocxSerializerStateAsync {
    nodes;
    options;
    marks;
    children;
    sections;
    currentSectionIndex = 0;
    numbering;
    footnotes = {};
    nextRunOpts;
    current = [];
    currentLink;
    nextParentParagraphOpts;
    currentNumbering;
    constructor(nodes, marks, options) {
        this.nodes = nodes;
        this.marks = marks;
        this.options = options ?? {};
        this.children = [];
        this.numbering = [];
        if (options.sections && options.sections.length > 0) {
            this.sections = options.sections.map((config) => ({
                config,
                children: [],
            }));
            this.children = this.sections[0].children;
        }
        else {
            this.sections = [];
        }
    }
    async renderContent(parent, opts) {
        for (let i = 0; i < parent.childCount; i += 1) {
            const node = parent.child(i);
            if (opts)
                this.addParagraphOptions(opts);
            await this.render(node, parent, i);
        }
    }
    async render(node, parent, index) {
        if (typeof parent === 'number')
            throw new Error('!');
        if (!this.nodes[node.type.name])
            throw new Error(`Token type \`${node.type.name}\` not supported by Word renderer`);
        await Promise.resolve(this.nodes[node.type.name](this, node, parent, index));
    }
    renderMarks(node, marks) {
        return marks
            .map((mark) => {
            return this.marks[mark.type.name]?.(this, node, mark);
        })
            .reduce((a, b) => ({ ...a, ...b }), {});
    }
    async renderInline(parent) {
        let currentLink;
        const closeLink = () => {
            if (!currentLink)
                return;
            const hyperlink = new docx_1.ExternalHyperlink({
                link: currentLink.link,
                children: this.current,
            });
            this.current = [...currentLink.stack, hyperlink];
            currentLink = undefined;
        };
        const openLink = (href) => {
            const sameLink = href === currentLink?.link;
            this.addRunOptions({ style: 'Hyperlink' });
            const oneLink = true;
            if (!oneLink) {
                closeLink();
            }
            else {
                if (currentLink && sameLink)
                    return;
                if (currentLink && !sameLink) {
                    closeLink();
                }
            }
            currentLink = {
                link: href,
                stack: this.current,
            };
            this.current = [];
        };
        const progress = async (node, offset, index) => {
            const links = node.marks.filter((m) => m.type.name === 'link');
            const hasLink = links.length > 0;
            if (hasLink) {
                openLink(links[0].attrs.href);
            }
            else if (!hasLink && currentLink) {
                closeLink();
            }
            if (node.isText) {
                this.text(node.text, this.renderMarks(node, [...node.marks]));
            }
            else {
                await this.render(node, parent, index);
            }
        };
        for (let i = 0; i < parent.childCount; i += 1) {
            await progress(parent.child(i), 0, i);
        }
        closeLink();
    }
    async renderList(node, style) {
        if (!this.currentNumbering) {
            const nextId = (0, utils_1.createShortId)();
            this.numbering.push((0, numbering_1.createNumbering)(nextId, style));
            this.currentNumbering = { reference: nextId, level: 0 };
        }
        else {
            const { reference, level } = this.currentNumbering;
            this.currentNumbering = { reference, level: level + 1 };
        }
        await this.renderContent(node);
        if (this.currentNumbering.level === 0) {
            delete this.currentNumbering;
        }
        else {
            const { reference, level } = this.currentNumbering;
            this.currentNumbering = { reference, level: level - 1 };
        }
    }
    async renderListItem(node) {
        if (!this.currentNumbering)
            throw new Error('Trying to create a list item without a list?');
        this.addParagraphOptions({ numbering: this.currentNumbering });
        await this.renderContent(node);
    }
    addParagraphOptions(opts) {
        this.nextParentParagraphOpts = { ...this.nextParentParagraphOpts, ...opts };
    }
    addRunOptions(opts) {
        this.nextRunOpts = { ...this.nextRunOpts, ...opts };
    }
    text(text, opts) {
        if (!text)
            return;
        this.current.push(new docx_1.TextRun({ text, ...this.nextRunOpts, ...opts }));
        delete this.nextRunOpts;
    }
    math(latex, opts = { inline: true }) {
        if (opts.inline || !opts.numbered) {
            this.current.push(new docx_1.Math({ children: [new docx_1.MathRun(latex)] }));
            return;
        }
        const id = opts.id ?? (0, utils_1.createShortId)();
        this.current = [
            new docx_1.TextRun('\t'),
            new docx_1.Math({
                children: [new docx_1.MathRun(latex)],
            }),
            new docx_1.TextRun('\t('),
            createReferenceBookmark(id, 'Equation'),
            new docx_1.TextRun(')'),
        ];
        this.addParagraphOptions({
            tabStops: [
                {
                    type: docx_1.TabStopType.CENTER,
                    position: docx_1.TabStopPosition.MAX / 2,
                },
                {
                    type: docx_1.TabStopType.RIGHT,
                    position: docx_1.TabStopPosition.MAX,
                },
            ],
        });
    }
    maxImageWidth = exports.MAX_IMAGE_WIDTH;
    async image(src, widthPercent = 70, align = 'center', imageRunOpts, imageType) {
        const buffer = await Promise.resolve(this.options.getImageBuffer(src));
        const dimensions = (0, image_dimensions_1.imageDimensionsFromData)(buffer);
        if (!dimensions)
            return;
        const aspect = dimensions.height / dimensions.width;
        const width = this.maxImageWidth * (widthPercent / 100);
        let it;
        try {
            it = imageType || src.replace(/.*\./, '').toLowerCase();
        }
        catch (e) {
            it = 'png';
        }
        this.current.push(new docx_1.ImageRun({
            data: buffer,
            ...imageRunOpts,
            type: it,
            transformation: {
                ...(imageRunOpts?.transformation || {}),
                width,
                height: width * aspect,
            },
        }));
        let alignment;
        switch (align) {
            case 'right':
                alignment = docx_1.AlignmentType.RIGHT;
                break;
            case 'left':
                alignment = docx_1.AlignmentType.LEFT;
                break;
            default:
                alignment = docx_1.AlignmentType.CENTER;
        }
        this.addParagraphOptions({
            alignment: alignment,
        });
    }
    async table(node, opts = {}) {
        const { getCellOptions, getRowOptions, tableOptions } = opts;
        const actualChildren = this.children;
        const rows = [];
        for (let rowIndex = 0; rowIndex < node.content.childCount; rowIndex += 1) {
            const row = node.content.child(rowIndex);
            const cells = [];
            let tableHeader = true;
            for (let cellIndex = 0; cellIndex < row.content.childCount; cellIndex += 1) {
                const cell = row.content.child(cellIndex);
                if (cell.type.name !== 'tableHeader') {
                    tableHeader = false;
                }
            }
            this.maxImageWidth = exports.MAX_IMAGE_WIDTH / row.content.childCount;
            for (let cellIndex = 0; cellIndex < row.content.childCount; cellIndex += 1) {
                const cell = row.content.child(cellIndex);
                this.children = [];
                await this.renderContent(cell);
                const tableCellOpts = { children: this.children };
                const colspan = cell.attrs.colspan ?? 1;
                const rowspan = cell.attrs.rowspan ?? 1;
                if (colspan > 1)
                    tableCellOpts.columnSpan = colspan;
                if (rowspan > 1)
                    tableCellOpts.rowSpan = rowspan;
                cells.push(new docx_1.TableCell({
                    ...tableCellOpts,
                    ...(getCellOptions?.(cell) || {}),
                }));
            }
            rows.push(new docx_1.TableRow({ ...(getRowOptions?.(row) || {}), children: cells, tableHeader }));
        }
        this.maxImageWidth = exports.MAX_IMAGE_WIDTH;
        const table = new docx_1.Table({ ...tableOptions, rows });
        actualChildren.push(table);
        actualChildren.push(new docx_1.Paragraph(''));
        this.children = actualChildren;
    }
    captionLabel(id, kind, { suffix } = { suffix: ': ' }) {
        this.current.push(...[createReferenceBookmark(id, kind, `${kind} `), new docx_1.TextRun(suffix)]);
    }
    $footnoteCounter = 0;
    async footnote(node) {
        const { current, nextRunOpts } = this;
        this.current = [];
        delete this.nextRunOpts;
        this.$footnoteCounter += 1;
        await this.renderInline(node);
        this.footnotes[this.$footnoteCounter] = {
            children: [new docx_1.Paragraph({ children: this.current })],
        };
        this.current = current;
        this.nextRunOpts = nextRunOpts;
        this.current.push(new docx_1.FootnoteReferenceRun(this.$footnoteCounter));
    }
    async footnoteDefinition(node, number) {
        const { current, children, nextRunOpts, nextParentParagraphOpts } = this;
        this.current = [];
        this.children = [];
        delete this.nextRunOpts;
        delete this.nextParentParagraphOpts;
        await this.renderContent(node);
        this.footnotes[number] = {
            children: this.children.filter((child) => child instanceof docx_1.Paragraph),
        };
        this.current = current;
        this.children = children;
        this.nextRunOpts = nextRunOpts;
        this.nextParentParagraphOpts = nextParentParagraphOpts;
    }
    closeBlock(node, props) {
        const paragraph = new docx_1.Paragraph({
            children: this.current,
            ...this.nextParentParagraphOpts,
            ...props,
        });
        this.current = [];
        delete this.nextParentParagraphOpts;
        this.children.push(paragraph);
    }
    nextSection() {
        if (this.currentSectionIndex < this.sections.length - 1) {
            this.currentSectionIndex += 1;
            this.children = this.sections[this.currentSectionIndex].children;
        }
    }
    setSectionConfig(config) {
        this.sections[this.currentSectionIndex].config = {
            ...this.sections[this.currentSectionIndex].config,
            ...config,
        };
    }
    addSection(config = {}) {
        this.sections.push({
            config,
            children: [],
        });
        this.currentSectionIndex = this.sections.length - 1;
        this.children = this.sections[this.currentSectionIndex].children;
    }
    getCurrentSectionIndex() {
        return this.currentSectionIndex;
    }
    getCurrentSectionConfig() {
        return this.sections[this.currentSectionIndex].config;
    }
    getSerializationState() {
        return {
            numbering: this.numbering,
            sections: this.sections,
            footnotes: this.footnotes,
        };
    }
    createReference(id, before, after) {
        const children = [];
        if (before)
            children.push(new docx_1.TextRun(before));
        children.push(new docx_1.SimpleField(`REF ${id} \\h`));
        if (after)
            children.push(new docx_1.TextRun(after));
        const ref = new docx_1.InternalHyperlink({ anchor: id, children });
        this.current.push(ref);
    }
}
exports.DocxSerializerStateAsync = DocxSerializerStateAsync;
class DocxSerializerAsync {
    nodes;
    marks;
    constructor(nodes, marks) {
        this.nodes = nodes;
        this.marks = marks;
    }
    async serializeAsync(content, options, getDocumentOptions) {
        const state = new DocxSerializerStateAsync(this.nodes, this.marks, options);
        await state.renderContent(content);
        return (0, utils_1.buildDoc)(state, getDocumentOptions?.(state));
    }
}
exports.DocxSerializerAsync = DocxSerializerAsync;
//# sourceMappingURL=serializer.js.map