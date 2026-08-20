import { Node } from "@tiptap/core";
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        footnoteReference: {
            addFootnote: () => ReturnType;
        };
    }
}
declare const FootnoteReference: Node<any, any>;
export default FootnoteReference;
