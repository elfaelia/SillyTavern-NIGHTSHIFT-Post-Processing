const TOKEN_PATTERN = /\[\[\[NSP_[A-Z0-9_]+\]\]\]/g;

export const PROTECTION_NOTICE = `\n\n<protected_content_rules>
Some portions of <text_to_transform> have been replaced by tokens shaped like [[[NSP_0000_AB12CD34]]].
Copy every protection token exactly once, in the same order and position relative to the surrounding prose.
Never rewrite, delete, duplicate, rename, split, or move a protection token. The extension will restore the exact original structured content after your edit.
</protected_content_rules>`;

function checksum(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function collectRegexRanges(text, regex, ranges) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
        ranges.push({ start: match.index, end: match.index + match[0].length });
    }
}

function collectMacroRanges(text, ranges) {
    const stack = [];
    for (let index = 0; index < text.length - 1; index++) {
        const pair = text.slice(index, index + 2);
        if (pair === '{{') {
            stack.push(index);
            index++;
        } else if (pair === '}}' && stack.length) {
            const start = stack.pop();
            index++;
            if (!stack.length) ranges.push({ start, end: index + 1 });
        }
    }
}

function collectTagRanges(text, ranges) {
    const tagRegex = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z][\w:.-]*(?:\s[^<>]*?)?\s*\/?>/g;
    const stack = [];
    const tags = [];

    for (const match of text.matchAll(tagRegex)) {
        const raw = match[0];
        const start = match.index;
        const end = start + raw.length;
        if (raw.startsWith('<!--') || raw.startsWith('<![CDATA[')) {
            ranges.push({ start, end });
            continue;
        }

        const parsed = raw.match(/^<(\/)?([A-Za-z][\w:.-]*)/);
        if (!parsed) continue;
        const closing = Boolean(parsed[1]);
        const name = parsed[2].toLowerCase();
        const selfClosing = /\/\s*>$/.test(raw) || /^(?:br|hr|img|input|meta|link|source|track|wbr)$/i.test(name);
        tags.push({ start, end });

        if (!closing && !selfClosing) {
            stack.push({ name, start, end });
            continue;
        }

        if (closing) {
            for (let index = stack.length - 1; index >= 0; index--) {
                if (stack[index].name !== name) continue;
                const opening = stack[index];
                stack.splice(index);
                ranges.push({ start: opening.start, end });
                break;
            }
        }
    }

    // Unpaired tags still stay byte-for-byte intact.
    ranges.push(...tags);
}

function mergeRanges(ranges) {
    const sorted = ranges
        .filter(range => Number.isInteger(range.start) && range.end > range.start)
        .sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [];
    for (const range of sorted) {
        const last = merged.at(-1);
        if (!last || range.start > last.end) merged.push({ ...range });
        else last.end = Math.max(last.end, range.end);
    }
    return merged;
}

export function maskProtectedContent(text) {
    const source = String(text ?? '');
    const ranges = [];
    collectMacroRanges(source, ranges);
    collectRegexRanges(source, /```[\s\S]*?```/g, ranges);
    collectTagRanges(source, ranges);

    const vault = [];
    let maskedText = '';
    let cursor = 0;
    for (const [index, range] of mergeRanges(ranges).entries()) {
        const value = source.slice(range.start, range.end);
        const token = `[[[NSP_${String(index).padStart(4, '0')}_${checksum(value)}]]]`;
        maskedText += source.slice(cursor, range.start) + token;
        vault.push({ token, value, start: range.start, end: range.end });
        cursor = range.end;
    }
    maskedText += source.slice(cursor);
    return { maskedText, vault, originalText: source };
}

export function restoreVisibleProtectedContent(text, vault) {
    let restored = String(text ?? '');
    for (const entry of vault || []) restored = restored.replaceAll(entry.token, entry.value);
    return restored;
}

export function restoreProtectedContent(text, protection) {
    const result = String(text ?? '');
    const vault = protection?.vault || [];
    if (!vault.length) return result;

    let previousIndex = -1;
    const resultSegments = [];
    let resultCursor = 0;
    const expected = new Set(vault.map(entry => entry.token));
    for (const entry of vault) {
        const first = result.indexOf(entry.token);
        const last = result.lastIndexOf(entry.token);
        if (first < 0 || first !== last) throw new Error('The editing model deleted or duplicated protected content. This pass was discarded to keep the original macros and tags safe.');
        if (first < previousIndex) throw new Error('The editing model moved protected content. This pass was discarded to keep the original structure safe.');
        resultSegments.push(result.slice(resultCursor, first));
        resultCursor = first + entry.token.length;
        previousIndex = first;
    }
    resultSegments.push(result.slice(resultCursor));

    const originalSegments = [];
    let originalCursor = 0;
    for (const entry of vault) {
        originalSegments.push(protection.originalText.slice(originalCursor, entry.start));
        originalCursor = entry.end;
    }
    originalSegments.push(protection.originalText.slice(originalCursor));
    for (let index = 0; index < originalSegments.length; index++) {
        if (Boolean(originalSegments[index].trim()) !== Boolean(resultSegments[index].trim())) {
            throw new Error('The editing model moved protected content across prose. This pass was discarded to keep macros and tagged blocks in their original positions.');
        }
    }

    for (const token of result.match(TOKEN_PATTERN) || []) {
        if (!expected.has(token)) throw new Error('The editing model altered a protected-content token. This pass was discarded to prevent data loss.');
    }

    return restoreVisibleProtectedContent(result, vault);
}

export function applyWithProtectedContent(text, transform) {
    const protection = maskProtectedContent(text);
    const transformed = transform(protection.maskedText);
    return restoreProtectedContent(transformed, protection);
}
