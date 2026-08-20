import type { FormulaAST } from "./ast";
import type { Value, EvalContext } from "./types";
export declare function evaluate(ast: FormulaAST, row: Record<string, unknown>, ctx: EvalContext, astDepth?: number): Value;
