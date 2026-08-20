export declare enum TokenKind {
    NUMBER = "NUMBER",
    STRING = "STRING",
    IDENT = "IDENT",
    TRUE = "TRUE",
    FALSE = "FALSE",
    NULL = "NULL",
    AND = "AND",
    OR = "OR",
    NOT = "NOT",
    PLUS = "PLUS",
    MINUS = "MINUS",
    STAR = "STAR",
    SLASH = "SLASH",
    PERCENT = "PERCENT",
    EQ = "EQ",
    NEQ = "NEQ",
    LT = "LT",
    GT = "GT",
    LTE = "LTE",
    GTE = "GTE",
    LPAREN = "LPAREN",
    RPAREN = "RPAREN",
    COMMA = "COMMA",
    EOF = "EOF"
}
export type Token = {
    kind: TokenKind;
    text: string;
    start: number;
    end: number;
};
export declare function tokenize(src: string): Token[];
