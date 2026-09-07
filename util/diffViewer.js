// diffViewer.js — NIGHTSHIFT Diff Viewer
// Word-level diff rendering and review modal management.
// sponsored by claude the goat

import { getContext } from "../../../../extensions.js";
import { updateMessageBlock, messageFormatting } from "../../../../../script.js";

/// Helpers

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return str
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">");
}

// Split text into tokens: words and whitespace, preserving round-trip fidelity
function tokenize(text) {
    return text.split(/(\s+)/);
}

//

const MAX_DIFF_TOKENS = 50000;

function myersDiff(oldTokens, newTokens) {
    const oldLength = oldTokens.length;
    const newLength = newTokens.length;
    const maxTotalLength = oldLength + newLength;
    const furthestPaths = new Int32Array(2 * maxTotalLength + 1);
    const pathHistory = [];

    furthestPaths[maxTotalLength + 1] = 0;

    for (let editDepth = 0; editDepth <= maxTotalLength; editDepth++) {
        // Memory safeguard for highly divergent huge texts (keeps memory < 100MB)
        if (editDepth > 10000) return null;
        
        pathHistory.push(furthestPaths.slice(maxTotalLength - editDepth, maxTotalLength + editDepth + 1));

        for (let diagonal = -editDepth; diagonal <= editDepth; diagonal += 2) {
            let oldPos;
            const goDown = (diagonal === -editDepth || (diagonal !== editDepth && furthestPaths[maxTotalLength + diagonal - 1] < furthestPaths[maxTotalLength + diagonal + 1]));

            if (goDown) {
                oldPos = furthestPaths[maxTotalLength + diagonal + 1];
            } else {
                oldPos = furthestPaths[maxTotalLength + diagonal - 1] + 1;
            }

            let newPos = oldPos - diagonal;

            while (oldPos < oldLength && newPos < newLength && oldTokens[oldPos] === newTokens[newPos]) {
                oldPos++;
                newPos++;
            }

            furthestPaths[maxTotalLength + diagonal] = oldPos;

            if (oldPos >= oldLength && newPos >= newLength) {
                const ops = [];
                let currOldPos = oldLength, currNewPos = newLength;

                for (let step = editDepth; step > 0; step--) {
                    const historyArray = pathHistory[step];
                    const currDiagonal = currOldPos - currNewPos;
                    const histIndex = step + currDiagonal;

                    const wentDown = (currDiagonal === -step || (currDiagonal !== step && historyArray[histIndex - 1] < historyArray[histIndex + 1]));

                    let startX, startY;
                    if (wentDown) {
                        startX = historyArray[histIndex + 1];
                    } else {
                        startX = historyArray[histIndex - 1] + 1;
                    }
                    startY = startX - currDiagonal;

                    while (currOldPos > startX && currNewPos > startY && currOldPos > 0 && currNewPos > 0) {
                        ops.unshift({ type: "equal", v: oldTokens[currOldPos - 1] });
                        currOldPos--; currNewPos--;
                    }

                    if (wentDown) {
                        if (currNewPos > 0) {
                            ops.unshift({ type: "insert", v: newTokens[currNewPos - 1] });
                            currNewPos--;
                        }
                    } else {
                        if (currOldPos > 0) {
                            ops.unshift({ type: "delete", v: oldTokens[currOldPos - 1] });
                            currOldPos--;
                        }
                    }
                }
                while (currOldPos > 0 && currNewPos > 0) {
                    ops.unshift({ type: "equal", v: oldTokens[currOldPos - 1] });
                    currOldPos--; currNewPos--;
                }
                while (currOldPos > 0) {
                    ops.unshift({ type: "delete", v: oldTokens[currOldPos - 1] });
                    currOldPos--;
                }
                while (currNewPos > 0) {
                    ops.unshift({ type: "insert", v: newTokens[currNewPos - 1] });
                    currNewPos--;
                }
                return ops;
            }
        }
    }
    return [];
}

