<script lang="ts">
    import { enhance } from '$app/forms';
    import { t } from '$lib/i18n';
    import { get } from 'svelte/store';

    export let user: any;

    let updateUsername = user.username;
    let updateDisplayName = user.displayName || user.username;
</script>

<div style="display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 20px 0;">
    <img
        src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${user.username}`}
        alt="Current Avatar"
        style="width: 128px; height: 128px; border-radius: 50%; background: #2f3136; padding: 4px; border: 4px solid #5865f2;"
    />

    <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 32px;">
        <!-- Display Name Form -->
        <form method="POST" action="?/updateDisplayName" use:enhance={() => {
            // @ts-ignore
            return async ({ result }) => {
                if (result.type === 'success') {
                    alert(get(t)('profile.nicknameSuccess'));
                    location.reload();
                } else if (result.type === 'failure') {
                    alert(result.data?.error || get(t)('profile.nicknameFail'));
                }
            };
        }}>
            <div class="form-group">
                <label style="color: #b9bbbe; text-transform: uppercase; font-size: 12px; font-weight: 700; margin-bottom: 8px; display: block;">{$t('profile.displayName')}</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" name="displayName" bind:value={updateDisplayName} required
                        style="flex: 1; padding: 10px; background: #202225; border: 1px solid #202225; border-radius: 4px; color: white; font-size: 14px;"
                        placeholder={$t('profile.displayNamePlaceholder')} />
                    <button type="submit" class="btn-primary" style="width: auto; padding: 0 16px;">{$t('profile.save')}</button>
                </div>
            </div>
        </form>

        <div style="height: 1px; background: #2f3136; width: 100%;"></div>

        <!-- Username Form -->
        <form method="POST" action="?/updateUsername" use:enhance={() => {
            // @ts-ignore
            return async ({ result }) => {
                if (result.type === 'success') {
                    alert(get(t)('profile.usernameSuccess'));
                    location.reload();
                } else if (result.type === 'failure') {
                    alert(result.data?.error || get(t)('profile.usernameFail'));
                }
            };
        }}>
            <div class="form-group">
                <label style="color: #b9bbbe; text-transform: uppercase; font-size: 12px; font-weight: 700; margin-bottom: 8px; display: block;">{$t('profile.loginUsername')}</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" name="username" bind:value={updateUsername} minlength="3" required
                        style="flex: 1; padding: 10px; background: #202225; border: 1px solid #202225; border-radius: 4px; color: white; font-size: 14px;"
                        placeholder={$t('profile.usernamePlaceholder')} />
                    <button type="submit" class="btn-secondary" style="width: auto; padding: 0 16px; background-color: #ed4245; color: white;">{$t('profile.update')}</button>
                </div>
                <p style="font-size: 12px; color: #b9bbbe; margin-top: 8px;">
                    <i class="fas fa-info-circle"></i> {$t('profile.usernameWarning')}
                </p>
            </div>
        </form>
    </div>
</div>

<style>
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .btn-primary { background: #5865f2; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .btn-primary:hover { background: #4752c4; }
    .btn-secondary { background: transparent; color: #fff; border: none; padding: 10px 20px; cursor: pointer; }
    .btn-secondary:hover { text-decoration: underline; }
</style>
