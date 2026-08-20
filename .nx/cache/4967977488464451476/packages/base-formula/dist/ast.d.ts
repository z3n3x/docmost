export type OpCode = "+" | "-" | "*" | "/" | "%" | "==" | "!=" | ">" | "<" | ">=" | "<=" | "neg" | "not";
export type FormulaAST = {
    t: "num";
    v: number;
} | {
    t: "str";
    v: string;
} | {
    t: "bool";
    v: boolean;
} | {
    t: "null";
} | {
    t: "prop";
    id: string;
} | {
    t: "op";
    op: OpCode;
    args: FormulaAST[];
} | {
    t: "if";
    cond: FormulaAST;
    then: FormulaAST;
    else: FormulaAST;
} | {
    t: "and";
    args: FormulaAST[];
} | {
    t: "or";
    args: FormulaAST[];
} | {
    t: "call";
    fn: string;
    args: FormulaAST[];
};
export type RawFormulaAST = Exclude<FormulaAST, {
    t: "prop";
}> | {
    t: "propName";
    name: string;
} | {
    t: "op";
    op: OpCode;
    args: RawFormulaAST[];
} | {
    t: "if";
    cond: RawFormulaAST;
    then: RawFormulaAST;
    else: RawFormulaAST;
} | {
    t: "and";
    args: RawFormulaAST[];
} | {
    t: "or";
    args: RawFormulaAST[];
} | {
    t: "call";
    fn: string;
    args: RawFormulaAST[];
};
export declare const AST_VERSION: 1;
