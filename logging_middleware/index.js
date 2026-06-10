// logging_middleware/index.js
const axios = require('axios');

// Strict allowed enums from documentation
const ALLOWED_STACKS = ['backend', 'frontend'];
const ALLOWED_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];

const ALLOWED_PACKAGES = [
    'cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service', // Backend
    'api', 'component', 'hook', 'page', 'state', 'style',                                          // Frontend
    'auth', 'config', 'middleware', 'utils'                                                         // Shared
];

/**
 * Reusable Log function to send application tracking events to Affordmed's test server.
 * @param {string} stack - 'backend' or 'frontend'
 * @param {string} level - 'debug', 'info', 'warn', 'error', 'fatal'
 * @param {string} pkg - The package/layer string (e.g., 'db', 'handler')
 * @param {string} message - Descriptive context string
 * @param {string} token - Your active Bearer access token
 */
async function Log(stack, level, pkg, message, token) {
    // Ensure strict lowercase compliance
    const clearStack = stack?.toLowerCase();
    const clearLevel = level?.toLowerCase();
    const clearPkg = pkg?.toLowerCase();

    // Local validation checks
    if (!ALLOWED_STACKS.includes(clearStack)) {
        console.error(`[Local Log Error] Invalid stack: ${stack}`);
        return;
    }
    if (!ALLOWED_LEVELS.includes(clearLevel)) {
        console.error(`[Local Log Error] Invalid level: ${level}`);
        return;
    }
    if (!ALLOWED_PACKAGES.includes(clearPkg)) {
        console.error(`[Local Log Error] Invalid package: ${pkg}`);
        return;
    }

    try {
        const response = await axios.post(
            'http://4.224.186.213/evaluation-service/logs',
            {
                stack: clearStack,
                level: clearLevel,
                package: clearPkg,
                message: message
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`[Remote Log Success] Log ID: ${response.data.logID}`);
        return response.data;
    } catch (error) {
        console.error('[Remote Log Failure]:', error.response?.data || error.message);
    }
}

module.exports = { Log };