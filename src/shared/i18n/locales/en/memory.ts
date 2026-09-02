export default {
  title: "Memory",
  subtitle:
    "What Hermes remembers about you and your environment across sessions.",
  sessions: "Sessions",
  messages: "Messages",
  memories: "Memories",
  providersTitle: "Providers",
  agentMemory: "Agent Memory",
  userProfile: "User Profile",
  entries: "{{count}} entries",
  addMemory: "Add Memory",
  loadFailed: "Failed to load memory",
  addFailed: "Failed to add entry",
  updateFailed: "Failed to update entry",
  saveFailed: "Failed to save",
  entriesPlaceholder:
    "e.g. User prefers TypeScript over JavaScript. Always use strict mode.",
  userProfilePlaceholder:
    "e.g. Name: Alex. Senior developer. Prefers concise answers. Uses macOS with zsh. Timezone: PST.",
  noProvidersFound: "No memory providers found in this installation.",
  openProviderWebsite: "Open provider website",
  noMemoriesYet:
    "No memories yet. Hermes will save important facts as you chat.",
  noMemoryEntries: "No memory entries yet.",
  noToolsetsFound: "No toolsets found.",
  addManuallyHint: "You can also add memories manually using the button above.",
  userProfileHint:
    "Tell Hermes about yourself — name, role, preferences, communication style.",
  providersHint:
    "Pluggable memory providers give Hermes advanced long-term memory. Built-in memory (above) is always active alongside the selected provider.",
  providersHintActive: "Active: <strong>{{provider}}</strong>",
  providersHintInactive: "No external provider active — using built-in only.",
  enterEnvKey: "Enter {{key}}",
  chars: "{{count}} chars",
  cancel: "Cancel",
  save: "Save",
  edit: "Edit",
  deleteConfirm: "Delete?",
  yes: "Yes",
  no: "No",
  saveProfile: "Save Profile",
  active: "Active",
  deactivate: "Deactivate",
  activating: "Activating...",
  activate: "Activate",
  sessionsUnavailable: "No sessions recorded yet",
  providerBuiltIn: "Built-in only",
  vaultNotLinked: "Not linked",
  systemsTitle: "Memory systems",
  editable: "Editable",
  readOnly: "Read-only",
  configurable: "Configurable",
  atCapacity: "At capacity — the agent consolidates on the next write",
  nextSessionNote: "Takes effect in this agent's next session.",
  sessionSearch: "Session Search",
  sessionSearchDesc:
    "Every past conversation, searchable. Written automatically by the agent.",
  sessionSearchHint: "Search past conversations from the Sessions screen.",
  agentMemoryDesc: "Curated notes the agent keeps about your environment.",
  userProfileDesc: "Who you are — name, role, preferences.",
  providerDesc:
    "An external memory backend, running alongside built-in memory.",
  providerNotInstalled: "not installed",
  sessionsAndMessages: "{{sessions}} sessions · {{messages}} messages",
  lastActive: "active {{when}}",
  vaultTitle: "Obsidian Vault",
  vaultDesc:
    "A notes folder the agent reads and writes through its Obsidian skill.",
  vaultHint:
    "Choose the folder of an Obsidian vault. The agent's note-taking skill will read, search and edit notes there.",
  vaultLinked: "Vault linked",
  vaultMissing: "folder not found",
  vaultChoose: "Choose folder…",
  vaultClear: "Unlink",
  providers: {
    honcho:
      "AI-native cross-session user modeling with dialectic Q&A and semantic search",
    hindsight:
      "Long-term memory with knowledge graph and multi-strategy retrieval",
    mem0: "Server-side LLM fact extraction with semantic search and auto-deduplication",
    retaindb: "Cloud memory API with hybrid search and 7 memory types",
    supermemory:
      "Semantic long-term memory with profile recall and entity extraction",
    holographic:
      "Local SQLite fact store with FTS5 search and trust scoring (no API key needed)",
    openviking:
      "Session-managed memory with tiered retrieval and knowledge browsing",
    byterover: "Persistent knowledge tree with tiered retrieval via brv CLI",
  },
} as const;
