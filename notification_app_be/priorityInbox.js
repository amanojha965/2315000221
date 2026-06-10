import axios from 'axios';
import { Log } from '../logging_middleware/index.js';
import 'dotenv/config';

const TOKEN = process.env.ACCESS_TOKEN;
const BASE_URL = 'http://4.224.186.213/evaluation-service';

async function getTopPriorityNotifications(n = 10) {
    try {
        await Log('backend', 'info', 'service', 'Fetching notifications...', TOKEN);

        const response = await axios.get(`${BASE_URL}/notifications`, {
            headers: {
                Authorization: `Bearer ${TOKEN}`
            }
        });

        const notifications = response.data.notifications;

        const priorityList = notifications.map(item => {
            let weight = 0;

            if (item.Type === 'Placement') weight = 3;
            else if (item.Type === 'Result') weight = 2;
            else if (item.Type === 'Event') weight = 1;

            const timeDiff = Date.now() - new Date(item.Timestamp).getTime();
            const score = (weight * 10) + (100000000 / Math.max(timeDiff, 1));

            return {
                ...item,
                score
            };
        });

        priorityList.sort((a, b) => b.score - a.score);

        const topNotifications = priorityList.slice(0, n);

        console.table(
            topNotifications.map((item, index) => ({
                Rank: index + 1,
                Type: item.Type,
                Message: item.Message,
                Score: item.score.toFixed(4)
            }))
        );

        return topNotifications;

    } catch (error) {
        await Log(
            'backend',
            'error',
            'handler',
            `Error: ${error.message}`,
            TOKEN
        );

        console.error(error.response?.data || error.message);
    }
}

getTopPriorityNotifications();