function computeWordDiff(oldText, newText) {
    const a = tokenize(oldText);
    const b = tokenize(newText);

    // Graceful fallback for very large texts — skip highlighting
    if (a.length > MAX_DIFF_TOKENS || b.length > MAX_DIFF_TOKENS) {
        return { oldHtml: escapeHtml(oldText), newHtml: escapeHtml(newText) };
    }

    // Optimization 1: Strip common prefix
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) {
        start++;
    }

    // Optimization 2: Strip common suffix
    let endA = a.length - 1;
    let endB = b.length - 1;
    while (endA >= start && endB >= start && a[endA] === b[endB]) {
        endA--;
        endB--;
    }

    const subA = a.slice(start, endA + 1);
    const subB = b.slice(start, endB + 1);

    let ops = myersDiff(subA, subB);
    if (!ops) {
        // Fallback if diff is too divergent
        ops = [
            ...subA.map(v => ({ type: "delete", v })),
            ...subB.map(v => ({ type: "insert", v }))
        ];
    }

    // Reconstruct operations including common prefix and suffix
    const fullOps = [
        ...a.slice(0, start).map(v => ({ type: "equal", v })),
        ...ops,
        ...a.slice(endA + 1).map(v => ({ type: "equal", v }))
    ];

    let oldHtml = "", newHtml = "";
    for (const op of fullOps) {
        if (op.v === undefined || op.v === null) continue;
        const v = escapeHtml(op.v);
        if (op.type === "equal")        { oldHtml += v; newHtml += v; }
        else if (op.type === "delete")  { oldHtml += `<del class="ns-del">${v}</del>`; }
        else                            { newHtml += `<ins class="ns-ins">${v}</ins>`; }
    }

    return { oldHtml, newHtml };
}

//

let _acceptCallback = null;
let _rejectCallback = null;

// Step navigation state
let _steps = null;
let _currentStep = 0;

import { extension_settings } from "../../../../extensions.js";

//

function getST() {
    return getContext();
}

function safeUpdateMessageText(mesId, msg) {
    try {
        updateMessageBlock(mesId, msg);
    } catch (e) {
        console.warn("NIGHTSHIFT: Non-fatal error in updateMessageBlock", e);
    }

    const mesEl = $(`#chat .mes[mesid="${mesId}"]`);
    if (mesEl.length > 0) {
        const mesTextEl = mesEl.find('.mes_text');
        if (mesTextEl.length > 0) {
            mesTextEl.empty();
            mesEl.find('.mes_edit_buttons').css('display', 'none');
            mesEl.find('.mes_buttons').css('display', '');
            mesTextEl.append(
                messageFormatting(
                    msg.mes,
                    msg.name,
                    msg.is_system,
                    msg.is_user,
                    mesId,
                    {},
                    false
                )
            );
        }
    }

    const st = getST();
    if (st.eventSource && st.event_types?.MESSAGE_EDITED) {
        try {
            st.eventSource.emit(st.event_types.MESSAGE_EDITED, mesId);
        } catch (e) {
            console.warn("NIGHTSHIFT: Non-fatal error emitting MESSAGE_EDITED", e);
        }
    }
}

// Build comparison steps from pass snapshots.
// snapshots: [originalText, afterPass1, afterPass2, ..., finalText]
// passNames: ["Pass1Name", "Pass2Name", ...] — names of enabled passes in order
function buildSteps(snapshots, passNames) {
    if (!snapshots || snapshots.length < 2) return null;

    const getPassName = (i) => (passNames && passNames[i - 1]) ? passNames[i - 1] : null;

    const steps = [];

    // Step 0: full diff — original vs final (current default view)
    steps.push({
        oldText: snapshots[0],
        newText: snapshots[snapshots.length - 1],
        oldLabel: "Original",
        newLabel: "Final"
    });

    // Steps 1..N: incremental diffs between consecutive passes
    for (let i = 0; i < snapshots.length - 1; i++) {
        steps.push({
            oldText: snapshots[i],
            newText: snapshots[i + 1],
            oldLabel: i === 0 ? "Original" : `Pass ${i}`,
            newLabel: `Pass ${i + 1}`,
            caption: i === 0 ? "Original → Pass 1" : `Pass ${i} → Pass ${i + 1}`,
            passName: getPassName(i + 1)
        });
    }

    return steps;
}

function getStepCaption(stepIndex) {
    if (stepIndex === 0) return "Full Diff";
    if (!_steps || !_steps[stepIndex]) return `Step ${stepIndex}`;
    return _steps[stepIndex].caption || `Step ${stepIndex}`;
}

//

