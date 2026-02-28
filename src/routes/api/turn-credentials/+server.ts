import { json } from '@sveltejs/kit';
import { createHmac } from 'crypto';

const TURN_SECRET = process.env.TURN_SECRET || 'changeme';
const TURN_DOMAIN = process.env.TURN_DOMAIN || 'p2ptalk.org';
const CREDENTIAL_TTL = 86400; // 24 hours

export function GET({ locals }) {
    // Only authenticated users can get TURN credentials
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = Math.floor(Date.now() / 1000 + CREDENTIAL_TTL) + ':' + locals.user.id;
    const credential = createHmac('sha1', TURN_SECRET).update(username).digest('base64');

    return json({
        iceServers: [
            {
                urls: `turn:${TURN_DOMAIN}:3478`,
                username,
                credential
            },
            {
                urls: `turn:${TURN_DOMAIN}:3478?transport=tcp`,
                username,
                credential
            },
            {
                urls: `turns:${TURN_DOMAIN}:5349`,
                username,
                credential
            }
        ]
    });
}
