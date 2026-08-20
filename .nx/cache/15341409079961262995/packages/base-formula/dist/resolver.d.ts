import type { FormulaAST, RawFormulaAST } from "./ast";
export type ResolveResult = {
    ast: FormulaAST;
    dependencies: string[];
};
export declare function resolve(raw: RawFormulaAST, nameToId: ReadonlyMap<string, string>): ResolveResult;
