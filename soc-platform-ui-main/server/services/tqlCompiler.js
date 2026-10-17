/**
 * tqlCompiler.js — TacticLens Query Language (TQL) Lexer, Parser & Parameterized SQL Compiler
 *
 * Implements grammar from CLAUDE.md §9:
 *   query    := expr ( "|" pipe )*
 *   expr     := term ( ("AND" | "OR") term )*  |  "NOT" expr  |  "(" expr ")"
 *   term     := field ":" value | field op number | field ":" "(" value ("OR" value)* ")"
 *   field    := severity | stack | kev | epss | cvss | risk | tactic | technique | vendor
 *             | product | sector | source_type | triage | assignee | cve | ioc | age | text
 *   op       := ">" | "<" | ">=" | "<="
 *   pipe     := "sort" field ("asc"|"desc") | "dedup" "cluster" | "limit" number
 *
 * SECURITY: Compiles EXCLUSIVELY to parameterized SQL ($1, $2, ...) with strict field/operator whitelists.
 * NEVER interpolates raw input into the SQL string.
 */

export const ALLOWED_FIELDS = new Set([
    'severity', 'stack', 'kev', 'epss', 'cvss', 'risk', 'tactic', 'technique',
    'vendor', 'product', 'sector', 'source_type', 'triage', 'assignee', 'cve',
    'ioc', 'age', 'text'
]);

export const NUMERIC_FIELDS = new Set(['epss', 'cvss', 'risk', 'age']);
export const BOOLEAN_FIELDS = new Set(['stack', 'kev']);

// Map TQL fields to SQL column expressions
const FIELD_SQL_MAP = {
    severity: 'LOWER(a.severity)',
    stack: 'CASE WHEN r.matched_products IS NOT NULL AND array_length(r.matched_products, 1) > 0 THEN true ELSE false END',
    kev: 'COALESCE(cve.kev, false)',
    epss: 'COALESCE(cve.epss, 0)',
    cvss: 'COALESCE(cve.cvss_v31, 0)',
    risk: 'COALESCE(r.risk_score, 0)',
    tactic: 'LOWER(COALESCE(cl.primary_tactic, \'\'))',
    technique: 'LOWER(COALESCE(cl.primary_technique, \'\'))',
    vendor: 'LOWER(ARRAY_TO_STRING(cl.vendors, \' \'))',
    product: 'LOWER(ARRAY_TO_STRING(cl.products, \' \'))',
    sector: 'LOWER(org.sector)',
    source_type: 'LOWER(COALESCE(s.source_type, \'\'))',
    triage: 'COALESCE(tr.status, \'new\')',
    assignee: 'COALESCE(tr.assignee, \'\')',
    cve: 'ARRAY_TO_STRING(cl.cves, \' \')',
    ioc: 'LOWER(COALESCE(ioc.value, \'\'))',
    age: 'EXTRACT(EPOCH FROM (NOW() - cl.first_seen)) / 3600', // age in hours
    text: 'LOWER(cl.title || \' \' || COALESCE(cl.summary_ai, \'\'))'
};

/**
 * Tokenize a TQL string into a stream of tokens.
 */
