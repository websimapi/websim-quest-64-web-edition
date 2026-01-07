export class PlayerStats {
    constructor() {
        this.spirits = {
            fire: 1,
            water: 1,
            earth: 1,
            wind: 1
        };

        this.xp = 0;
        this.nextLevelXp = 50;
        this.level = 1;

        // Current and Max stats
        this.hp = 55;
        this.maxHp = 55;
        this.mp = 24;
        this.maxMp = 24;

        this.recalcStats();
    }

    recalcStats() {
        this.maxHp = 50 + (this.spirits.earth * 5);
        this.maxMp = 20 + (this.spirits.water * 2) + (this.spirits.wind * 2);
        
        // Clamp current stats so they don't exceed new max
        this.hp = Math.min(this.hp, this.maxHp);
        this.mp = Math.min(this.mp, this.maxMp);
    }

    takeDamage(amount, element) {
        // Resistance: Specific Element Spirit Level reduces damage from that element
        // Formula: Diminishing returns (100% / (100% + Spirit*5%))
        if (element && this.spirits[element]) {
            const factor = 1.0 / (1.0 + (this.spirits[element] * 0.05));
            amount *= factor;
        }

        // Earth provides flat physical/general mitigation (Defense)
        const defense = this.spirits.earth * 0.25;
        amount = Math.max(1, amount - defense);

        this.hp -= Math.floor(amount);
    }

    gainXp(amount) {
        this.xp += amount;
        let leveled = false;
        while (this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp;
            this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
            leveled = true;
        }
        return leveled;
    }

    regenMp(dt) {
        // Base regen + water bonus
        const rate = 0.15 + (this.spirits.water * 0.08);
        this.mp = Math.min(this.maxMp, this.mp + rate * dt);
    }
}