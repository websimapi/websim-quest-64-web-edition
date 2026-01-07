import { } from 'three'; // kept for future UI-related 3D hooks if needed

export class UIManager {
    constructor(player, combatSystem) {
        this.player = player;
        this.combatSystem = combatSystem;

        this.hpBar = document.getElementById('hp-bar');
        this.mpBar = document.getElementById('mp-bar');
        this.spiritStats = document.getElementById('spirit-stats');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.moveBarContainer = document.getElementById('move-bar-container');
        this.moveBarFill = document.getElementById('move-bar-fill');
        this.messageBox = document.getElementById('message-box');
        this.levelupOverlay = document.getElementById('levelup-overlay');

        this.messageTimer = null;
    }

    update(gameState, combatSystem) {
        this.updateStats();
        this.updateBattleHud(gameState, combatSystem);
    }

    updateStats() {
        if (!this.player) return;
        const { hp, maxHp, mp, maxMp } = this.player.stats;
        const s = this.player.spirits;

        if (this.hpBar) {
            this.hpBar.innerText = `HP: ${Math.floor(hp)}/${maxHp}`;
        }
        if (this.mpBar) {
            this.mpBar.innerText = `MP: ${Math.floor(mp)}/${maxMp}`;
        }
        if (this.spiritStats) {
            this.spiritStats.innerHTML =
                `<span style="color:#d32f2f">FIRE: ${s.fire}</span><br>` +
                `<span style="color:#1976d2">WATER: ${s.water}</span><br>` +
                `<span style="color:#388e3c">EARTH: ${s.earth}</span><br>` +
                `<span style="color:#fbc02d">WIND: ${s.wind}</span>`;
        }
    }

    updateBattleHud(gameState, combatSystem) {
        if (!this.turnIndicator || !this.moveBarContainer || !this.moveBarFill) return;

        if (gameState === 'BATTLE' && combatSystem) {
            this.turnIndicator.style.display = 'block';
            this.turnIndicator.innerText = combatSystem.turn + " TURN";
            this.turnIndicator.style.color = combatSystem.turn === 'PLAYER' ? '#00ff00' : '#ff0000';

            if (combatSystem.turn === 'PLAYER') {
                this.moveBarContainer.style.display = 'block';
                const pct = Math.max(0, (combatSystem.currentMove / combatSystem.maxMove) * 100);
                this.moveBarFill.style.width = pct + '%';
            } else {
                this.moveBarContainer.style.display = 'none';
            }
        } else {
            this.turnIndicator.style.display = 'none';
            this.moveBarContainer.style.display = 'none';
        }
    }

    showMessage(msg, duration = 0) {
        if (!this.messageBox) return;

        this.messageBox.style.display = msg ? 'block' : 'none';
        this.messageBox.textContent = msg || '';

        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
            this.messageTimer = null;
        }

        if (duration > 0 && msg) {
            this.messageTimer = setTimeout(() => {
                if (!this.messageBox) return;
                this.messageBox.style.display = 'none';
                this.messageBox.textContent = "";
                this.messageTimer = null;
            }, duration);
        }
    }

    showLevelUpMenu(onElementChosen) {
        if (!this.levelupOverlay) return;

        const overlay = this.levelupOverlay;
        const infoP = overlay.querySelector('p');
        if (infoP) {
            infoP.innerText = "Grant 1 Spirit Point to an element:";
        }
        overlay.style.display = 'flex';

        const cleanup = () => {
            overlay.style.display = 'none';
            ['lvl-fire', 'lvl-water', 'lvl-earth', 'lvl-wind'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.onclick = null;
            });
        };

        const handler = (elementKey) => {
            if (typeof onElementChosen === 'function') {
                onElementChosen(elementKey);
            }
            cleanup();
        };

        const fireBtn = document.getElementById('lvl-fire');
        const waterBtn = document.getElementById('lvl-water');
        const earthBtn = document.getElementById('lvl-earth');
        const windBtn = document.getElementById('lvl-wind');

        if (fireBtn) fireBtn.onclick = () => handler('fire');
        if (waterBtn) waterBtn.onclick = () => handler('water');
        if (earthBtn) earthBtn.onclick = () => handler('earth');
        if (windBtn) windBtn.onclick = () => handler('wind');
    }
}