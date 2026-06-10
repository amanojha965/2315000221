import axios from 'axios';

const ALLOWED_STACKS = ['backend', 'frontend'];
const ALLOWED_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const ALLOWED_PACKAGES = [
    // Backend only
    'cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service',
    // Frontend only
    'api', 'component', 'hook', 'page', 'state', 'style',
    // Shared
    'auth', 'config', 'middleware', 'utils'
];

/**
 * Sends a log entry to the Affordmed evaluation server.
 * @param {string} stack   - 'backend' | 'frontend'
 * @param {string} level   - 'debug' | 'info' | 'warn' | 'error' | 'fatal'
 * @param {string} pkg     
 * @param {string} message 
 * @param {string} token   
 */
export async function Log(stack, level, pkg, message, token) {
    const s = stack?.toLowerCase();
    const l = level?.toLowerCase();
    const p = pkg?.toLowerCase();

    if (!ALLOWED_STACKS.includes(s)) {
        console.error(`[Log] Invalid stack: "${stack}". Allowed: ${ALLOWED_STACKS.join(', ')}`);
        return;
    }
    if (!ALLOWED_LEVELS.includes(l)) {
        console.error(`[Log] Invalid level: "${level}". Allowed: ${ALLOWED_LEVELS.join(', ')}`);
        return;
    }
    if (!ALLOWED_PACKAGES.includes(p)) {
        console.error(`[Log] Invalid package: "${pkg}". Allowed: ${ALLOWED_PACKAGES.join(', ')}`);
        return;
    }
    if (!token) {
        console.error('[Log] No token provided.');
        return;
    }

    try {
        const response = await axios.post(
            'http://4.224.186.213/evaluation-service/logs',
            { stack: s, level: l, package: p, message },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`[Log OK] logID: ${response.data.logID}`);
        return response.data;
    } catch (err) {
        console.error('[Log FAILED]:', err.response?.data || err.message);
    }
}