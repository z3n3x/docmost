import type { FormulaResultType, Value, EvalContext } from "../types";
export type FormulaFn = {
    name: string;
    arity: {
        min: number;
        max: number | null;
    };
    paramTypes: FormulaResultType[] | "any" | "variadic-any";
    returnType: FormulaResultType | ((argTypes: FormulaResultType[]) => FormulaResultType);
    eval: (args: Value[], ctx: EvalContext) => Value;
    doc: string;
    category: "logic" | "math" | "string" | "date" | "coercion";
};
export declare const registry: Map<string, FormulaFn>;
export declare function register(fn: FormulaFn): void;
