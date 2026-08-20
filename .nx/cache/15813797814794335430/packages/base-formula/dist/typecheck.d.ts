import type { FormulaAST } from "./ast";
import type { FormulaResultType } from "./types";
import type { FormulaFn } from "./functions";
export type PropertyTypeMap = ReadonlyMap<string, FormulaResultType>;
export type TypecheckResult = {
    resultType: FormulaResultType;
};
export declare function typecheck(ast: FormulaAST, propertyTypes: PropertyTypeMap, registry: ReadonlyMap<string, FormulaFn>): TypecheckResult;
