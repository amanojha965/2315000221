import axios from 'axios';
import { Log } from '../logging_middleware/index.js';
import 'dotenv/config';

const TOKEN = process.env.ACCESS_TOKEN?.trim();
const BASE_URL = 'http://4.224.186.213/evaluation-service';

const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
};
// console.log("TOKEN:", TOKEN);

function knapsack(capacity, tasks) {
    const n = tasks.length;

    const dp = Array.from(
        { length: n + 1 },
        () => new Array(capacity + 1).fill(0)
    );

    for (let i = 1; i <= n; i++) {
        const { Duration, Impact } = tasks[i - 1];

        for (let w = 0; w <= capacity; w++) {
            dp[i][w] = dp[i - 1][w];

            if (Duration <= w) {
                const withTask = dp[i - 1][w - Duration] + Impact;

                if (withTask > dp[i][w]) {
                    dp[i][w] = withTask;
                }
            }
        }
    }

    const selectedTasks = [];
    let w = capacity;

    for (let i = n; i > 0; i--) {
        if (dp[i][w] !== dp[i - 1][w]) {
            selectedTasks.push(tasks[i - 1]);
            w -= tasks[i - 1].Duration;
        }
    }

    return {
        maxImpact: dp[n][capacity],
        selectedTasks
    };
}

async function runScheduler() {
    await Log('backend', 'info', 'service', 'Vehicle scheduler started.', TOKEN);

    let depots, vehicles;

    try {
        const depotRes = await axios.get(`${BASE_URL}/depots`, { headers });
        depots = depotRes.data.depots;

        await Log(
            'backend',
            'info',
            'service',
            `Fetched ${depots.length} depots.`,
            TOKEN
        );
    } catch (err) {
        await Log(
            'backend',
            'error',
            'handler',
            `Failed to fetch depots: ${err.message}`,
            TOKEN
        );

        console.error('Could not fetch depots:', err.response?.data || err.message);
        process.exit(1);
    }

    try {
        const vehicleRes = await axios.get(`${BASE_URL}/vehicles`, { headers });
        vehicles = vehicleRes.data.vehicles;

        await Log(
            'backend',
            'info',
            'service',
            `Fetched ${vehicles.length} vehicle tasks.`,
            TOKEN
        );
    } catch (err) {
        await Log(
            'backend',
            'error',
            'handler',
            `Failed to fetch vehicles: ${err.message}`,
            TOKEN
        );

        console.error('Could not fetch vehicles:', err.response?.data || err.message);
        process.exit(1);
    }

    for (const depot of depots) {
        const { ID, MechanicHours } = depot;

        await Log(
            'backend',
            'info',
            'service',
            `Running scheduler for depot ${ID}.`,
            TOKEN
        );

        const { maxImpact, selectedTasks } = knapsack(
            MechanicHours,
            vehicles
        );

        const totalDuration = selectedTasks.reduce(
            (sum, task) => sum + task.Duration,
            0
        );

        console.log(`Depot ${ID}`);
        console.log(`Max Impact: ${maxImpact}`);

        console.table(
            selectedTasks.map(task => ({
                TaskID: task.TaskID,
                Duration: task.Duration,
                Impact: task.Impact
            }))
        );

        await Log(
            'backend',
            'info',
            'service',
            `Depot ${ID} processed successfully.`,
            TOKEN
        );
    }

    await Log(
        'backend',
        'info',
        'service',
        'Vehicle scheduler completed successfully.',
        TOKEN
    );
}

runScheduler();