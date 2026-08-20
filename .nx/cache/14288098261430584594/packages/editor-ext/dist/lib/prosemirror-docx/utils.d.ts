import { Document, INumberingOptions, IPropertiesOptions, ISectionOptions } from 'docx';
import { Node as ProsemirrorNode } from 'prosemirror-model';
import { IFootnotes, SerializationState } from './types';
export declare function createShortId(): string;
export declare function buildDoc(state: SerializationState, opts?: IPropertiesOptions): Document;
export declare function createDocFromState(state: {
    numbering: INumberingOptions['config'];
    children: ISectionOptions['children'];
    footnotes?: IFootnotes;
}): Document;
export declare function writeDocx(doc: Document, write?: ((buffer: Buffer) => void) | ((buffer: Buffer) => Promise<void>)): Promise<Buffer<ArrayBufferLike>>;
export declare function getLatexFromNode(node: ProsemirrorNode): string;
