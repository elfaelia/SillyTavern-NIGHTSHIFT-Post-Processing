import { extension_settings } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { defaultPresets } from "./defaultPresets.js";
import { createLibraryPass, passLibrary } from "./passLibrary.js";
import { presetManager } from "../ui/presetManager.js";
import { extensionName } from "../index.js";

const BUNDLED_PROMPT_REVISION = 4;

const bundledPassKeys = {
    pass_grounding: 'grounding',
    pass_validator: 'character',
    pass_prose: 'prose',
    pass_repetitionhammer: 'repetition',
    utility_grounding: 'grounding',
    utility_character: 'character',
    utility_prose: 'prose',
    utility_continuity: 'continuity',
    utility_repetition: 'repetition',
    character_markJefferson: 'markJefferson',
    character_easterman: 'easterman',
    style_dramatic: 'dramatic',
    style_dark: 'dark',
    style_horror: 'horror',
    style_darkRomance: 'darkRomance',
    style_satire: 'satire',
    style_romance: 'romance',
    style_action: 'action',
    style_gore: 'gore',
    style_noir: 'noir',
    style_explicit: 'explicit'
};

function migrateBundledPrompts(settings, previousRevision) {
    if (previousRevision >= BUNDLED_PROMPT_REVISION) return false;

    for (const preset of settings.presets || []) {
        for (const pass of preset.passes || []) {
            const libraryKey = bundledPassKeys[pass.id] || findLibraryKeyByName(pass.name);
            if (!libraryKey) continue;
            const current = createLibraryPass(libraryKey);
            if (!current) continue;
            pass.prompt = current.prompt;
            pass.category = current.category;
        }
    }

    // Add new bundled sections without replacing the user's presets or settings.
    for (const bundledPreset of defaultPresets) {
        const existingPreset = settings.presets.find(preset => preset.name === bundledPreset.name);
        if (!existingPreset) {
            settings.presets.push(structuredClone(bundledPreset));
            continue;
        }

        // New bundled passes appear in an existing toolkit without touching its other passes.
        if (bundledPreset.name === 'Character Filters') {
            for (const bundledPass of bundledPreset.passes) {
                if (!existingPreset.passes.some(pass => pass.id === bundledPass.id)) {
                    existingPreset.passes.push(structuredClone(bundledPass));
                }
            }
        }
    }

    settings.bundled_prompt_revision = BUNDLED_PROMPT_REVISION;
    return true;
}

function findLibraryKeyByName(name) {
    if (!name) return null;
    for (const group of passLibrary) {
        for (const [key, template] of Object.entries(group.items)) {
            if (template.name === name) return key;
        }
    }
    return null;
}

export const defaultSettings = {
    enabled: true,
    autorun: true, // Runs on gen
    inject: true, // Should edit messages with new content
    replace_inline: false, // AKA Disable Diff Viewer
    hide_until_last: true, // Skips all message edit and hides the message until pipeline is about to end
    dynamic_substitution: false, // Gradually replace words from the previous pass while streaming instead of hiding or showing raw chunks
    stream_pipeline: true, // Streaming, has to have default sillystreaming enabled too
    debug_mode: false,
    disable_editable_diff: true, // Disables the edit field in the diff viewer
    legacy_api: false, // Swaps profiles and waits for them before doing the request, useful for fixing some issues with root ST code
    compatibility_mode: false, // Enables compatibility fixes for other extensions
    scene_context_as_roles: false,
    protect_structured_content: true, // Byte-for-byte protection for macros, tagged blocks and code fences
    bundled_prompt_revision: BUNDLED_PROMPT_REVISION,
    
    apply_regexes: true, // Applies ST regex scripts to the pipeline output (assistant placement, depth 0 or N/A only)
    apply_regex_context: true, // Applies ST regex scripts to each context message individually (per-message depth and role placement)
    min_chars: 60, // Skips if there's not enough characters. Useful for preventing rejections or shortcomings from triggering pipeline
    
    presets: defaultPresets,
    active_preset: "Default Preset"
};

