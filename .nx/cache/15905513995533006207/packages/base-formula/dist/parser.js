"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRaw = parseRaw;
const tokenizer_1 = require("./tokenizer");
const error_1 = require("./error");
const types_1 = require("./types");
function parseRaw(src) {
    const tokens = (0, tokenizer_1.tokenize)(src);
    const p = new Parser(tokens);
    const expr = p.parseExpr(0);
    p.expect(tokenizer_1.TokenKind.EOF, "Expected end of input");
    return expr;
}
const BP = {
    [tokenizer_1.TokenKind.OR]: 10,
    [tokenizer_1.TokenKind.AND]: 20,
    [tokenizer_1.TokenKind.EQ]: 30, [tokenizer_1.TokenKind.NEQ]: 30,
    [tokenizer_1.TokenKind.LT]: 40, [tokenizer_1.TokenKind.GT]: 40,
    [tokenizer_1.TokenKind.LTE]: 40, [tokenizer_1.TokenKind.GTE]: 40,
    [tokenizer_1.TokenKind.PLUS]: 50, [tokenizer_1.TokenKind.MINUS]: 50,
    [tokenizer_1.TokenKind.STAR]: 60, [tokenizer_1.TokenKind.SLASH]: 60, [tokenizer_1.TokenKind.PERCENT]: 60,
};
const TOK_TO_OP = {
    [tokenizer_1.TokenKind.PLUS]: "+", [tokenizer_1.TokenKind.MINUS]: "-",
    [tokenizer_1.TokenKind.STAR]: "*", [tokenizer_1.TokenKind.SLASH]: "/", [tokenizer_1.TokenKind.PERCENT]: "%",
    [tokenizer_1.TokenKind.EQ]: "==", [tokenizer_1.TokenKind.NEQ]: "!=",
    [tokenizer_1.TokenKind.LT]: "<", [tokenizer_1.TokenKind.GT]: ">",
    [tokenizer_1.TokenKind.LTE]: "<=", [tokenizer_1.TokenKind.GTE]: ">=",
};
class Parser {
    tokens;
    i = 0;
    depth = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    peek() { return this.tokens[this.i]; }
    next() { return this.tokens[this.i++]; }
    expect(kind, msg) {
        const t = this.peek();
        if (t.kind !== kind) {
            throw new error_1.FormulaParseError([{
                    code: "UNEXPECTED_TOKEN", message: msg, span: { start: t.start, end: t.end },
                }]);
        }
        return this.next();
    }
    enter() {
        if (++this.depth > types_1.MAX_PARSE_DEPTH) {
            const t = this.peek();
            throw new error_1.FormulaParseError([{
                    code: "DEPTH_EXCEEDED",
                    message: `Formula nesting too deep (max ${types_1.MAX_PARSE_DEPTH})`,
                    span: { start: t.start, end: t.end },
                }]);
        }
    }
    parseExpr(minBp) {
        this.enter();
        try {
            return this.parseExprInner(minBp);
        }
        finally {
            this.depth--;
        }
    }
    parseExprInner(minBp) {
        let lhs = this.parseUnary();
        while (true) {
            const tok = this.peek();
            if (tok.kind === tokenizer_1.TokenKind.AND) {
                if (BP[tokenizer_1.TokenKind.AND] < minBp)
                    break;
                this.next();
                const rhs = this.parseExpr(BP[tokenizer_1.TokenKind.AND] + 1);
                lhs = { t: "and", args: [lhs, rhs] };
                continue;
            }
            if (tok.kind === tokenizer_1.TokenKind.OR) {
                if (BP[tokenizer_1.TokenKind.OR] < minBp)
                    break;
                this.next();
                const rhs = this.parseExpr(BP[tokenizer_1.TokenKind.OR] + 1);
                lhs = { t: "or", args: [lhs, rhs] };
                continue;
            }
            const bp = BP[tok.kind];
            if (bp == null || bp < minBp)
                break;
            this.next();
            const rhs = this.parseExpr(bp + 1);
            const op = TOK_TO_OP[tok.kind];
            lhs = { t: "op", op, args: [lhs, rhs] };
        }
        return lhs;
    }
    parseUnary() {
        const tok = this.peek();
        if (tok.kind === tokenizer_1.TokenKind.MINUS) {
            this.next();
            this.enter();
            try {
                return { t: "op", op: "neg", args: [this.parseUnary()] };
            }
            finally {
                this.depth--;
            }
        }
        if (tok.kind === tokenizer_1.TokenKind.NOT) {
            this.next();
            this.enter();
            try {
                return { t: "op", op: "not", args: [this.parseUnary()] };
            }
            finally {
                this.depth--;
            }
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        const tok = this.next();
        switch (tok.kind) {
            case tokenizer_1.TokenKind.NUMBER: return { t: "num", v: Number(tok.text) };
            case tokenizer_1.TokenKind.STRING: return { t: "str", v: tok.text };
            case tokenizer_1.TokenKind.TRUE: return { t: "bool", v: true };
            case tokenizer_1.TokenKind.FALSE: return { t: "bool", v: false };
            case tokenizer_1.TokenKind.NULL: return { t: "null" };
            case tokenizer_1.TokenKind.LPAREN: {
                const e = this.parseExpr(0);
                this.expect(tokenizer_1.TokenKind.RPAREN, "Expected ')'");
                return e;
            }
            case tokenizer_1.TokenKind.AND:
            case tokenizer_1.TokenKind.OR:
            case tokenizer_1.TokenKind.IDENT: {
                if (this.peek().kind !== tokenizer_1.TokenKind.LPAREN) {
                    throw new error_1.FormulaParseError([{
                            code: "UNEXPECTED_TOKEN",
                            message: `Unexpected identifier '${tok.text}' (did you mean prop("${tok.text}")?)`,
                            span: { start: tok.start, end: tok.end },
                        }]);
                }
                this.next();
                const args = [];
                if (this.peek().kind !== tokenizer_1.TokenKind.RPAREN) {
                    args.push(this.parseExpr(0));
                    while (this.peek().kind === tokenizer_1.TokenKind.COMMA) {
                        this.next();
                        args.push(this.parseExpr(0));
                    }
                }
                this.expect(tokenizer_1.TokenKind.RPAREN, "Expected ')'");
                const head = tok.text.toLowerCase();
                if (head === "prop") {
                    if (args.length !== 1 || args[0].t !== "str") {
                        throw new error_1.FormulaParseError([{
                                code: "UNEXPECTED_TOKEN",
                                message: 'prop() expects exactly one string literal argument',
                                span: { start: tok.start, end: tok.end },
                            }]);
                    }
                    return { t: "propName", name: args[0].v };
                }
                if (head === "if") {
                    if (args.length !== 3) {
                        throw new error_1.FormulaParseError([{
                                code: "ARITY_MISMATCH",
                                message: "if() expects exactly 3 arguments",
                                span: { start: tok.start, end: tok.end },
                            }]);
                    }
                    return { t: "if", cond: args[0], then: args[1], else: args[2] };
                }
                if (head === "and")
                    return { t: "and", args };
                if (head === "or")
                    return { t: "or", args };
                return { t: "call", fn: tok.text, args };
            }
            default:
                throw new error_1.FormulaParseError([{
                        code: "UNEXPECTED_TOKEN",
                        message: `Unexpected token '${tok.text || tok.kind}'`,
                        span: { start: tok.start, end: tok.end },
                    }]);
        }
    }
}
//# sourceMappingURL=parser.js.map