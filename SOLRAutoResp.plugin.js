/**
 * @name AutoResponder
 * @version 1.7.1
 * @description Auto-responds to specified users with customizable messages after a customizable delay. Now with a multi-purpose button and auto-update check.
 */

const config = {
    info: {
        name: "AutoResponder",
        authors: [
            {
                name: "SOLR",
                discord_id: "1016550533995167744",
                github_username: "SOLRxWRLD",
            }
        ],
        version: "1.7.1",
        description: "Auto-responds to specified users with customizable messages after a customizable delay. Now with a multi-purpose button and auto-update check.",
        github_raw: "https://raw.githubusercontent.com/SOLRxWRLD/AutoResponder/main/AutoResponder.plugin.js"
    },
    defaultConfig: [
        {
            type: "textbox",
            id: "targetUserID1",
            name: "Target User ID 1",
            note: "The ID of the first user to respond to.",
            value: ""
        },
        {
            type: "textbox",
            id: "targetUserID2",
            name: "Target User ID 2",
            note: "The ID of the second user to respond to.",
            value: ""
        },
        {
            type: "textbox",
            id: "targetUserID3",
            name: "Target User ID 3",
            note: "The ID of the third user to respond to.",
            value: ""
        },
        {
            type: "textbox",
            id: "targetUserID4",
            name: "Target User ID 4",
            note: "The ID of the fourth user to respond to.",
            value: "",
            hidden: true
        },
        {
            type: "textbox",
            id: "targetUserID5",
            name: "Target User ID 5",
            note: "The ID of the fifth user to respond to.",
            value: "",
            hidden: true
        },
        {
            type: "button",
            id: "addUserID",
            name: "Add another User ID",
            note: "Add an additional User ID field (up to 5).",
            buttonText: "+",
            onClick: (config) => {
                const hiddenFields = config.filter(c => c.hidden);
                if (hiddenFields.length > 0) hiddenFields[0].hidden = false;
            }
        },
        {
            type: "textbox",
            id: "responseMessages",
            name: "Response Messages (Separated by commas)",
            note: "List of messages to send in order.",
            value: "Hello! This is an auto-response."
        },
        {
            type: "slider",
            id: "responseDelay",
            name: "Response Delay (seconds)",
            note: "The delay before sending each response message.",
            value: 5,
            min: 1,
            max: 60,
            markers: [1, 10, 20, 30, 40, 50, 60],
            stickToMarkers: true
        },
        {
            type: "slider",
            id: "messageLimit",
            name: "Message Limit",
            note: "The maximum number of responses in a given period.",
            value: 5,
            min: 1,
            max: 20,
            markers: [1, 5, 10, 15, 20],
            stickToMarkers: true
        }
    ],
    changelog: [
        {
            title: "Initial Release",
            type: "added",
            items: ["The first release of AutoResponder."]
        },
        {
            title: "Version 1.7.1",
            type: "added",
            items: ["Added multi-purpose button in message bar for enabling/disabling auto-responder and opening settings.", "Added auto-update check feature."]
        }
    ]
};

module.exports = !global.ZeresPluginLibrary ? class {
    constructor() { this._config = config; }
    getName() { return config.info.name; }
    getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
    getDescription() { return config.info.description; }
    getVersion() { return config.info.version; }
    load() { BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
        confirmText: "Download Now",
        cancelText: "Cancel",
        onConfirm: () => {
            require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, () => { BdApi.Plugins.reload(config.info.name); });
            });
        }
    }); }
    start() { }
    stop() { }
} : (([Plugin, Library]) => {
    const { WebpackModules, Patcher, DiscordModules, PluginUpdater } = Library;
    const { MessageActions } = DiscordModules;

    class AutoResponder extends Plugin {
        constructor() {
            super();
            this.messageCount = 0;
            this.resetMessageCount = this.resetMessageCount.bind(this);
            this.isActive = true; // Kill switch state
        }

        resetMessageCount() {
            this.messageCount = 0;
        }

        toggleResponder() {
            this.isActive = !this.isActive;
            BdApi.showToast(`AutoResponder ${this.isActive ? "enabled" : "disabled"}!`);
        }

        injectButton() {
            const button = document.createElement("button");
            button.innerText = "AutoResponder";
            button.style.marginLeft = "10px";
            button.style.padding = "5px";
            button.style.borderRadius = "5px";
            button.style.backgroundColor = "#7289da";
            button.style.color = "white";
            button.style.border = "none";
            button.style.cursor = "pointer";
            button.onmousedown = (event) => {
                if (event.button === 0) {
                    this.showSettingsModal();
                } else if (event.button === 2) {
                    this.toggleResponder();
                    event.preventDefault();
                }
            };
            const observer = new MutationObserver(() => {
                const messageBar = document.querySelector("[data-slate-editor]");
                if (messageBar && !document.querySelector("#autoResponderButton")) {
                    messageBar.parentNode.appendChild(button);
                    button.id = "autoResponderButton";
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }

        showSettingsModal() {
            const settingsPanel = this.buildSettingsPanel();
            const modal = BdApi.showConfirmationModal("AutoResponder Settings", settingsPanel.getElement(), {
                confirmText: "Save",
                cancelText: "Cancel",
                onConfirm: () => this.saveSettings(settingsPanel.props.children)
            });
        }

        checkForUpdates() {
            PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.github_raw);
        }

        onStart() {
            const MessageStore = WebpackModules.getByProps("sendMessage");
            Patcher.after(MessageStore, "sendMessage", (thisObject, methodArguments, returnValue) => {
                if (!this.isActive) return;

                const message = methodArguments[1];
                const { targetUserID1, targetUserID2, targetUserID3, targetUserID4, targetUserID5, responseMessages, responseDelay, messageLimit } = this.settings;

                const targetUserIDs = [targetUserID1, targetUserID2, targetUserID3, targetUserID4, targetUserID5].filter(id => id);

                if (targetUserIDs.includes(message.author.id)) {
                    if (this.messageCount < messageLimit) {
                        const messages = responseMessages.split(",").map(m => m.trim());
                        if (this.messageCount < messages.length) {
                            const currentMessage = messages[this.messageCount % messages.length];
                            this.messageCount++;
                            setTimeout(() => {
                                MessageActions.sendMessage(message.channel_id, {
                                    content: currentMessage,
                                    tts: false,
                                    nonce: message.id
                                });
                            }, responseDelay * 1000);
                        }
                    }
                }
            });

            this.injectButton();
            this.checkForUpdates();

            BdApi.showToast("AutoResponder started!");
        }

        onStop() {
            Patcher.unpatchAll();
            BdApi.showToast("AutoResponder stopped!");
        }

        getSettingsPanel() {
            const panel = this.buildSettingsPanel();
            return panel.getElement();
        }
    }

    return AutoResponder;
})(global.ZeresPluginLibrary.buildPlugin(config));