export function tokenizeTQL(input) {
    const tokens = [];
    let i = 0;
    const str = (input || '').trim();

    while (i < str.length) {
        const char = str[i];

        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Parentheses
        if (char === '(') {
            tokens.push({ type: 'LPAREN', value: '(' });
            i++;
            continue;
        }
        if (char === ')') {
            tokens.push({ type: 'RPAREN', value: ')' });
            i++;
            continue;
        }

        // Pipe
        if (char === '|') {
            tokens.push({ type: 'PIPE', value: '|' });
            i++;
            continue;
        }

        // Comparison operators (>=, <=, >, <)
        if (char === '>' || char === '<') {
            if (str[i + 1] === '=') {
                tokens.push({ type: 'OP', value: char + '=' });
                i += 2;
                continue;
            }
            tokens.push({ type: 'OP', value: char });
            i++;
            continue;
        }

        // Colon
        if (char === ':') {
            tokens.push({ type: 'COLON', value: ':' });
            i++;
            continue;
        }

        // Quoted string "..."
        if (char === '"' || char === "'") {
            const quoteChar = char;
            let val = '';
            i++;
            while (i < str.length && str[i] !== quoteChar) {
                if (str[i] === '\\' && i + 1 < str.length) {
                    val += str[i + 1];
                    i += 2;
                } else {
                    val += str[i];
                    i++;
                }
            }
            i++; // skip closing quote
            tokens.push({ type: 'LITERAL', value: val });
            continue;
        }

        // Words / Identifiers / Numbers
        let word = '';
        while (i < str.length && !/[\s():|><="']/.test(str[i])) {
            word += str[i];
            i++;
        }

        const upper = word.toUpperCase();
        if (upper === 'AND') {
            tokens.push({ type: 'AND', value: 'AND' });
        } else if (upper === 'OR') {
            tokens.push({ type: 'OR', value: 'OR' });
        } else if (upper === 'NOT') {
            tokens.push({ type: 'NOT', value: 'NOT' });
        } else {
            tokens.push({ type: 'WORD', value: word });
        }
    }

    return tokens;
}

/**
 * Compiles a TQL query string into parameterized SQL WHERE and ORDER/LIMIT clauses.
 *
 * @param {string} tql
 * @param {object} [options]
 * @param {number} [options.paramStartIndex=1]
 * @returns {{ whereSql: string, params: any[], orderBySql: string, limitSql: string, errors: string[] }}
 */
export function compileTQL(tql, { paramStartIndex = 1 } = {}) {
    const errors = [];
    const params = [];
    let paramIndex = paramStartIndex;

    if (!tql || !tql.trim()) {
        return {
            whereSql: '1=1',
            params: [],
            orderBySql: 'ORDER BY cl.first_seen DESC',
            limitSql: 'LIMIT 50',
            errors: []
        };
    }

    let tokens;
    try {
        tokens = tokenizeTQL(tql);
    } catch (err) {
        return {
            whereSql: '1=0',
            params: [],
            orderBySql: '',
            limitSql: '',
            errors: [`Lexer error: ${err.message}`]
        };
    }

    // Split query into expressions and pipes
    const pipeIndices = [];
    for (let idx = 0; idx < tokens.length; idx++) {
        if (tokens[idx].type === 'PIPE') {
            pipeIndices.push(idx);
        }
    }

    const exprTokens = pipeIndices.length > 0 ? tokens.slice(0, pipeIndices[0]) : tokens;
    const pipeChunks = [];

    for (let p = 0; p < pipeIndices.length; p++) {
        const start = pipeIndices[p] + 1;
        const end = (p + 1 < pipeIndices.length) ? pipeIndices[p + 1] : tokens.length;
        pipeChunks.push(tokens.slice(start, end));
    }

    // Parse Expressions into parameterized SQL
    let whereSql = '';
    let pos = 0;

    function nextParam(val) {
        params.push(val);
        return `$${paramIndex++}`;
    }

    function parseTerm() {
        if (pos >= exprTokens.length) return null;

        const tok = exprTokens[pos];

        if (tok.type === 'NOT') {
            pos++;
            const sub = parseTerm();
            return sub ? `NOT (${sub})` : null;
        }

        if (tok.type === 'LPAREN') {
            pos++;
            const inner = parseExpr();
            if (pos < exprTokens.length && exprTokens[pos].type === 'RPAREN') {
                pos++;
            } else {
                errors.push('Mismatched parenthesis: expected )');
            }
            return `(${inner})`;
        }

        // Expect field
        if (tok.type === 'WORD' || tok.type === 'LITERAL') {
            const rawField = tok.value.toLowerCase();

            // Check if bare search term without field (e.g. "CVE-2024-1234" or "ransomware")
            if (pos + 1 >= exprTokens.length || (exprTokens[pos + 1].type !== 'COLON' && exprTokens[pos + 1].type !== 'OP')) {
                pos++;
                const p = nextParam(`%${tok.value.toLowerCase()}%`);
                return `(LOWER(cl.title) LIKE ${p} OR LOWER(COALESCE(cl.summary_ai, '')) LIKE ${p})`;
            }

            if (!ALLOWED_FIELDS.has(rawField)) {
                errors.push(`Unknown field: "${rawField}". Allowed fields: ${Array.from(ALLOWED_FIELDS).join(', ')}`);
                pos++;
                return null;
            }

            const sqlCol = FIELD_SQL_MAP[rawField];
            pos++; // consume field

            const nextTok = exprTokens[pos];

            // 1. Comparison Operator: field op number (e.g. cvss >= 7.0, risk > 50)
            if (nextTok && nextTok.type === 'OP') {
                const op = nextTok.value;
                pos++;
                const valTok = exprTokens[pos];
                if (!valTok) {
                    errors.push(`Expected value after operator "${op}"`);
                    return null;
                }
                pos++;
                const numVal = parseFloat(valTok.value);
                if (isNaN(numVal)) {
                    errors.push(`Field "${rawField}" with operator "${op}" requires a numeric value, got "${valTok.value}"`);
                    return null;
                }
                const p = nextParam(numVal);
                return `${sqlCol} ${op} ${p}`;
            }

            // 2. Colon Operator: field:value or field:(val1 OR val2)
            if (nextTok && nextTok.type === 'COLON') {
                pos++;
                const valTok = exprTokens[pos];

                if (!valTok) {
                    errors.push(`Expected value after colon for field "${rawField}"`);
                    return null;
                }

                // Sub-parenthesis: field:(v1 OR v2)
                if (valTok.type === 'LPAREN') {
                    pos++;
                    const subValues = [];
                    while (pos < exprTokens.length && exprTokens[pos].type !== 'RPAREN') {
                        if (exprTokens[pos].type === 'OR') {
                            pos++;
                            continue;
                        }
                        subValues.push(exprTokens[pos].value);
                        pos++;
                    }
                    if (pos < exprTokens.length && exprTokens[pos].type === 'RPAREN') {
                        pos++;
                    }

                    if (subValues.length === 0) return null;

                    const orClauses = subValues.map(v => {
                        const p = nextParam(v.toLowerCase());
                        return `${sqlCol} = ${p}`;
                    });
                    return `(${orClauses.join(' OR ')})`;
                }

                // Single value
                pos++;
                const cleanVal = valTok.value;

                if (BOOLEAN_FIELDS.has(rawField)) {
                    const boolVal = cleanVal.toLowerCase() === 'true' || cleanVal === '1';
                    const p = nextParam(boolVal);
                    return `${sqlCol} = ${p}`;
                }

                if (NUMERIC_FIELDS.has(rawField)) {
                    const numVal = parseFloat(cleanVal);
                    if (isNaN(numVal)) {
                        errors.push(`Numeric field "${rawField}" received non-numeric value "${cleanVal}"`);
                        return null;
                    }
                    const p = nextParam(numVal);
                    return `${sqlCol} = ${p}`;
                }

                // Text / Categorical field: exact or like match
                if (rawField === 'cve' || rawField === 'vendor' || rawField === 'product') {
                    const p = nextParam(`%${cleanVal.toLowerCase()}%`);
                    return `${sqlCol} LIKE ${p}`;
                }

                const p = nextParam(cleanVal.toLowerCase());
                return `${sqlCol} = ${p}`;
            }
        }

        pos++;
        return null;
    }

    function parseExpr() {
        let left = parseTerm();
        if (!left) left = '1=1';

        while (pos < exprTokens.length) {
            const tok = exprTokens[pos];
            if (tok.type === 'AND') {
                pos++;
                const right = parseTerm();
                if (right) left = `${left} AND ${right}`;
            } else if (tok.type === 'OR') {
                pos++;
                const right = parseTerm();
                if (right) left = `${left} OR ${right}`;
            } else if (tok.type === 'RPAREN') {
                break;
            } else {
                // Implicit AND if adjacent
                const right = parseTerm();
                if (right) left = `${left} AND ${right}`;
                else break;
            }
        }

        return left;
    }

    whereSql = parseExpr() || '1=1';

    // Parse Pipes (e.g. | sort risk desc | limit 50 | dedup cluster)
    let orderBySql = 'ORDER BY cl.first_seen DESC';
    let limitSql = 'LIMIT 50';

    for (const chunk of pipeChunks) {
        if (chunk.length === 0) continue;
        const verb = chunk[0].value.toLowerCase();

        if (verb === 'sort' && chunk.length >= 2) {
            const sortField = chunk[1].value.toLowerCase();
            const sortDir = (chunk.length >= 3 && chunk[2].value.toLowerCase() === 'asc') ? 'ASC' : 'DESC';

            if (ALLOWED_FIELDS.has(sortField)) {
                orderBySql = `ORDER BY ${FIELD_SQL_MAP[sortField]} ${sortDir}`;
            } else {
                errors.push(`Invalid sort field: "${sortField}"`);
            }
        } else if (verb === 'limit' && chunk.length >= 2) {
            const num = parseInt(chunk[1].value, 10);
            if (!isNaN(num) && num > 0) {
                limitSql = `LIMIT ${Math.min(500, num)}`;
            }
        } else if (verb === 'dedup') {
            // Already handled at cluster table granularity
        }
    }

    return {
        whereSql,
        params,
        orderBySql,
        limitSql,
        errors
    };
}
