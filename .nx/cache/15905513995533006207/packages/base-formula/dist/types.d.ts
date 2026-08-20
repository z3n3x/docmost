import type { FormulaAST } from "./ast";
export type FormulaResultType = "number" | "string" | "boolean" | "date" | "null";
export type FormulaTypeOptions = {
    source: string;
    ast: FormulaAST;
    resultType: FormulaResultType;
    dependencies: string[];
    astVersion: 1;
    formatOptions?: Record<string, unknown>;
};
export type Value = number | string | boolean | null | ErrorCell;
export type ErrorCell = {
    __err: ErrorCode;
    msg: string;
    v: 1;
};
export type ErrorCode = "MISSING_PROP" | "TYPE_MISMATCH" | "DIV_BY_ZERO" | "DATE_INVALID" | "DEPTH_EXCEEDED" | "DEPENDENCY_ERROR";
export type EvalContext = {
    registry: ReadonlyMap<string, import("./functions/registry").FormulaFn>;
    properties: ReadonlyMap<string, PropertyLookup>;
    depth: number;
    maxDepth: number;
    memo: Map<string, Value>;
};
export type PropertyLookup = {
    id: string;
    type: string;
    typeOptions: unknown;
};
export declare const DEFAULT_MAX_DEPTH = 64;
export declare const MAX_FORMULA_SOURCE_LENGTH = 10000;
export declare const MAX_PARSE_DEPTH = 256;
export declare const MAX_EVAL_DEPTH = 512;
