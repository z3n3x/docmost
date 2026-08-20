import type { ErrorCell, ErrorCode } from "./types";
export type ParseErrorCode = "UNEXPECTED_TOKEN" | "UNEXPECTED_EOF" | "UNKNOWN_PROPERTY" | "UNKNOWN_FUNCTION" | "ARITY_MISMATCH" | "TYPE_MISMATCH" | "CYCLE" | "INPUT_TOO_LONG" | "DEPTH_EXCEEDED";
export type ParseError = {
    code: ParseErrorCode;
    message: string;
    span: {
        start: number;
        end: number;
    };
    hint?: string;
};
export declare class FormulaParseError extends Error {
    readonly errors: ParseError[];
    constructor(errors: ParseError[]);
}
export declare function makeErrorCell(code: ErrorCode, msg: string): ErrorCell;
export declare function isErrorCell(v: unknown): v is ErrorCell;
