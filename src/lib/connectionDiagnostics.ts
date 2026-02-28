/**
 * Connection diagnostics utility.
 * Runs real ICE gathering probes (STUN, TURN-UDP, TURN-TCP, TURNS-TLS)
 * and checks the live chat peer connection to a specific friend.
 */
import { get } from 'svelte/store';
import { chatPeers, chatDataChannels, turnRelayChatPeers } from '$lib/stores/chatStore';
import { getTurnServers } from '$lib/webrtc';

export type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warn';

export interface DiagnosticTest {
    id: string;
    label: string;       // i18n key
    status: TestStatus;
    detail: string;
    latency?: number;     // ms
}

export interface DiagnosticReport {
    friendId: string;
    friendName: string;
    tests: DiagnosticTest[];
    summary: 'good' | 'degraded' | 'bad';
    running: boolean;
}

function makeTest(id: string, label: string): DiagnosticTest {
    return { id, label, status: 'pending', detail: '' };
}

/** Probe ICE candidates with a specific ICE server config, with timeout */
async function probeIce(
    iceServers: RTCIceServer[],
    wantType: 'srflx' | 'relay',
    timeoutMs = 6000
): Promise<{ ok: boolean; latency: number; detail: string; candidateIp?: string }> {
    const start = performance.now();
    return new Promise((resolve) => {
        let settled = false;
        const pc = new RTCPeerConnection({ iceServers });
        // Need a data channel to trigger ICE gathering
        pc.createDataChannel('probe');

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                pc.close();
                resolve({ ok: false, latency: 0, detail: `Timeout (${timeoutMs / 1000}s)` });
            }
        }, timeoutMs);

        pc.onicecandidate = (e) => {
            if (settled) return;
            if (e.candidate) {
                const c = e.candidate;
                if (c.type === wantType) {
                    settled = true;
                    clearTimeout(timer);
                    const latency = Math.round(performance.now() - start);
                    const ip = c.address || c.candidate?.match(/([0-9a-f.:]+)\s\d+\styp/)?.[1] || '';
                    pc.close();
                    resolve({ ok: true, latency, detail: ip ? `${ip}` : 'OK', candidateIp: ip });
                }
            }
        };

        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete' && !settled) {
                settled = true;
                clearTimeout(timer);
                pc.close();
                resolve({ ok: false, latency: 0, detail: 'No matching candidate found' });
            }
        };

        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(() => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    pc.close();
                    resolve({ ok: false, latency: 0, detail: 'Offer creation failed' });
                }
            });
    });
}

