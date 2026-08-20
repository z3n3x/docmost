import { ListItemOptions } from "@tiptap/extension-list-item";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        footnote: {
            focusFootnote: (id: string) => ReturnType;
        };
    }
}
export interface FootnoteOptions extends ListItemOptions {
    content: string;
}
declare const Footnote: any;
export default Footnote;
