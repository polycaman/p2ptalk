/**
 * Svelte action that binds a MediaStream to a <video> or <audio> element's srcObject.
 * Handles updates efficiently by skipping if the stream reference hasn't changed.
 *
 * Usage: <video use:srcObject={stream}></video>
 */
export function srcObject(node: HTMLVideoElement | HTMLAudioElement, stream: MediaStream | null) {
    let currentStream: MediaStream | null = null;

    const updateStream = (s: MediaStream | null) => {
        if (s === currentStream) return;
        currentStream = s;
        if (s) {
            node.srcObject = s;
            node.play().catch(e => console.error('Auto-play failed', e));
        } else {
            node.srcObject = null;
        }
    };

    updateStream(stream);

    return {
        update(newStream: MediaStream | null) {
            updateStream(newStream);
        }
    };
}