function renderStep(stepIndex) {
    if (!_steps || stepIndex < 0 || stepIndex >= _steps.length) return;
    _currentStep = stepIndex;

    const step = _steps[stepIndex];
    const disableEditable = extension_settings["NIGHTSHIFT"] && extension_settings["NIGHTSHIFT"].disable_editable_diff;

    // Step 0 uses live textarea value to respect any user edits made since opening
    const newText = stepIndex === 0 ? ($("#nightshift_diff_transformed").val() || step.newText) : step.newText;
    const { oldHtml, newHtml } = computeWordDiff(step.oldText, newText);

    // Update panel content
    $("#nightshift_diff_original_view").html(oldHtml);
    $("#nightshift_diff_transformed_view").html(newHtml);

    // Update panel header labels
    $(".ns-diff-original-header .ns-diff-panel-label").text(step.oldLabel);
    $(".ns-diff-transformed-header .ns-diff-panel-label").text(step.newLabel);

    // Textarea is editable only on step 0 (the full-diff / accept view)
    if (stepIndex === 0 && !disableEditable) {
        $("#nightshift_diff_transformed").show();
        $("#nightshift_diff_transformed_view").css({ "height": "", "flex": "" });
        $(".ns-diff-edit-hint").show();
    } else {
        $("#nightshift_diff_transformed").hide();
        $("#nightshift_diff_transformed_view").css({ "height": "100%", "flex": "1 1 auto" });
        $(".ns-diff-edit-hint").hide();
    }

    // Update active dot
    $(".ns-diff-dot").removeClass("ns-diff-dot-active");
    $(`.ns-diff-dot[data-step="${stepIndex}"]`).addClass("ns-diff-dot-active");

    // Update step caption text — append pass name annotation when available
    const caption = getStepCaption(stepIndex);
    const passName = stepIndex > 0 && step.passName ? step.passName : null;
    if (passName) {
        $("#nightshift_diff_step_label").html(`${caption} <span class="ns-diff-step-name">(${escapeHtml(passName)})</span>`);
    } else {
        $("#nightshift_diff_step_label").text(caption);
    }

    // Update arrow disabled state
    $("#nightshift_diff_prev").prop("disabled", stepIndex === 0);
    $("#nightshift_diff_next").prop("disabled", stepIndex === _steps.length - 1);
}

function renderNavigation() {
    const stepsBar = $("#nightshift_diff_steps");
    const dotsContainer = $("#nightshift_diff_dots");
    dotsContainer.empty();

    // Navigation only makes sense with 3+ steps (i.e., 2+ passes producing distinct diffs)
    if (!_steps || _steps.length < 3) {
        stepsBar.hide();
        return;
    }

    for (let i = 0; i < _steps.length; i++) {
        dotsContainer.append(
            $(`<button class="ns-diff-dot" data-step="${i}" title="${getStepCaption(i)}"></button>`)
        );
    }

    stepsBar.show();
}

export function showDiffModal(originalText, transformedText, onAccept, onReject = null, passSnapshots = null, passNames = null) {
    _acceptCallback = onAccept;
    _rejectCallback = onReject;
    _currentStep = 0;

    // Build navigation steps when 2+ passes are present
    _steps = (passSnapshots && passSnapshots.length >= 3) ? buildSteps(passSnapshots, passNames) : null;

    // Store original text and pre-fill textarea
    $("#nightshift_diff_modal").data("original", originalText);
    $("#nightshift_diff_transformed").val(transformedText);

    if (_steps) {
        renderNavigation();
        renderStep(0);
    } else {
        // Classic single-view mode
        const { oldHtml, newHtml } = computeWordDiff(originalText, transformedText);
        $("#nightshift_diff_original_view").html(oldHtml);
        $("#nightshift_diff_transformed_view").html(newHtml);

        // Reset panel labels to defaults
        $(".ns-diff-original-header .ns-diff-panel-label").text("Original");
        $(".ns-diff-transformed-header .ns-diff-panel-label").text("Transformed");

        if (extension_settings["NIGHTSHIFT"] && extension_settings["NIGHTSHIFT"].disable_editable_diff) {
            $("#nightshift_diff_transformed").hide();
            $("#nightshift_diff_transformed_view").css({ "height": "100%", "flex": "1 1 auto" });
            $(".ns-diff-edit-hint").hide();
        } else {
            $("#nightshift_diff_transformed").show();
            $("#nightshift_diff_transformed_view").css({ "height": "", "flex": "" });
            $(".ns-diff-edit-hint").show();
        }

        $("#nightshift_diff_steps").hide();
    }

    $("#nightshift_diff_backdrop").fadeIn(200);
    $("#nightshift_diff_modal").fadeIn(220);
}

export function hideDiffModal(isReject = false) {
    if (isReject && typeof _rejectCallback === "function") {
        _rejectCallback();
    }
    _steps = null;
    _currentStep = 0;
    $("#nightshift_diff_backdrop").fadeOut(180);
    $("#nightshift_diff_modal").fadeOut(200);
}

