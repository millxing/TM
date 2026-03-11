/**
 * tm-shared.js
 * Shared constants and utility functions for TMMvotes.html and TMMpca.html.
 * Load this file via <script src="tm-shared.js"></script> before each app's
 * own <script> block.
 */

/****************************************************
 * SPREADSHEET STRUCTURE CONFIG
 ****************************************************/
const TITLE_ROW_INDEX = 2;
const DESCRIPTION_ROW_INDEX = 3;
const HEADER_ROW_INDEX = 4;
const FIRST_DATA_ROW_INDEX = 5;

const PRECINCT_COL_INDEX = 0;
const NAME_COL_INDEX = 1;
const FIRST_VOTE_COL_INDEX = 2;

const SPREADSHEET_BASE_URL = 'https://raw.githubusercontent.com/millxing/TM/main/';
const PRIMARY_VOTE_METADATA_FILE_NAMES = [
    'AllVotes_categorized.xlsx'
];
const VOTE_GUIDE_FILE_NAMES = [
    'VoteGuide.xlsx',
    'Vote%20Guide.xlsx',
    'voteguide.xlsx'
];
const MEMBER_ALIASES_FILE_NAMES = [
    'members_aliases.xlsx',
    'members%20aliases.xlsx',
    'member_aliases.xlsx',
    'MemberAliases.xlsx'
];
const DISALLOWED_MEMBER_NAMES = new Set(['YES', 'NO', 'ABSTAIN', 'NO VOTE', 'TOTAL', 'ARTICLE', 'MOTION']);
const DEFAULT_MEMBER_IDENTITY_ALIASES = new Map([
    ['ingraham, katherine a', 'ingraham, katherine'],
    ['warren, paul s', 'warren, paul']
]);

const SESSION_FILES = [
    { id: '2021-05', label: 'May 2021 Annual Town Meeting', file: 'Votes/May%202021%20Votes.xlsx' },
    { id: '2021-10', label: 'October 2021 Special Town Meeting', file: 'Votes/October%202021%20Votes.xlsx' },
    { id: '2021-11', label: 'November 2021 Special Town Meeting', file: 'Votes/November%202021%20Votes.xlsx' },
    { id: '2022-05', label: 'May 2022 Annual Town Meeting', file: 'Votes/May%202022%20Votes.xlsx' },
    { id: '2022-11', label: 'November 2022 Special Town Meeting', file: 'Votes/November%202022%20Votes.xlsx' },
    { id: '2023-01', label: 'January 2023 Special Town Meeting', file: 'Votes/January%202023%20Votes.xlsx' },
    { id: '2023-05', label: 'May 2023 Annual Town Meeting', file: 'Votes/May%202023%20Votes.xlsx' },
    { id: '2023-11', label: 'November 2023 Special Town Meeting', file: 'Votes/November%202023%20Votes.xlsx' },
    { id: '2024-05', label: 'May 2024 Annual Town Meeting', file: 'Votes/May%202024%20Votes.xlsx' },
    { id: '2024-11', label: 'November 2024 Special Town Meeting', file: 'Votes/November%202024%20Votes.xlsx' },
    { id: '2025-05', label: 'May 2025 Annual Town Meeting', file: 'Votes/May%202025%20Votes.xlsx' },
    { id: '2025-11', label: 'November 2025 Special Town Meeting', file: 'Votes/November%202025%20Votes.xlsx' }
];

/****************************************************
 * VOTE-TYPE CONSTANTS & THRESHOLDS
 ****************************************************/
const VOTE_YES = 'YES';
const VOTE_NO = 'NO';
const VOTE_ABSTAIN = 'ABSTAIN';
const VOTE_NOT_PRESENT = 'NoVote';

const PRECINCT_SORT_AL = 999;
const PRECINCT_SORT_OTHER = 998;

/****************************************************
 * BASIC HELPERS
 ****************************************************/
function getSpreadsheetRawURL(file) {
    return `${SPREADSHEET_BASE_URL}${file}`;
}

function isTerminateDebateVote(title) {
    return String(title || '').toLowerCase().includes('terminate debate');
}

function normalizeVote(raw) {
    const value = (raw == null ? '' : String(raw)).trim().toUpperCase();
    if (!value) return 'NoVote';
    if (value === 'Y') return 'YES';
    if (value === 'N') return 'NO';
    if (value === 'A') return 'ABSTAIN';
    if (value === 'YES' || value === 'NO' || value === 'ABSTAIN') return value;
    return 'NoVote';
}

function voteToNumeric(voteValue) {
    if (voteValue === 'YES') return 1;
    if (voteValue === 'NO') return -1;
    if (voteValue === 'ABSTAIN') return 0;
    return NaN;
}

function precinctSortValue(precinct) {
    const n = parseInt(precinct, 10);
    if (!Number.isNaN(n)) return n;
    if (String(precinct).toUpperCase() === 'AL') return PRECINCT_SORT_AL;
    return PRECINCT_SORT_OTHER;
}

/****************************************************
 * VOTE TITLE MATCHING
 ****************************************************/
