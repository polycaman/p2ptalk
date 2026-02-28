# Copilot Instructions

## Project Overview
SvelteKit P2P video/chat app with PostgreSQL, WebRTC, Socket.IO, and E2E encryption.

## Tech Stack
- **Framework**: SvelteKit (Svelte 4 syntax – `export let`, `createEventDispatcher`)
- **Database**: PostgreSQL 15 via Drizzle ORM (Docker)
- **Real-time**: Socket.IO + WebRTC (mesh topology)
- **Encryption**: ECDH P-256 + AES-256-GCM (Insertable Streams API)
- **Server**: Custom Node.js server with HTTPS (`server.js`)

## Architecture Patterns
- **Component Composition**: Large features split into thin wrapper + focused sub-components
- **Event Forwarding**: Sub-components `dispatch()` events; wrappers use bare `on:eventName` to forward
- **Shared Actions**: `$lib/actions/srcObject.ts` binds MediaStream to video/audio elements
- **State Management**: Svelte writable/derived stores in `$lib/stores/callState.ts`
- **Barrel Exports**: Each component directory has an `index.ts` for clean imports

## Component Map
- `call/` – CallInterface → VideoGrid, FeaturedView, MobileCarousel, ControlDock, ChatPanel
- `feed/` – Feed → PostCreator, FeedPost
- `settings/` – SettingsModal → VoiceSettings, ProfileSettings
- `sidebar/` – Sidebar → FriendRequests, FriendsList, AddFriendForm
- `dashboard/` – Sidebar, ChannelList
- `modals/` – SettingsModal, CreateRoomModal, IncomingCallModal, InviteModal

## Development
- `npm run dev` – Dev server (HTTPS on localhost:5173)
- `npm run build` – Production build
- `npm run check` – Svelte type checking
- `docker-compose up -d` – Start PostgreSQL
- `npx drizzle-kit push` – Push DB schema
