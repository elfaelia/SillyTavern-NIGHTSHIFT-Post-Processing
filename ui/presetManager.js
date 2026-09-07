/*
Rework of the preset system, pass all functions related to presets to presetManager, the saving disc function now shall automatically save to the currently selected preset.
The load button will not be the button to open a preset management page, offering option to add default presets back, new presets, rename, delete and reaarange them, the UI should be good looking, simple and blend well together, as compact as possible.
*/

import { extension_settings, getContext } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { defaultPresets } from "../settings/defaultPresets.js";

export const extensionName = "NIGHTSHIFT";

// Provide dependencies from index.js
let addPassToUIFn = null;
let saveSettingsFn = null;
let refreshMacrosFn = null;

export const presetManager = {
    init: function(addPassFn, saveFn, refreshFn = null) {
        addPassToUIFn = addPassFn;
        saveSettingsFn = saveFn;
        refreshMacrosFn = typeof refreshFn === "function" ? refreshFn : null;

        // Save Button (Overrides current preset silently)
        $("#nightshift_save_preset").off("click").on("click", () => {
            this.saveActivePreset();
            toastr.success(`Preset "${extension_settings[extensionName].active_preset}" saved.`);
        });

        // Load Button (Opens Manager Modal)
        $("#nightshift_load_preset").off("click").on("click", () => {
            this.openManagerModal();
        });

        // Dropdown selection
        $("#nightshift_preset_select").off("change").on("change", (e) => {
            extension_settings[extensionName].active_preset = $(e.target).val();
            this.loadActivePreset();
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
        });

        // Setup modal events
        this.initModalEvents();
    },

    getActivePresetIndex: function() {
        if (!extension_settings[extensionName]?.presets) return -1;
        return extension_settings[extensionName].presets.findIndex(p => p.name === extension_settings[extensionName].active_preset);
    },

    saveActivePreset: function() {
        const idx = this.getActivePresetIndex();
        if (idx === -1) return;
        
        const passes = [];
        // The pass editor popup temporarily parks one pass's fields inside the modal —
        // extend the search scope to the modal for that pass so saving still sees them
        const editorModal = $("#nightshift_pass_editor_modal");
        const editorPassId = editorModal.is(":visible") ? editorModal.data("host-ns-pass-id") : null;
        $("#nightshift_pass_list .nightshift-pass-item").each(function() {
            const item = $(this);
            const scope = editorPassId && item.data("id") === editorPassId ? item.add(editorModal) : item;
            passes.push({
                id: item.data("id"),
                name: scope.find(".ns-pass-name").val(),
                enabled: scope.find(".ns-pass-enabled").prop("checked"),
                contextLength: parseInt(scope.find(".ns-pass-context-length").val(), 10),
                prompt: scope.find(".ns-pass-prompt").val(),
                prefill: scope.find(".ns-pass-prefill").val() || "",
                prefillRole: scope.find(".ns-pass-prefill-role").val() || "assistant",
                category: scope.find(".ns-pass-category").val() || "custom",
                connection: scope.find(".ns-pass-connection").val(),
                injectWorldInfo: scope.find(".ns-pass-inject-world-info").prop("checked"),
                injectWIOutlets: scope.find(".ns-pass-inject-wi-outlets").prop("checked"),
                includeCharCard: scope.find(".ns-pass-include-char-card").prop("checked"),
                includeSceneContext: scope.find(".ns-pass-include-scene-context").prop("checked")
            });
        });
        
        extension_settings[extensionName].presets[idx].passes = passes;
        if (refreshMacrosFn) refreshMacrosFn();
        saveSettingsDebounced();
    },

    populatePresetDropdown: function() {
        const select = $("#nightshift_preset_select");
        select.empty();
        if (extension_settings[extensionName]?.presets) {
            extension_settings[extensionName].presets.forEach(p => {
                select.append($("<option></option>").val(p.name).text(p.name));
            });
        }
        select.val(extension_settings[extensionName].active_preset);
    },

    loadActivePreset: function() {
        const idx = this.getActivePresetIndex();
        if (idx === -1) return;
        
        const preset = extension_settings[extensionName].presets[idx];
        const list = $("#nightshift_pass_list");

        // Close the pass editor first so its parked fields return before the list is rebuilt
        if ($("#nightshift_pass_editor_modal").is(":visible")) $("#ns_pe_close").trigger("click");

        list.empty();
        
        if (preset && preset.passes && addPassToUIFn) {
            preset.passes.forEach(pass => {
                addPassToUIFn(pass);
            });
        }
        if (refreshMacrosFn) refreshMacrosFn();
    },

    // --- Modal Management ---

    initModalEvents: function() {
        // Intercept backdrop clicks at document capture phase (only when preset manager
        // is open), so they never reach diffViewer's fadeOut handler or ST's
        // drawer-close handler. Targets only the backdrop itself, not the modal.
        document.addEventListener("click", (e) => {
            if ($("#nightshift_preset_manager_modal").is(":visible") &&
                e.target === document.getElementById("nightshift_diff_backdrop")) {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);

        // Stop clicks inside the modal from bubbling to ST's drawer-close handler.
        $("#nightshift_preset_manager_modal").on("click", (e) => {
            e.stopPropagation();
        });

        // Modal buttons
        $("#nightshift_preset_manager_close").on("click", () => {
            $("#nightshift_preset_manager_modal, #nightshift_diff_backdrop").hide();
            this.populatePresetDropdown();
            this.loadActivePreset();
        });

        $("#nightshift_pm_add").on("click", async () => {
            const st = getContext();
            const name = await st.Popup.show.input("Enter name for the new preset:", "");
            if (!name) return;

            if (extension_settings[extensionName].presets.find(p => p.name === name)) {
                toastr.warning("Preset already exists!");
                return;
            }

            extension_settings[extensionName].presets.push({ name: name, passes: [] });
            extension_settings[extensionName].active_preset = name;
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
            this.renderManagerList();
        });

        $("#nightshift_pm_restore").on("click", async () => {
            const st = getContext();
            const confirm = await st.Popup.show.confirm("Restore Default Presets", "If a existing preset is named 'Default Preset' it will be overwritten. Proceed?");
            if (!confirm) return;

            defaultPresets.forEach(dp => {
                const existingIdx = extension_settings[extensionName].presets.findIndex(p => p.name === dp.name);
                if (existingIdx !== -1) {
                    extension_settings[extensionName].presets[existingIdx] = JSON.parse(JSON.stringify(dp));
                } else {
                    extension_settings[extensionName].presets.push(JSON.parse(JSON.stringify(dp)));
                }
            });
            
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
            this.renderManagerList();
            toastr.success("Default presets restored.");
        });

        // Setup sortable list for rearrange
        $("#nightshift_pm_list").sortable({
            handle: ".ns-pm-drag",
            update: () => {
                this.saveManagerOrder();
            }
        });

        // Delegate events for list items (rename/delete)
        $("#nightshift_pm_list").on("click", ".ns-pm-delete", async (e) => {
            const name = $(e.currentTarget).closest(".ns-pm-item").data("name");
            const st = getContext();
            const confirm = await st.Popup.show.confirm("Delete Preset", `Are you sure you want to delete "${name}"?`);
            if (!confirm) return;

            extension_settings[extensionName].presets = extension_settings[extensionName].presets.filter(p => p.name !== name);
            if (extension_settings[extensionName].active_preset === name) {
                extension_settings[extensionName].active_preset = extension_settings[extensionName].presets[0]?.name || "";
            }
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
            this.renderManagerList();
        });

        $("#nightshift_pm_list").on("click", ".ns-pm-rename", async (e) => {
            const item = $(e.currentTarget).closest(".ns-pm-item");
            const oldName = item.data("name");
            const st = getContext();
            const newName = await st.Popup.show.input(`Rename "${oldName}":`, "", oldName);
            
            if (!newName || newName === oldName) return;
            if (extension_settings[extensionName].presets.find(p => p.name === newName)) {
                toastr.warning("A preset with this name already exists.");
                return;
            }

            const preset = extension_settings[extensionName].presets.find(p => p.name === oldName);
            if (preset) {
                preset.name = newName;
                if (extension_settings[extensionName].active_preset === oldName) {
                    extension_settings[extensionName].active_preset = newName;
                }
                if (refreshMacrosFn) refreshMacrosFn();
                saveSettingsDebounced();
                this.renderManagerList();
            }
        });
    },

    openManagerModal: function() {
        this.renderManagerList();
        $("#nightshift_diff_backdrop").show(); // Reusing the backdrop
        $("#nightshift_preset_manager_modal").css("display", "flex");
    },

    renderManagerList: function() {
        const list = $("#nightshift_pm_list");
        list.empty();
        
        extension_settings[extensionName].presets.forEach(p => {
            const isActive = p.name === extension_settings[extensionName].active_preset;
            const activeTag = isActive ? `<span class="ns-pm-active-tag">Active</span>` : "";
            const itemHtml = `
                <div class="ns-pm-item" data-name="${p.name}">
                    <div class="ns-pm-drag fa-solid fa-grip-vertical"></div>
                    <div class="ns-pm-name">${p.name} ${activeTag}</div>
                    <div class="ns-pm-actions">
                        <button class="menu_button ns-pm-rename fa-solid fa-pen" title="Rename"></button>
                        <button class="menu_button red_button ns-pm-delete fa-solid fa-trash" title="Delete"></button>
                    </div>
                </div>
            `;
            list.append(itemHtml);
        });
    },

    saveManagerOrder: function() {
        const newOrder = [];
        $("#nightshift_pm_list .ns-pm-item").each(function() {
            const name = $(this).data("name");
            const preset = extension_settings[extensionName].presets.find(p => p.name === name);
            if (preset) newOrder.push(preset);
        });
        extension_settings[extensionName].presets = newOrder;
        saveSettingsDebounced();
    }
};