function normalizeVoteTitleForMatch(title) {
    return String(title || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function buildVoteGuideKey(sessionId, voteTitle) {
    return `${String(sessionId || '').trim()}||${normalizeVoteTitleForMatch(voteTitle)}`;
}

function normalizeVoteTitleForLooseMatch(title) {
    return normalizeVoteTitleForMatch(title)
        .replace(/\barticles\b/g, 'article')
        .replace(/\bmain motion\b/g, 'motion')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildLooseVoteGuideKey(sessionId, voteTitle) {
    return `${String(sessionId || '').trim()}||${normalizeVoteTitleForLooseMatch(voteTitle)}`;
}

/****************************************************
 * SESSION ID LOOKUP
 ****************************************************/
function getSessionIdFromGuideLabel(sessionLabel) {
    const normalized = String(sessionLabel || '').toLowerCase().trim();
    if (!normalized) return null;

    const direct = SESSION_FILES.find(session =>
        normalized.includes(session.label.toLowerCase())
    );
    if (direct) return direct.id;

    const match = normalized.match(/\b(january|may|october|november)\s+(20\d{2})\b/i);
    if (!match) return null;
    const monthMap = { january: '01', may: '05', october: '10', november: '11' };
    const month = monthMap[match[1].toLowerCase()];
    const year = match[2];
    const candidate = `${year}-${month}`;
    return SESSION_FILES.some(session => session.id === candidate) ? candidate : null;
}

/****************************************************
 * MEMBER NAME NORMALIZATION
 ****************************************************/
function normalizeMemberName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeMemberAliasToken(name) {
    return normalizeMemberName(name)
        .replace(/\./g, '')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
}

function reorderNameIfLikelyFirstLast(normalizedName) {
    if (!normalizedName || normalizedName.includes(',')) return '';
    const tokens = normalizedName.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return '';

    const suffixPattern = /^(jr|sr|ii|iii|iv|v|vi)$/i;
    let suffix = '';
    if (tokens.length > 2 && suffixPattern.test(tokens[tokens.length - 1])) {
        suffix = tokens.pop();
    }

    const last = tokens.pop();
    if (!last || tokens.length === 0) return '';
    const given = suffix ? [...tokens, suffix] : tokens;
    return `${last}, ${given.join(' ')}`.replace(/\s+/g, ' ').trim();
}

function stripLikelyMiddleInitials(normalizedName) {
    if (!normalizedName) return '';
    if (normalizedName.includes(',')) {
        const parts = normalizedName.split(',');
        const last = (parts[0] || '').trim();
        const given = (parts.slice(1).join(',') || '').trim();
        if (!given) return last;

        const tokens = given
            .replace(/\./g, '')
            .split(/\s+/)
            .filter(Boolean);

        if (tokens.length > 1 && /^[a-z]$/.test(tokens[tokens.length - 1])) {
            tokens.pop();
        }
        return `${last}, ${tokens.join(' ')}`.replace(/\s+/g, ' ').trim();
    }

    const tokens = normalizedName
        .replace(/\./g, '')
        .split(/\s+/)
        .filter(Boolean);

    if (tokens.length > 1 && /^[a-z]$/.test(tokens[tokens.length - 1])) {
        tokens.pop();
    } else if (tokens.length === 3 && /^[a-z]$/.test(tokens[1])) {
        tokens.splice(1, 1);
    }
    return tokens.join(' ');
}

function canonicalMemberIdentityName(name) {
    const normalized = normalizeMemberAliasToken(name);
    if (!normalized) return '';

    const candidates = [];
    const pushCandidate = value => {
        const token = normalizeMemberAliasToken(value);
        if (token && !candidates.includes(token)) candidates.push(token);
    };

    pushCandidate(normalized);
    pushCandidate(stripLikelyMiddleInitials(normalized));

    const reordered = reorderNameIfLikelyFirstLast(normalized);
    if (reordered) {
        pushCandidate(reordered);
        pushCandidate(stripLikelyMiddleInitials(reordered));
    }

    for (const candidate of candidates) {
        const mapped = memberIdentityAliases.get(candidate);
        if (mapped) return mapped;
    }
    return candidates[1] || candidates[0];
}

function preferDisplayName(existingName, incomingName) {
    const existing = String(existingName || '').trim();
    const incoming = String(incomingName || '').trim();
    if (!existing) return incoming;
    if (!incoming) return existing;
    if (incoming.length < existing.length) return incoming;
    return existing;
}

function summarizePrecinctSet(precinctSet) {
    const items = Array.from(precinctSet || []).filter(Boolean);
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.includes('AL')) return 'AL';

    const numeric = items
        .map(value => parseInt(value, 10))
        .filter(value => !Number.isNaN(value))
        .sort((a, b) => a - b);
    if (numeric.length > 0) return String(numeric[0]);
    return items[0];
}

function canonicalMemberKey(name, precinct) {
    void precinct;
    return canonicalMemberIdentityName(name);
}

/****************************************************
 * MEMBER ALIAS PARSING
 ****************************************************/
function parseMemberAliasesRows(rows) {
    const aliasMap = new Map();
    const canonicalDisplayNames = new Map();
    if (!Array.isArray(rows) || rows.length === 0) {
        return { aliasMap, canonicalDisplayNames };
    }

    const firstCol = String(((rows[0] || [])[0]) || '').trim().toLowerCase();
    const secondCol = String(((rows[0] || [])[1]) || '').trim().toLowerCase();
    const hasHeaderRow =
        (firstCol.includes('canonical') || firstCol === 'name') &&
        secondCol.includes('alias');
    const startRow = hasHeaderRow ? 1 : 0;

    for (let r = startRow; r < rows.length; r++) {
        const row = rows[r] || [];
        const canonicalRaw = String(row[0] || '').trim();
        const aliasesRaw = String(row[1] || '').trim();
        if (!canonicalRaw) continue;

        const canonical = normalizeMemberAliasToken(canonicalRaw);
        if (!canonical) continue;
        if (!canonicalDisplayNames.has(canonical)) {
            canonicalDisplayNames.set(canonical, canonicalRaw);
        }

        aliasMap.set(canonical, canonical);
        if (!aliasesRaw) continue;

        aliasesRaw
            .split('::')
            .map(token => normalizeMemberAliasToken(token))
            .filter(Boolean)
            .forEach(alias => aliasMap.set(alias, canonical));
    }

    return { aliasMap, canonicalDisplayNames };
}

/****************************************************
 * VOTE GUIDE HELPERS
 *
 * getVoteGuideDetails reads globals voteGuideBySessionAndVote
 * and voteGuideBySessionAndLooseVote — each app initializes
 * these in its own <script> block before any call.
 ****************************************************/
function getVoteGuideDetails(sessionId, voteTitle) {
    if (!sessionId || voteGuideBySessionAndVote.size === 0) return null;
    return (
        voteGuideBySessionAndVote.get(buildVoteGuideKey(sessionId, voteTitle)) ||
        voteGuideBySessionAndLooseVote.get(buildLooseVoteGuideKey(sessionId, voteTitle)) ||
        null
    );
}

/****************************************************
 * PCA / LINEAR ALGEBRA HELPERS
 ****************************************************/
function dotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

function vectorNorm(vector) {
    return Math.sqrt(dotProduct(vector, vector));
}

function normalizeVector(vector) {
    const norm = vectorNorm(vector);
    if (norm < 1e-12) return null;
    return vector.map(value => value / norm);
}

function multiplyMatrixVector(matrix, vector) {
    const out = Array(matrix.length).fill(0);
    for (let i = 0; i < matrix.length; i++) {
        let sum = 0;
        const row = matrix[i];
        for (let j = 0; j < row.length; j++) sum += row[j] * vector[j];
        out[i] = sum;
    }
    return out;
}

function rayleighQuotient(matrix, vector) {
    const multiplied = multiplyMatrixVector(matrix, vector);
    return dotProduct(vector, multiplied);
}

function powerIteration(matrix, maxIterations = 300, tolerance = 1e-9) {
    const n = matrix.length;
    if (n === 0) return null;

    const candidateSeeds = [];
    // Start with a dense seed to avoid getting stuck on a zero-variance basis column.
    candidateSeeds.push(Array.from({ length: n }, () => 1));
    // Then try basis vectors deterministically.
    for (let i = 0; i < n; i++) {
        candidateSeeds.push(Array.from({ length: n }, (_, idx) => (idx === i ? 1 : 0)));
    }

    for (let s = 0; s < candidateSeeds.length; s++) {
        let vector = normalizeVector(candidateSeeds[s]);
        if (!vector) continue;

        let failed = false;
        for (let iter = 0; iter < maxIterations; iter++) {
            const multiplied = multiplyMatrixVector(matrix, vector);
            const normalized = normalizeVector(multiplied);
            if (!normalized) {
                failed = true;
                break;
            }

            let delta = 0;
            for (let i = 0; i < normalized.length; i++) {
                delta += Math.abs(normalized[i] - vector[i]);
            }
            vector = normalized;
            if (delta < tolerance) break;
        }

        if (!failed) {
            return {
                vector,
                eigenvalue: rayleighQuotient(matrix, vector)
            };
        }
    }

    return null;
}

function deflateMatrix(matrix, vector, eigenvalue) {
    const n = matrix.length;
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            out[i][j] = matrix[i][j] - (eigenvalue * vector[i] * vector[j]);
        }
    }
    return out;
}

function buildCovarianceMatrix(centeredMatrix) {
    const rowCount = centeredMatrix.length;
    const colCount = centeredMatrix[0].length;
    const covariance = Array.from({ length: colCount }, () => Array(colCount).fill(0));
    const denom = rowCount > 1 ? rowCount - 1 : 1;

    for (let r = 0; r < rowCount; r++) {
        const row = centeredMatrix[r];
        for (let i = 0; i < colCount; i++) {
            const xi = row[i];
            for (let j = i; j < colCount; j++) {
                covariance[i][j] += xi * row[j];
            }
        }
    }

    for (let i = 0; i < colCount; i++) {
        for (let j = i; j < colCount; j++) {
            const value = covariance[i][j] / denom;
            covariance[i][j] = value;
            covariance[j][i] = value;
        }
    }
    return covariance;
}
