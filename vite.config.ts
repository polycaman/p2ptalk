import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import injectSocketIO from './src/lib/server/socketHandler';

const webSocketServer = {
	name: 'webSocketServer',
	configureServer(server: any) {
		if (!server.httpServer) return;
        injectSocketIO(server.httpServer);
	}
};

export default defineConfig({
	plugins: [sveltekit(), webSocketServer],
    server: {
        fs: {
            allow: ['static', '/app/node_modules']
        },
        watch: {
            usePolling: true
        }
    }
});