export function initSettingsListeners() {
    $("#nightshift_enabled, #nightshift_autorun, #nightshift_inject, #nightshift_replace_inline, #nightshift_hide_until_last, #nightshift_dynamic_substitution, #nightshift_stream_pipeline, #nightshift_debug_mode, #nightshift_disable_editable_diff, #nightshift_apply_regex_context, #nightshift_apply_regexes, #nightshift_legacy_api, #nightshift_compatibility, #nightshift_scene_context_as_roles, #nightshift_protect_structured_content").on("change", saveSettings);
    $("#nightshift_min_chars").on("input change", saveSettings);

    // Compatibility warn
    $("#nightshift_compatibility").on("change", function() {
        if (typeof toastr !== "undefined") {
            toastr.info("Please reload the page for compatibility mode changes to take full effect.", "NIGHTSHIFT Note", { timeOut: 10000 });
        }
    });
}

export async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], structuredClone(defaultSettings));
    }

    const previousBundledPromptRevision = Number(extension_settings[extensionName].bundled_prompt_revision || 0);

    // Fill in defaults for settings added after the user's first load
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!(key in extension_settings[extensionName])) {
            extension_settings[extensionName][key] = structuredClone(value);
        }
    }

    if (migrateBundledPrompts(extension_settings[extensionName], previousBundledPromptRevision)) {
        saveSettingsDebounced();
    }

    $("#nightshift_enabled").prop("checked", extension_settings[extensionName].enabled);
    $("#nightshift_autorun").prop("checked", extension_settings[extensionName].autorun);
    $("#nightshift_inject").prop("checked", extension_settings[extensionName].inject);
    $("#nightshift_replace_inline").prop("checked", extension_settings[extensionName].replace_inline);
    $("#nightshift_hide_until_last").prop("checked", extension_settings[extensionName].hide_until_last);
    $("#nightshift_dynamic_substitution").prop("checked", extension_settings[extensionName].dynamic_substitution);
    $("#nightshift_stream_pipeline").prop("checked", extension_settings[extensionName].stream_pipeline);
    $("#nightshift_debug_mode").prop("checked", extension_settings[extensionName].debug_mode);
    $("#nightshift_disable_editable_diff").prop("checked", extension_settings[extensionName].disable_editable_diff);
    $("#nightshift_apply_regex_context").prop("checked", extension_settings[extensionName].apply_regex_context);
    $("#nightshift_apply_regexes").prop("checked", extension_settings[extensionName].apply_regexes);
    $("#nightshift_legacy_api").prop("checked", extension_settings[extensionName].legacy_api);
    $("#nightshift_compatibility").prop("checked", extension_settings[extensionName].compatibility_mode);
    $("#nightshift_scene_context_as_roles").prop("checked", extension_settings[extensionName].scene_context_as_roles);
    $("#nightshift_protect_structured_content").prop("checked", extension_settings[extensionName].protect_structured_content !== false);
    $("#nightshift_min_chars").val(extension_settings[extensionName].min_chars ?? 0);

    presetManager.populatePresetDropdown();
    presetManager.loadActivePreset();
}

export function saveSettings() {
    extension_settings[extensionName].enabled = $("#nightshift_enabled").prop("checked");
    extension_settings[extensionName].autorun = $("#nightshift_autorun").prop("checked");
    extension_settings[extensionName].inject = $("#nightshift_inject").prop("checked");
    extension_settings[extensionName].replace_inline = $("#nightshift_replace_inline").prop("checked");
    extension_settings[extensionName].hide_until_last = $("#nightshift_hide_until_last").prop("checked");
    extension_settings[extensionName].dynamic_substitution = $("#nightshift_dynamic_substitution").prop("checked");
    extension_settings[extensionName].stream_pipeline = $("#nightshift_stream_pipeline").prop("checked");
    extension_settings[extensionName].debug_mode = $("#nightshift_debug_mode").prop("checked");
    extension_settings[extensionName].disable_editable_diff = $("#nightshift_disable_editable_diff").prop("checked");
    extension_settings[extensionName].apply_regex_context = $("#nightshift_apply_regex_context").prop("checked");
    extension_settings[extensionName].apply_regexes = $("#nightshift_apply_regexes").prop("checked");
    extension_settings[extensionName].legacy_api = $("#nightshift_legacy_api").prop("checked");
    extension_settings[extensionName].compatibility_mode = $("#nightshift_compatibility").prop("checked");
    extension_settings[extensionName].scene_context_as_roles = $("#nightshift_scene_context_as_roles").prop("checked");
    extension_settings[extensionName].protect_structured_content = $("#nightshift_protect_structured_content").prop("checked");
    extension_settings[extensionName].min_chars = parseInt($("#nightshift_min_chars").val(), 10) || 0;
    
    presetManager.saveActivePreset();
    saveSettingsDebounced();
}
