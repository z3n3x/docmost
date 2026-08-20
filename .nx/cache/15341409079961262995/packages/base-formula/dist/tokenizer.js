"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenKind = void 0;
exports.tokenize = tokenize;
const error_1 = require("./error");
const types_1 = require("./types");
var TokenKind;
(function (TokenKind) {
    TokenKind["NUMBER"] = "NUMBER";
    TokenKind["STRING"] = "STRING";
    TokenKind["IDENT"] = "IDENT";
    TokenKind["TRUE"] = "TRUE";
    TokenKind["FALSE"] = "FALSE";
    TokenKind["NULL"] = "NULL";
    TokenKind["AND"] = "AND";
    TokenKind["OR"] = "OR";
    TokenKind["NOT"] = "NOT";
    TokenKind["PLUS"] = "PLUS";
    TokenKind["MINUS"] = "MINUS";
    TokenKind["STAR"] = "STAR";
    TokenKind["SLASH"] = "SLASH";
    TokenKind["PERCENT"] = "PERCENT";
    TokenKind["EQ"] = "EQ";
    TokenKind["NEQ"] = "NEQ";
    TokenKind["LT"] = "LT";
    TokenKind["GT"] = "GT";
    TokenKind["LTE"] = "LTE";
    TokenKind["GTE"] = "GTE";
    TokenKind["LPAREN"] = "LPAREN";
    TokenKind["RPAREN"] = "RPAREN";
    TokenKind["COMMA"] = "COMMA";
    TokenKind["EOF"] = "EOF";
})(TokenKind || (exports.TokenKind = TokenKind = {}));
const KEYWORDS = {
    true: TokenKind.TRUE,
    false: TokenKind.FALSE,
    null: TokenKind.NULL,
    and: TokenKind.AND,
    or: TokenKind.OR,
    not: TokenKind.NOT,
};
function tokenize(src) {
    if (src.length > types_1.MAX_FORMULA_SOURCE_LENGTH) {
        throw new error_1.FormulaParseError([{
                code: "INPUT_TOO_LONG",
                message: `Formula is too long (${src.length} chars; max ${types_1.MAX_FORMULA_SOURCE_LENGTH})`,
                span: { start: 0, end: types_1.MAX_FORMULA_SOURCE_LENGTH },
            }]);
    }
    const tokens = [];
    let i = 0;
    const push = (kind, text, start, end) => tokens.push({ kind, text, start, end });
    while (i < src.length) {
        const ch = src[i];
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            i++;
            continue;
        }
        if (ch >= "0" && ch <= "9") {
            const start = i;
            while (i < src.length && src[i] >= "0" && src[i] <= "9")
                i++;
            if (src[i] === ".") {
                i++;
                while (i < src.length && src[i] >= "0" && src[i] <= "9")
                    i++;
            }
            push(TokenKind.NUMBER, src.slice(start, i), start, i);
            continue;
        }
        if (ch === '"' || ch === "'") {
            const quote = ch;
            const start = i;
            i++;
            let body = "";
            while (i < src.length && src[i] !== quote) {
                if (src[i] === "\\") {
                    if (i + 1 >= src.length) {
                        throw new error_1.FormulaParseError([{
                                code: "UNEXPECTED_EOF",
                                message: "Unterminated escape in string",
                                span: { start, end: i + 1 },
                            }]);
                    }
                    const esc = src[i + 1];
                    body += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
                    i += 2;
                }
                else {
                    body += src[i];
                    i++;
                }
            }
            if (i >= src.length) {
                throw new error_1.FormulaParseError([{
                        code: "UNEXPECTED_EOF",
                        message: "Unterminated string literal",
                        span: { start, end: src.length },
                    }]);
            }
            i++;
            push(TokenKind.STRING, body, start, i);
            continue;
        }
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
            const start = i;
            while (i < src.length &&
                ((src[i] >= "a" && src[i] <= "z") ||
                    (src[i] >= "A" && src[i] <= "Z") ||
                    (src[i] >= "0" && src[i] <= "9") ||
                    src[i] === "_"))
                i++;
            const text = src.slice(start, i);
            const lower = text.toLowerCase();
            const kw = Object.prototype.hasOwnProperty.call(KEYWORDS, lower) ? KEYWORDS[lower] : undefined;
            push(kw ?? TokenKind.IDENT, text, start, i);
            continue;
        }
        const start = i;
        const two = src.slice(i, i + 2);
        if (two === "==") {
            push(TokenKind.EQ, two, start, i + 2);
            i += 2;
            continue;
        }
        if (two === "!=") {
            push(TokenKind.NEQ, two, start, i + 2);
            i += 2;
            continue;
        }
        if (two === "<=") {
            push(TokenKind.LTE, two, start, i + 2);
            i += 2;
            continue;
        }
        if (two === ">=") {
            push(TokenKind.GTE, two, start, i + 2);
            i += 2;
            continue;
        }
        const singleMap = {
            "+": TokenKind.PLUS, "-": TokenKind.MINUS, "*": TokenKind.STAR,
            "/": TokenKind.SLASH, "%": TokenKind.PERCENT,
            "<": TokenKind.LT, ">": TokenKind.GT,
            "(": TokenKind.LPAREN, ")": TokenKind.RPAREN, ",": TokenKind.COMMA,
        };
        if (singleMap[ch]) {
            push(singleMap[ch], ch, start, i + 1);
            i++;
            continue;
        }
        throw new error_1.FormulaParseError([{
                code: "UNEXPECTED_TOKEN",
                message: `Unexpected character '${ch}'`,
                span: { start: i, end: i + 1 },
            }]);
    }
    tokens.push({ kind: TokenKind.EOF, text: "", start: i, end: i });
    return tokens;
}
//# sourceMappingURL=tokenizer.js.map