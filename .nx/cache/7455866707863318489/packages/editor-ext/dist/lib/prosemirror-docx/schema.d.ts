import { Node } from 'prosemirror-model';
import { MarkSerializer, NodeSerializerAsync, OptionsAsync } from './serializer';
export type DocxImageResolver = OptionsAsync['getImageBuffer'];
export declare const defaultAsyncNodes: NodeSerializerAsync;
export declare const defaultMarks: MarkSerializer;
export declare function pageNodeToDocxBuffer(doc: Node, getImageBuffer: DocxImageResolver): Promise<Buffer>;
