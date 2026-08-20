import { Node, Mark } from 'prosemirror-model';
import { IParagraphOptions, IRunOptions, Paragraph, ParagraphChild, Table, ITableCellOptions, IImageOptions, Document, ITableOptions, ITableRowOptions, IPropertiesOptions } from 'docx';
import { NumberingStyles } from './numbering';
import { IFootnotes, INumbering, SectionConfig, SerializationState } from './types';
export type AlignOptions = 'left' | 'center' | 'right';
export type NodeSerializer = Record<string, (state: DocxSerializerState, node: Node, parent: Node, index: number) => void>;
export type NodeSerializerAsync = Record<string, (state: DocxSerializerStateAsync, node: Node, parent: Node, index: number) => void | Promise<void>>;
export type MarkSerializer = Record<string, (state: DocxSerializerState | DocxSerializerStateAsync, node: Node, mark: Mark) => IRunOptions>;
export type Options = {
    getImageBuffer: (src: string) => Uint8Array;
    sections?: SectionConfig[];
};
export type OptionsAsync = {
    getImageBuffer: (src: string) => Uint8Array | Promise<Uint8Array>;
    sections?: SectionConfig[];
};
export type IMathOpts = {
    inline?: boolean;
    id?: string | null;
    numbered?: boolean;
};
export type ImageType = 'jpg' | 'png' | 'gif' | 'bmp';
export declare const MAX_IMAGE_WIDTH = 600;
export declare class DocxSerializerState {
    nodes: NodeSerializer;
    options: Options;
    marks: MarkSerializer;
    children: (Paragraph | Table)[];
    sections: Array<{
        config: SectionConfig;
        children: (Paragraph | Table)[];
    }>;
    currentSectionIndex: number;
    numbering: INumbering[];
    footnotes: IFootnotes;
    nextRunOpts?: IRunOptions;
    current: ParagraphChild[];
    currentLink?: {
        link: string;
        children: IRunOptions[];
    };
    nextParentParagraphOpts?: IParagraphOptions;
    currentNumbering?: {
        reference: string;
        level: number;
    };
    constructor(nodes: NodeSerializer, marks: MarkSerializer, options: Options);
    renderContent(parent: Node, opts?: IParagraphOptions): void;
    render(node: Node, parent: Node, index: number): void;
    renderMarks(node: Node, marks: Mark[]): IRunOptions;
    renderInline(parent: Node): void;
    renderList(node: Node, style: NumberingStyles): void;
    renderListItem(node: Node): void;
    addParagraphOptions(opts: IParagraphOptions): void;
    addRunOptions(opts: IRunOptions): void;
    text(text: string | null | undefined, opts?: IRunOptions): void;
    math(latex: string, opts?: IMathOpts): void;
    maxImageWidth: number;
    image(src: string, widthPercent?: number, align?: AlignOptions, imageRunOpts?: IImageOptions, imageType?: ImageType): void;
    table(node: Node, opts?: {
        getCellOptions?: (cell: Node) => ITableCellOptions;
        getRowOptions?: (row: Node) => Omit<ITableRowOptions, 'children'>;
        tableOptions?: Omit<ITableOptions, 'rows'>;
    }): void;
    captionLabel(id: string, kind: 'Figure' | 'Table', { suffix }?: {
        suffix: string;
    }): void;
    $footnoteCounter: number;
    footnote(node: Node): void;
    closeBlock(node: Node, props?: IParagraphOptions): void;
    nextSection(): void;
    setSectionConfig(config: Partial<SectionConfig>): void;
    addSection(config?: SectionConfig): void;
    getCurrentSectionIndex(): number;
    getCurrentSectionConfig(): SectionConfig;
    getSerializationState(): SerializationState;
    createReference(id: string, before?: string, after?: string): void;
}
export declare class DocxSerializer {
    nodes: NodeSerializer;
    marks: MarkSerializer;
    constructor(nodes: NodeSerializer, marks: MarkSerializer);
    serialize(content: Node, options: Options, getDocumentOptions?: (state: SerializationState) => IPropertiesOptions): Document;
}
export declare class DocxSerializerStateAsync {
    nodes: NodeSerializerAsync;
    options: OptionsAsync;
    marks: MarkSerializer;
    children: (Paragraph | Table)[];
    sections: Array<{
        config: SectionConfig;
        children: (Paragraph | Table)[];
    }>;
    currentSectionIndex: number;
    numbering: INumbering[];
    footnotes: IFootnotes;
    nextRunOpts?: IRunOptions;
    current: ParagraphChild[];
    currentLink?: {
        link: string;
        children: IRunOptions[];
    };
    nextParentParagraphOpts?: IParagraphOptions;
    currentNumbering?: {
        reference: string;
        level: number;
    };
    constructor(nodes: NodeSerializerAsync, marks: MarkSerializer, options: OptionsAsync);
    renderContent(parent: Node, opts?: IParagraphOptions): Promise<void>;
    render(node: Node, parent: Node, index: number): Promise<void>;
    renderMarks(node: Node, marks: Mark[]): IRunOptions;
    renderInline(parent: Node): Promise<void>;
    renderList(node: Node, style: NumberingStyles): Promise<void>;
    renderListItem(node: Node): Promise<void>;
    addParagraphOptions(opts: IParagraphOptions): void;
    addRunOptions(opts: IRunOptions): void;
    text(text: string | null | undefined, opts?: IRunOptions): void;
    math(latex: string, opts?: IMathOpts): void;
    maxImageWidth: number;
    image(src: string, widthPercent?: number, align?: AlignOptions, imageRunOpts?: IImageOptions, imageType?: ImageType): Promise<void>;
    table(node: Node, opts?: {
        getCellOptions?: (cell: Node) => ITableCellOptions;
        getRowOptions?: (row: Node) => Omit<ITableRowOptions, 'children'>;
        tableOptions?: Omit<ITableOptions, 'rows'>;
    }): Promise<void>;
    captionLabel(id: string, kind: 'Figure' | 'Table', { suffix }?: {
        suffix: string;
    }): void;
    $footnoteCounter: number;
    footnote(node: Node): Promise<void>;
    footnoteDefinition(node: Node, number: number): Promise<void>;
    closeBlock(node: Node, props?: IParagraphOptions): void;
    nextSection(): void;
    setSectionConfig(config: Partial<SectionConfig>): void;
    addSection(config?: SectionConfig): void;
    getCurrentSectionIndex(): number;
    getCurrentSectionConfig(): SectionConfig;
    getSerializationState(): SerializationState;
    createReference(id: string, before?: string, after?: string): void;
}
export declare class DocxSerializerAsync {
    nodes: NodeSerializerAsync;
    marks: MarkSerializer;
    constructor(nodes: NodeSerializerAsync, marks: MarkSerializer);
    serializeAsync(content: Node, options: OptionsAsync, getDocumentOptions?: (state: SerializationState) => IPropertiesOptions): Promise<Document>;
}
