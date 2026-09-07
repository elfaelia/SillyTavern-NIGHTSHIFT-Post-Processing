import test from 'node:test';
import assert from 'node:assert/strict';
import { applyWithProtectedContent, maskProtectedContent, restoreProtectedContent } from '../util/protectedContent.js';

const route = `<route>\n!driver: aftermath\n!support_1: deception\n!tone: tense\n</route>`;
const board = `<div class="ihyll-style"><b>Date:</b> {{date}} | <span>Monday</span></div>`;

test('restores macros and structured blocks byte-for-byte', () => {
    const input = `Rough prose.\n\n${route}\n${board}\n{{getvar::ns_state_driver}}`;
    const protection = maskProtectedContent(input);
    const edited = protection.maskedText.replace('Rough prose.', 'Polished prose.');
    const output = restoreProtectedContent(edited, protection);
    assert.equal(output, `Polished prose.\n\n${route}\n${board}\n{{getvar::ns_state_driver}}`);
});

test('protects nested tags as one exact block', () => {
    const input = `Before <div><div><b>nested</b></div></div> after`;
    const protection = maskProtectedContent(input);
    assert.equal(protection.vault.length, 1);
    assert.equal(restoreProtectedContent(protection.maskedText, protection), input);
});

test('fails closed when a model drops a token', () => {
    const protection = maskProtectedContent(`Text\n${route}`);
    assert.throws(() => restoreProtectedContent('Edited text only', protection), /discarded/);
});

test('protects blocks from regex or formatter transforms', () => {
    const input = `bad prose\n${route}`;
    const output = applyWithProtectedContent(input, value => value.replace('bad prose', 'good prose').replace('aftermath', 'ERASED'));
    assert.equal(output, `good prose\n${route}`);
});

test('protects nested SillyTavern condition macros as one exact unit', () => {
    const macro = '{{if {{.ns_state_driver == quiet_dread}}}}';
    const protection = maskProtectedContent(`Before ${macro} after`);
    assert.equal(protection.vault.length, 1);
    assert.equal(restoreProtectedContent(protection.maskedText, protection), `Before ${macro} after`);
});

test('fails closed if a bottom route is moved above the prose', () => {
    const protection = maskProtectedContent(`Narrative first.\n${route}`);
    assert.throws(() => restoreProtectedContent(`${protection.vault[0].token}\nEdited narrative.`, protection), /moved protected content/);
});
