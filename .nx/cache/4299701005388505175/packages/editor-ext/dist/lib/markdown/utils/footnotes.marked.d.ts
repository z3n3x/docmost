import { Token } from 'marked';
interface FootnoteRefToken {
    type: 'footnoteRef';
    label: string;
    raw: string;
}
interface FootnoteDefToken {
    type: 'footnoteDef';
    label: string;
    text: string;
    raw: string;
}
export declare function resetFootnotes(): void;
export declare function renderFootnotesList(): string;
export declare const footnoteRefExtension: {
    name: string;
    level: string;
    start(src: string): number;
    tokenizer(src: string): FootnoteRefToken | undefined;
    renderer(token: Token): string;
};
export declare const footnoteDefExtension: {
    name: string;
    level: string;
    start(src: string): number;
    tokenizer(src: string): FootnoteDefToken | undefined;
    renderer(token: Token): string;
};
export {};
