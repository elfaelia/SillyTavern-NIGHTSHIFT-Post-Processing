import test from 'node:test';
import assert from 'node:assert/strict';
import { passLibrary } from '../settings/passLibrary.js';

const groups = Object.fromEntries(passLibrary.map(group => [group.id, group.items]));

test('every style filter locks spoken dialogue and each character register', () => {
    for (const [key, pass] of Object.entries(groups.style)) {
        assert.match(pass.prompt, /DIALOGUE LOCK/, key);
        assert.match(pass.prompt, /Preserve its exact wording, contractions or deliberate lack of contractions/, key);
        assert.match(pass.prompt, /dialect, regionalisms, period register/, key);
        assert.match(pass.prompt, /Do not introduce a time period, accent, dialect, nationality/, key);
    }
});

test('Easterman pass preserves his period and institutional voice', () => {
    const pass = groups.character.easterman;
    assert.equal(pass.category, 'character');
    assert.match(pass.prompt, /late 1950s and early 1960s/);
    assert.match(pass.prompt, /paternal therapist, program director, propagandist, and abusive authority/);
    assert.match(pass.prompt, /not Victorian/);
    assert.match(pass.prompt, /every other character's dialogue unchanged/);
});

test('Mark Jefferson pass is isolated and protects contractions', () => {
    const pass = groups.character.markJefferson;
    assert.equal(pass.category, 'character');
    assert.match(pass.prompt, /Edit only dialogue spoken by Mark Jefferson/);
    assert.match(pass.prompt, /contemporary American English/);
    assert.match(pass.prompt, /Preserve and naturally use contractions/);
    assert.match(pass.prompt, /Leave narration, events, formatting, and every other character's dialogue unchanged/);
});
