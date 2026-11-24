// From Marinara Engine (AGPL-3.0): packages/client/src/lib/connection-groups.ts (staging cfc726e93, 226 lines, read to the end 2026-11-24).
// What is here: the part the connection picker (ConnectionSelect) uses for its "via {{service}}" line — upstreamOf, PREFIX_NAMES,
// knownPrefixName, viaName — copied as is with the TypeScript types left out. PROVIDERS is our copy (src/marinara/providers.js).
// Not here: the rest of the file (connectionGroupFolder, sortConnectionGroups, orderAccountGroups, reorderConnectionGroups,
// groupModelsByAccount, sortByModelId, subgroupByUpstream, recentModels, roleBadges, accountStateLabel). They arrange Marinara's
// own saved Models under its Connection accounts (api_connections rows, folders, library order); our connections are
// SillyTavern's and the extension's, which have no accounts, folders or rows of that shape. See docs/MARINARA-PORT.md.
import { PROVIDERS } from './providers.js';

/** The gateway upstream of a model id: everything before the first "/" (`nanogpt/zai-org/glm` → `nanogpt`). */
export function upstreamOf(modelId) {
    const id = modelId?.trim() ?? '';
    const slash = id.indexOf('/');
    return slash > 0 ? id.slice(0, slash) : null;
}

/** Names for model-id prefixes that are not a Marinara service id. */
const PREFIX_NAMES = {
    linkapi: 'LinkAPI',
    arliai: 'ArliAI',
    'zai-org': 'Z.AI',
    'x-ai': 'xAI',
    'meta-llama': 'Meta',
    'deepseek-ai': 'DeepSeek',
    mistralai: 'Mistral',
    moonshotai: 'Moonshot',
    qwen: 'Qwen',
    google: 'Google',
    minimax: 'MiniMax',
    nousresearch: 'Nous Research',
    nvidia: 'NVIDIA',
    microsoft: 'Microsoft',
};

/** The display name of a model-id prefix (a gateway route or a model maker), or undefined when it is not known. */
export function knownPrefixName(prefix) {
    const key = prefix.toLowerCase();
    return PROVIDERS[key]?.name ?? PREFIX_NAMES[key];
}

/** The upstream a gateway (custom) Connection routes a model to, as a name ("NanoGPT"); null for any other kind. */
export function viaName(provider, modelId) {
    if (provider !== 'custom') return null;
    const prefix = upstreamOf(modelId);
    return (prefix && knownPrefixName(prefix)) || null;
}
