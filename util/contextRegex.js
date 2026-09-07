// Applies SillyTavern regex scripts to the pass context history, one message at a time.
// Each message is filtered with its own depth (the message being transformed is depth 0,
// so the last history message is depth 1) and role placement (user vs assistant).

// Returns an array of regexed message texts, aligned 1:1 with the History array
export function regexContextMessages(History, { getRegexedString, regex_placement, enabled, characterOverride }) {
    if (!Array.isArray(History) || History.length === 0) return [];

    // When disabled or the engine is unavailable, pass the raw message text through
    if (!enabled || typeof getRegexedString !== "function" || !regex_placement) {
        return History.map(m => m.mes);
    }

    return History.map((msg, i) => {
        try {
            const Depth = History.length - i;
            const isUser = msg.is_user === true || msg.is_user === 'true';
            const Placement = isUser ? regex_placement.USER_INPUT : regex_placement.AI_OUTPUT;
            return getRegexedString(msg.mes, Placement, { isPrompt: true, depth: Depth, characterOverride }) ?? msg.mes;
        } catch (e) {
            console.warn("NIGHTSHIFT: Error applying regex to context message", e);
            return msg.mes;
        }
    });
}
