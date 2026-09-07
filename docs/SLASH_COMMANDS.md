# NIGHTSHIFT | Slash Commands Documentation

This document outlines the available slash commands provided by `util/slashCommands.js` for the **NIGHTSHIFT** SillyTavern extension. These commands allow you to trigger, configure, and automate the post-processing pipeline directly from the chat box or via ST-scripts.
If your setup requires a specific interaction or change, please feel free to ask about it on the Discord. I will add it for you.

---

## Available Macros

NIGHTSHIFT registers the following macros with SillyTavern, allowing you to access pipeline output in other extensions or prompts:

- `{{nightshift_latest}}`: Contains the full text output from the last completed pipeline run.
- `{{nightshift_<pass_id>}}`: Contains the output of a specific pass from the last pipeline run (e.g., `{{nightshift_pass_12345}}`).
- `{{nightshift_original}}`: Contains the original AI message before pass 1.

You can also use macros and outlets inside Pass Prompts.

---

## Available Commands

### `/ns-run`
**Aliases:** `/nightshift-run`  
**Description:** Runs the NIGHTSHIFT pipeline on a specific message.
- **Arguments:**
  - `mesId` *(Number, Optional)*: The ID of the AI message you want to process.
- **Usage:**
  - `/ns-run` - Runs the pipeline on the very last message in the chat.
  - `/ns-run 5` - Runs the pipeline on the AI message with the ID of 5.

---

### `/ns-runbulk`
**Aliases:** `/nightshift-runbulk`  
**Description:** Runs the NIGHTSHIFT pipeline sequentially on a range of messages in the background.
- **Arguments:**
  - `range` *(String, Required)*: The range of message IDs to process (e.g., `5-10`).
  - `waitTime` *(Number, Optional)*: Wait time between processing each message, in seconds. Defaults to `1`.
- **Usage:**
  - `/ns-runbulk 5-10` - Processes messages 5 through 10 with a 1-second delay between each.
  - `/ns-runbulk 5-10 2.5` - Processes the same range but waits 2.5 seconds between each request.

---

### `/ns-toggle`
**Aliases:** `/nightshift-toggle`  
**Description:** Enables or disables the NIGHTSHIFT extension globally.
- **Arguments:**
  - `state` *(Boolean, Optional)*: The state to set (`true` or `false`).
- **Usage:**
  - `/ns-toggle` - Toggles the current state (if on, turns off; if off, turns on).
  - `/ns-toggle true` - Explicitly enables NIGHTSHIFT.
  - `/ns-toggle false` - Explicitly disables NIGHTSHIFT.

---

### `/ns-difftoggle`
**Aliases:** `/nightshift-difftoggle`  
**Description:** Toggles the NIGHTSHIFT Diff Viewer setting (also known as inline replacement).
- **Arguments:**
  - `state` *(Boolean, Optional)*: The state to set (`true` or `false`).
- **Usage:**
  - `/ns-difftoggle` - Toggles the current setting.
  - `/ns-difftoggle true` - Enables inline replacement (bypasses the Diff Viewer).
  - `/ns-difftoggle false` - Disables inline replacement (shows the Diff Viewer).

---

### `/ns-customrun`
**Aliases:** `/nightshift-customrun`  
**Description:** Runs a custom set of passes on a specific message without permanently changing your active preset. Useful for complex scripting workflows.
- **Arguments:**
  - `mesId` *(Number, Optional)*: The message ID to process. Defaults to the last message if omitted.
  - `passes` *(String, Required)*: A 1-based index list of passes to run, formatted inside curly braces.
- **Usage:**
  - `/ns-customrun passes={1, 3}` - Runs only Pass 1 and Pass 3 on the last message.
  - `/ns-customrun mesId=5 passes={2}` - Runs only Pass 2 on message ID 5.

---

### `/ns-profile`
**Aliases:** `/nightshift-profile`  
**Description:** Switches the currently active NIGHTSHIFT profile/preset, or returns the current profile name if no argument is provided.
- **Arguments:**
  - `profileName` *(String, Optional)*: The exact name of the profile to switch to.
- **Usage:**
  - `/ns-profile` - Shows the name of the currently active profile.
  - `/ns-profile "My Custom Preset"` - Switches the active preset to "My Custom Preset".