export function initDiffViewer() {
    $("#nightshift_diff_accept").on("click", () => {
        const text = $("#nightshift_diff_transformed").val();
        if (typeof _acceptCallback === "function") _acceptCallback(text);
        hideDiffModal(false);
    });

    $("#nightshift_diff_reject, #nightshift_diff_close").on("click", () => hideDiffModal(true));

    $("#nightshift_diff_backdrop").on("click", () => hideDiffModal(true));

    // Live diff — recompute highlights as the user edits the transformed textarea
    $("#nightshift_diff_transformed").on("input", function () {
        if (_steps) {
            // Only update when on step 0 (textarea is hidden on other steps anyway)
            if (_currentStep === 0) {
                const { oldHtml, newHtml } = computeWordDiff(_steps[0].oldText, $(this).val());
                $("#nightshift_diff_original_view").html(oldHtml);
                $("#nightshift_diff_transformed_view").html(newHtml);
            }
        } else {
            const rawOriginal = $("#nightshift_diff_modal").data("original") || "";
            const { oldHtml, newHtml } = computeWordDiff(rawOriginal, $(this).val());
            $("#nightshift_diff_original_view").html(oldHtml);
            $("#nightshift_diff_transformed_view").html(newHtml);
        }
    });

    // Step navigation — prev/next arrows
    $("#nightshift_diff_prev").on("click", () => {
        if (_steps && _currentStep > 0) renderStep(_currentStep - 1);
    });

    $("#nightshift_diff_next").on("click", () => {
        if (_steps && _currentStep < _steps.length - 1) renderStep(_currentStep + 1);
    });

    // Step navigation — dot clicks (delegated since dots are dynamic)
    $(document).on("click", "#nightshift_diff_dots .ns-diff-dot", function () {
        if (_steps) renderStep(parseInt($(this).data("step"), 10));
    });
}

// Reopen Diff helpers
export function updateNIGHTSHIFTData(mesId, newText) {
    const msg = getST().chat[mesId];
    if (msg && msg.extra?.nightshift) {
        msg.extra.nightshift.transformed = newText;
        getST().saveChat();
    }
}

export function storeNIGHTSHIFTData(mesId, originalText, transformedText, snapshots, passNames) {
    const msg = getST().chat[mesId];
    if (!msg) return;
    if (!msg.extra) msg.extra = {};
    msg.extra.nightshift = {
        original: originalText,
        transformed: transformedText,
        snapshots: snapshots ? [...snapshots] : [],
        passNames: passNames ? [...passNames] : []
    };
    getST().saveChat();
    showReopenDiffButton(mesId);
}

export function showReopenDiffButton(mesId) {
    const btn = $(`#chat .mes[mesid="${mesId}"] .nightshift-reopen-diff-btn`);
    if (btn.length) btn.show();
}

export function reopenDiffForMessage(mesId) {
    const msg = getST().chat[mesId];
    if (!msg || !msg.extra?.nightshift) return;

    const data = msg.extra.nightshift;
    showDiffModal(data.original, data.transformed, (newText) => {
        updateNIGHTSHIFTData(mesId, newText);
        const msg = getST().chat[mesId];
        if (msg) {
            msg.mes = newText;
            safeUpdateMessageText(mesId, msg);
            getST().saveChat();
        }
    }, () => {
        const msg = getST().chat[mesId];
        if (msg) {
            msg.mes = data.original;
            safeUpdateMessageText(mesId, msg);
            getST().saveChat();
        }
    }, data.snapshots, data.passNames);
}

export function injectReopenDiffButton() {
    const html = `<div title="View Diff / Revert" class="mes_button nightshift-reopen-diff-btn interactable fa-solid fa-rotate-left" tabindex="0" style="display:none;"></div>`;
    $("#message_template .mes_buttons .extraMesButtons").prepend(html);

    $("#chat .mes .extraMesButtons").each(function() {
        if ($(this).find(".nightshift-reopen-diff-btn").length === 0) {
            $(this).prepend(html);
        }
    });
}

export function updateReopenDiffButtons() {
    const st = getST();
    $("#chat .mes").each(function() {
        const mesId = parseInt($(this).attr('mesid'), 10);
        const msg = st.chat[mesId];
        if (msg?.extra?.nightshift) {
            $(this).find(".nightshift-reopen-diff-btn").show();
        }
    });
}