export async function runDiagnostics(
    friendId: string,
    friendName: string,
    onUpdate: (report: DiagnosticReport) => void
): Promise<DiagnosticReport> {
    const tests: DiagnosticTest[] = [
        makeTest('stun', 'diag.stun'),
        makeTest('turn-udp', 'diag.turnUdp'),
        makeTest('turn-tcp', 'diag.turnTcp'),
        makeTest('turns-tls', 'diag.turnsTls'),
        makeTest('turn-creds', 'diag.turnCreds'),
        makeTest('chat-peer', 'diag.chatPeer'),
        makeTest('data-channel', 'diag.dataChannel'),
        makeTest('relay-status', 'diag.relayStatus'),
    ];

    const report: DiagnosticReport = {
        friendId,
        friendName,
        tests,
        summary: 'good',
        running: true,
    };

    const update = () => onUpdate({ ...report, tests: [...report.tests] });
    const setTest = (id: string, partial: Partial<DiagnosticTest>) => {
        const t = tests.find(x => x.id === id);
        if (t) Object.assign(t, partial);
    };

    // ─── 1. STUN test ────────────────────────────────────
    setTest('stun', { status: 'running' });
    update();
    const stunResult = await probeIce(
        [{ urls: 'stun:stun.l.google.com:19302' }],
        'srflx',
        5000
    );
    setTest('stun', {
        status: stunResult.ok ? 'pass' : 'fail',
        detail: stunResult.ok
            ? `${stunResult.detail} (${stunResult.latency}ms)`
            : stunResult.detail,
        latency: stunResult.latency
    });
    update();

    // ─── 2. Fetch TURN credentials ──────────────────────
    setTest('turn-creds', { status: 'running' });
    update();
    let turnServers: RTCIceServer[] = [];
    try {
        turnServers = await getTurnServers();
        if (turnServers.length > 0) {
            setTest('turn-creds', {
                status: 'pass',
                detail: `${turnServers.length} server(s)`
            });
        } else {
            setTest('turn-creds', { status: 'fail', detail: 'No TURN servers returned' });
        }
    } catch {
        setTest('turn-creds', { status: 'fail', detail: 'Fetch failed' });
    }
    update();

    // ─── 3. TURN-UDP test ────────────────────────────────
    if (turnServers.length > 0) {
        const turnUdp = turnServers.find(s => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.some(u => u.startsWith('turn:') && !u.includes('transport=tcp'));
        });

        if (turnUdp) {
            setTest('turn-udp', { status: 'running' });
            update();
            const result = await probeIce([turnUdp], 'relay', 8000);
            setTest('turn-udp', {
                status: result.ok ? 'pass' : 'fail',
                detail: result.ok
                    ? `Relay OK (${result.latency}ms)`
                    : result.detail,
                latency: result.latency
            });
        } else {
            setTest('turn-udp', { status: 'warn', detail: 'Not configured' });
        }
    } else {
        setTest('turn-udp', { status: 'fail', detail: 'No credentials' });
    }
    update();

    // ─── 4. TURN-TCP test ────────────────────────────────
    if (turnServers.length > 0) {
        const turnTcp = turnServers.find(s => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.some(u => u.includes('transport=tcp'));
        });

        if (turnTcp) {
            setTest('turn-tcp', { status: 'running' });
            update();
            const result = await probeIce([turnTcp], 'relay', 8000);
            setTest('turn-tcp', {
                status: result.ok ? 'pass' : 'fail',
                detail: result.ok
                    ? `Relay OK (${result.latency}ms)`
                    : result.detail,
                latency: result.latency
            });
        } else {
            setTest('turn-tcp', { status: 'warn', detail: 'Not configured' });
        }
    } else {
        setTest('turn-tcp', { status: 'fail', detail: 'No credentials' });
    }
    update();

    // ─── 5. TURNS-TLS test ───────────────────────────────
    if (turnServers.length > 0) {
        const turnsTls = turnServers.find(s => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.some(u => u.startsWith('turns:'));
        });

        if (turnsTls) {
            setTest('turns-tls', { status: 'running' });
            update();
            const result = await probeIce([turnsTls], 'relay', 8000);
            setTest('turns-tls', {
                status: result.ok ? 'pass' : 'fail',
                detail: result.ok
                    ? `Relay OK (${result.latency}ms)`
                    : result.detail,
                latency: result.latency
            });
        } else {
            setTest('turns-tls', { status: 'warn', detail: 'Not configured' });
        }
    } else {
        setTest('turns-tls', { status: 'fail', detail: 'No credentials' });
    }
    update();

    // ─── 6. Chat peer connection status ──────────────────
    const peer = get(chatPeers)[friendId];
    if (peer) {
        const iceState = peer.iceConnectionState;
        const connState = peer.connectionState;
        const gathering = peer.iceGatheringState;

        let status: TestStatus = 'pass';
        if (iceState === 'connected' || iceState === 'completed') {
            status = 'pass';
        } else if (iceState === 'checking' || iceState === 'new') {
            status = 'warn';
        } else {
            status = 'fail';
        }

        setTest('chat-peer', {
            status,
            detail: `ICE: ${iceState}, Conn: ${connState}, Gathering: ${gathering}`
        });

        // Try to get stats for rtt
        try {
            const stats = await peer.getStats();
            let rtt = 0;
            let localType = '';
            let remoteType = '';
            stats.forEach((s: any) => {
                if (s.type === 'candidate-pair' && s.state === 'succeeded') {
                    rtt = s.currentRoundTripTime ? Math.round(s.currentRoundTripTime * 1000) : 0;
                    const local = stats.get(s.localCandidateId);
                    const remote = stats.get(s.remoteCandidateId);
                    localType = local?.candidateType || '';
                    remoteType = remote?.candidateType || '';
                }
            });
            if (rtt > 0) {
                setTest('chat-peer', {
                    status,
                    detail: `ICE: ${iceState} | RTT: ${rtt}ms | Local: ${localType}, Remote: ${remoteType}`,
                    latency: rtt
                });
            }
        } catch { /* stats not available */ }
    } else {
        setTest('chat-peer', {
            status: 'fail',
            detail: 'No peer connection exists'
        });
    }
    update();

    // ─── 7. Data channel status ──────────────────────────
    const dc = get(chatDataChannels)[friendId];
    if (dc) {
        const ready = dc.readyState;
        setTest('data-channel', {
            status: ready === 'open' ? 'pass' : ready === 'connecting' ? 'warn' : 'fail',
            detail: `State: ${ready}`
        });
    } else {
        setTest('data-channel', {
            status: 'fail',
            detail: 'No data channel'
        });
    }
    update();

    // ─── 8. Relay status ─────────────────────────────────
    const isRelayed = get(turnRelayChatPeers).has(friendId);
    setTest('relay-status', {
        status: isRelayed ? 'warn' : (peer && (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') ? 'pass' : 'fail'),
        detail: isRelayed
            ? 'Connection is relayed through TURN server'
            : peer && (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed')
                ? 'Direct P2P connection'
                : 'Not connected'
    });
    update();

    // ─── Summary ─────────────────────────────────────────
    const failCount = tests.filter(t => t.status === 'fail').length;
    const warnCount = tests.filter(t => t.status === 'warn').length;

    if (failCount >= 3) report.summary = 'bad';
    else if (failCount >= 1 || warnCount >= 2) report.summary = 'degraded';
    else report.summary = 'good';

    report.running = false;
    update();
    return report;
}
