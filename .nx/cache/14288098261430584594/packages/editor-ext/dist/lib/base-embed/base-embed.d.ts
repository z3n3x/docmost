import { Node } from '@tiptap/core';
export interface BaseEmbedOptions {
    HTMLAttributes: Record<string, any>;
}
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        baseEmbed: {
            insertBaseEmbed: (attrs: {
                pageId: string | null;
                pendingKey?: string | null;
            }) => ReturnType;
        };
    }
}
export declare const BaseEmbed: Node<BaseEmbedOptions, any>;
