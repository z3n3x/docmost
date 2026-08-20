"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNumbering = createNumbering;
const docx_1 = require("docx");
function basicIndentStyle(indent) {
    return {
        alignment: docx_1.AlignmentType.START,
        style: {
            paragraph: {
                indent: { left: (0, docx_1.convertInchesToTwip)(indent), hanging: (0, docx_1.convertInchesToTwip)(0.18) },
            },
        },
    };
}
const numbered = Array(3)
    .fill([docx_1.LevelFormat.DECIMAL, docx_1.LevelFormat.LOWER_LETTER, docx_1.LevelFormat.LOWER_ROMAN])
    .flat()
    .map((format, level) => ({
    level,
    format,
    text: `%${level + 1}.`,
    ...basicIndentStyle((level + 1) / 2),
}));
const bullets = Array(3)
    .fill(['●', '○', '■'])
    .flat()
    .map((text, level) => ({
    level,
    format: docx_1.LevelFormat.BULLET,
    text,
    ...basicIndentStyle((level + 1) / 2),
}));
const styles = {
    numbered,
    bullets,
};
function createNumbering(reference, style) {
    return {
        reference,
        levels: styles[style],
    };
}
//# sourceMappingURL=numbering.js.map