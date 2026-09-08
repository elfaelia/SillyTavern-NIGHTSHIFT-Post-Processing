import test from 'node:test';
import assert from 'node:assert/strict';
import { passLibrary } from '../settings/passLibrary.js';

const groups = Object.fromEntries(passLibrary.map(group => [group.id, group.items]));

test('every style filter locks spoken dialogue and contemporary register', () => {
    for (const [key, pass] of Object.entries(groups.style)) {
        assert.match(pass.prompt, /DIALOGUE LOCK/, key);
        assert.match(pass.prompt, /Preserve its exact wording, contractions, slang, profanity, fragments, punctuation, cadence/, key);
        assert.match(pass.prompt, /Victorian or archaic diction/, key);
    }
});

test('Mark Jefferson pass is isolated and protects contractions', () => {
    const pass = groups.character.markJefferson;
    assert.equal(pass.category, 'character');
    assert.match(pass.prompt, /Edit only dialogue spoken by Mark Jefferson/);
    assert.match(pass.prompt, /contemporary American English/);
    assert.match(pass.prompt, /Preserve and naturally use contractions/);
    assert.match(pass.prompt, /Leave narration, events, formatting, and every other character's dialogue unchanged/);
});
