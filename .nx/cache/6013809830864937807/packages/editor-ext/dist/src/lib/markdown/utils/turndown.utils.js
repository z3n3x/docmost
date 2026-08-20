"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlToMarkdown = htmlToMarkdown;
const _TurndownService = __importStar(require("@joplin/turndown"));
const TurndownPluginGfm = __importStar(require("@joplin/turndown-plugin-gfm"));
const basename_1 = require("./basename");
const TurndownService = _TurndownService.default || _TurndownService;
function sanitizeMdLinkText(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/([\[\]!])/g, '\\$1')
        .replace(/[\r\n]+/g, ' ');
}
function htmlToMarkdown(html) {
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        hr: '---',
        bulletListMarker: '-',
    });
    turndownService.use([
        TurndownPluginGfm.tables,
        TurndownPluginGfm.strikethrough,
        TurndownPluginGfm.highlightedCodeBlock,
        taskList,
        callout,
        preserveDetail,
        listParagraph,
        orderedListItem,
        mathInline,
        mathBlock,
        iframeEmbed,
        image,
        video,
        footnoteRef,
        footnotesList,
    ]);
    return turndownService.turndown(html).replaceAll('<br>', ' ');
}
function listParagraph(turndownService) {
    turndownService.addRule('paragraph', {
        filter: ['p'],
        replacement: (content, node) => {
            if (node.parentElement?.nodeName === 'LI') {
                return content;
            }
            return `\n\n${content}\n\n`;
        },
    });
}
function orderedListItem(turndownService) {
    turndownService.addRule('orderedListItem', {
        filter: function (node) {
            return node.nodeName === 'LI' && node.getAttribute('data-type') !== 'taskItem';
        },
        replacement: (content, node, options) => {
            const parent = node.parentNode;
            if (parent.nodeName !== 'OL' && parent.nodeName !== 'UL') {
                return content;
            }
            content = content
                .replace(/^\n+/, '')
                .replace(/\n+$/, '\n')
                .replace(/\n/gm, '\n  ');
            let prefix;
            if (parent.nodeName === 'OL') {
                const start = parseInt(parent.getAttribute('start') || '1', 10);
                const index = Array.prototype.indexOf.call(parent.children, node);
                prefix = `${start + index}. `;
            }
            else {
                prefix = `${options.bulletListMarker} `;
            }
            return (prefix +
                content +
                (node.nextSibling && !/\n$/.test(content) ? '\n' : ''));
        },
    });
}
function callout(turndownService) {
    turndownService.addRule('callout', {
        filter: function (node) {
            return (node.nodeName === 'DIV' && node.getAttribute('data-type') === 'callout');
        },
        replacement: function (content, node) {
            const calloutType = node.getAttribute('data-callout-type');
            return `\n\n:::${calloutType}\n${content.trim()}\n:::\n\n`;
        },
    });
}
function taskList(turndownService) {
    turndownService.addRule('taskListItem', {
        filter: function (node) {
            return (node.getAttribute('data-type') === 'taskItem' &&
                node.parentNode.nodeName === 'UL');
        },
        replacement: function (_content, node) {
            const isChecked = node.getAttribute('data-checked') === 'true';
            const div = node.querySelector('div');
            const text = div ? div.textContent.trim() : node.textContent.trim();
            const prefix = `- ${isChecked ? '[x]' : '[ ]'} `;
            return (prefix +
                text +
                (node.nextSibling && !/\n$/.test(text) ? '\n' : ''));
        },
    });
}
function preserveDetail(turndownService) {
    turndownService.addRule('preserveDetail', {
        filter: function (node) {
            return node.nodeName === 'DETAILS';
        },
        replacement: function (_content, node) {
            const summary = node.querySelector(':scope > summary');
            let detailSummary = '';
            if (summary) {
                detailSummary = `<summary>${turndownService.turndown(summary.innerHTML)}</summary>`;
            }
            const detailsContent = Array.from(node.childNodes)
                .filter((child) => child.nodeName !== 'SUMMARY')
                .map((child) => child.nodeType === 1
                ? turndownService.turndown(child.outerHTML)
                : child.textContent)
                .join('');
            return `\n<details>\n${detailSummary}\n\n${detailsContent}\n\n</details>\n`;
        },
    });
}
function mathInline(turndownService) {
    turndownService.addRule('mathInline', {
        filter: function (node) {
            return (node.nodeName === 'SPAN' &&
                node.getAttribute('data-type') === 'mathInline');
        },
        replacement: function (content) {
            return `$${content}$`;
        },
    });
}
function mathBlock(turndownService) {
    turndownService.addRule('mathBlock', {
        filter: function (node) {
            return (node.nodeName === 'DIV' &&
                node.getAttribute('data-type') === 'mathBlock');
        },
        replacement: function (content) {
            return `\n$$\n${content}\n$$\n`;
        },
    });
}
function iframeEmbed(turndownService) {
    turndownService.addRule('iframeEmbed', {
        filter: function (node) {
            return node.nodeName === 'IFRAME';
        },
        replacement: function (_content, node) {
            const src = node.getAttribute('src');
            return '[' + src + '](' + src + ')';
        },
    });
}
function image(turndownService) {
    turndownService.addRule('image', {
        filter: 'img',
        replacement: function (_content, node) {
            const src = node.getAttribute('src') || '';
            if (!src)
                return '';
            const alt = sanitizeMdLinkText(node.getAttribute('alt') || '');
            const title = node.getAttribute('title') || '';
            const titlePart = title ? ' "' + title.replace(/"/g, '\\"') + '"' : '';
            return '![' + alt + '](' + src + titlePart + ')';
        },
    });
}
function getFootnoteAnchor(node) {
    const child = node.firstElementChild;
    return child?.nodeName === 'A' && child.classList.contains('footnote-ref')
        ? child
        : null;
}
function footnoteRef(turndownService) {
    turndownService.addRule('footnoteRef', {
        filter: function (node) {
            return node.nodeName === 'SUP' && !!getFootnoteAnchor(node);
        },
        replacement: function (_content, node) {
            const anchor = getFootnoteAnchor(node);
            const number = anchor.getAttribute('data-reference-number') || anchor.textContent;
            return `[^${number}]`;
        },
    });
}
function footnotesList(turndownService) {
    turndownService.addRule('footnotesList', {
        filter: function (node) {
            return node.nodeName === 'OL' && node.classList.contains('footnotes');
        },
        replacement: function (_content, node) {
            const items = Array.from(node.children).filter((child) => child.nodeName === 'LI');
            const definitions = items.map((li, index) => {
                const number = (li.getAttribute('id') || '').replace('fn:', '') ||
                    String(index + 1);
                const markdown = turndownService
                    .turndown(li.innerHTML)
                    .trim();
                const [first, ...rest] = markdown.split('\n');
                const body = [
                    first,
                    ...rest.map((line) => (line.trim() ? `    ${line}` : line)),
                ].join('\n');
                return `[^${number}]: ${body}`;
            });
            return `\n\n${definitions.join('\n')}\n\n`;
        },
    });
}
function video(turndownService) {
    turndownService.addRule('video', {
        filter: function (node) {
            return node.tagName === 'VIDEO';
        },
        replacement: function (_content, node) {
            const src = node.getAttribute('src') || '';
            const ariaLabel = node.getAttribute('aria-label');
            const name = sanitizeMdLinkText(ariaLabel || (0, basename_1.getBasename)(src) || src);
            return '[' + name + '](' + src + ')';
        },
    });
}
//# sourceMappingURL=turndown.utils.js.map