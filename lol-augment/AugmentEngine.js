class AugmentEngine {
    constructor(data, augmentsSet) {
        this.allData = data; // 爬蟲抓到的完整 JSON 資料
        this.augmentsSet = augmentsSet; // 增幅裝置組合資料
        this.history = new Set(); // 儲存本局「已選定」的 ID，避免重複出現
        this.labels = new Array(); // 儲存本局有標籤的augmentObj
        this.labelCounts = {} // 儲存各標籤出現次數
        this.seenIds = new Set();
        this.currentTier = null; // 當前這一輪的等級 (銀/金/彩)
        this.currentOptions = []; // 當前畫面上顯示的三張牌
        this.currentOptionsAugments = []; // 當前畫面上顯示的三張牌對應的組合
        this.roundsLeft = 4; // 剩餘總選牌次數
        
        // 定義等級出現權重 (銀:50%, 金:35%, 稜鏡:15%)
        this.tierWeights = {
            "kSilver": 50,
            "kGold": 35,
            "kPrismatic": 15
        };
    }
    getTranslationData(setsName) {
    /**
    setsName = 'Archmage'
    this.augmentsSet = {
        "Archmage": {
            "2": "返還 30% 冷卻時間",
            "3": "(未改變)",
            "4": "(未改變)",
            "description": "任何對戰的堅實靠山。",
            "SetNameTranslation": "大法師"
        },...
    }
    */
    let setData
    setData = this.augmentsSet[setsName]
    return{
            count: 0,
            description: setData.description || "未知",
            2: setData["2"] || "(Unchanged)",
            3: setData["3"] || "(Unchanged)",
            4: setData["4"] || "(Unchanged)",
            SetNameTranslation: setData.SetNameTranslation || "NO"
        }
    }
    /**
     * 更新標籤
     */
    updateAugmentsSet() {
        /**
        this.labelCounts = {
            "Archmage":{
                count: 0,
                description: "未知",
                2: "XXX",
                3: "XXX",
                4: "XXX",
                SetNameTranslation: "..."
            }
        }
         */
        // 確保初始化一個空物件來存放結果
        this.labelCounts = {};
        console.log("this.labelCounts", this.labelCounts)
        console.log("this.augmentsSet:", this.augmentsSet)
        this.labels.forEach(aug => {
            if (aug.label && Array.isArray(aug.label)) {
                aug.label.forEach(l => {
                    console.log("l:", l)
                    if (!this.labelCounts[l]) {
                        // init
                        const setData = this.augmentsSet[l] || {}; 
                        const setsName = l
                        this.labelCounts[l] = this.getTranslationData(setsName)
                    }

                    // 累加計數
                    this.labelCounts[l].count += 1;
                });
            }
        });
        return this.labelCounts;
}
    updateCurrentOptionsAugments(){
        const optsets = []
        this.currentOptionsAugments = []
        for (let i = 0; i < this.currentOptions.length; i++) {
            let oneid
            let one_id_set
            let one_id_labels
            oneid = this.currentOptions[i].id
            one_id_labels = []
            for (let j = 0; j < this.currentOptions[i].label.length; j++) {
                one_id_labels.push(
                    this.getTranslationData(this.currentOptions[i].label[j])
                )
            }
            one_id_set = {
                id: this.currentOptions[i].id,
                label: this.currentOptions[i].label,
                SetNameTranslationArray: one_id_labels,
            }
            optsets.push(one_id_set)
        }
        this.currentOptionsAugments = optsets
        return this.currentOptionsAugments
    }
    
    /**
     * 抽取新的一輪 (3張同等級)
     */
    rollRound() {
        const optsets = []
        if (this.roundsLeft < 0) return null;

        // 1. 隨機決定這一輪的等級
        this.currentTier = this._weightedRandom(this.tierWeights);

        // 2. 從該等級池中過濾出「未被選過」且「不在目前畫面上」的牌
        const pool = this.allData.filter(item => 
            item.rarity === this.currentTier && !this.history.has(item.id) && !this.seenIds.has(item.id)
        );

        // 3. 隨機選出 3 張不重複的牌
        this.currentOptions = this._shuffle(pool).slice(0, 3);

        // 4. 將這一輪的牌加入歷史紀錄
        this.seenIds.add(this.currentOptions[0].id);
        this.seenIds.add(this.currentOptions[1].id);
        this.seenIds.add(this.currentOptions[2].id);

        // 5. 將這一輪的牌尋找到對應組合
        // optsets = [
        //     {
        //         id: 3,
        //         label: ["Archmage"],
        //         SetNameTranslationArray: [{
        //             count: 0,
        //             description: "....",
        //             2: "XXX",
        //             3: "XXX",
        //             4: "XXX",
        //             SetNameTranslation: "d"
        //         }]
        //     }
        // ]

        this.currentOptionsAugments = this.updateCurrentOptionsAugments()
        this.roundsLeft--;

        return {
            tier: this.currentTier,
            options: {
                opt: this.currentOptions,
                optsets: this.currentOptionsAugments
            },
            roundsLeft: this.roundsLeft,
        };
    }

    /**
     * 針對三張卡中的其中一張進行重抽 (Reroll)
     * @param {number} index - 要替換的卡片位置 (0, 1, 2)
     */
    rerollCard(index) {
        if (!this.currentTier) return null;

        const pool = this.allData.filter(item => 
            item.rarity === this.currentTier && 
            !this.history.has(item.id) &&
            !this.seenIds.has(item.id)
        );

        if (pool.length > 0) {
            const newCard = pool[Math.floor(Math.random() * pool.length)];
            this.seenIds.add(newCard.id);
            this.currentOptions[index] = newCard;
            return newCard;
        }
        return null;
    }

    hasLabel(selected, labelName) {
        if (!selected || !selected.labels || !Array.isArray(selected.labels)) {
            return false;
        }
        return selected.labels.includes(labelName);
    }
    /**
     * 當玩家點擊某張卡片確定選擇時
     */
    confirmSelection(index) {
        const selected = this.currentOptions[index];
        this.history.add(selected.id);
        this.labels.push(selected);
        console.log(selected)
        if (this.hasLabel(selected, 'High Roller')) {
            handleSpecialAugments(selected);
        }
        this.updateAugmentsSet();
        return selected;
    }



    /* --- 內部私有工具 --- */

    _weightedRandom(weightMap) {
        const items = Object.keys(weightMap);
        const weights = Object.values(weightMap);
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < items.length; i++) {
            if (r < weights[i]) return items[i];
            r -= weights[i];
        }
    }

    _shuffle(array) {
        return [...array].sort(() => Math.random() - 0.5);
    }

    handleSpecialAugments(selected) {
        switch (selected.id) {
            case 238:
                const prismatic = this.getRandomAugmentByTier("kPrismatic");
                if (prismatic) addExtraAugmentToHistory(prismatic);
                if (prismatic) this.labels.push(prismatic); // 也要加進 labels
                break;

            case 237:
                const gold = this.getRandomAugmentByTier("kGold");
                if (gold) addExtraAugmentToHistory(gold);
                if (gold) this.labels.push(gold); // 也要加進 labels
                break;

            case 243:
                for (let i = 0; i < 2; i++) {
                    const randomTier = this._weightedRandom(this.tierWeights);
                    const randomAug = this.getRandomAugmentByTier(randomTier);
                    if (randomAug) addExtraAugmentToHistory(randomAug);
                    if (randomAug) this.labels.push(randomAug); // 也要加進 labels
                }
                break;

            case 317:
                transformAllSelectedToPrismatic();
                break;

            default:
                console.log("一般增幅裝置，無額外觸發效果。");
                break;
        }
    }

    /**
     * 從指定等級池中隨機抓取「一張」不在歷史紀錄中的牌
     */
    getRandomAugmentByTier(tier) {
        const pool = this.allData.filter(item => 
            item.rarity === tier && !this.seenIds.has(item.id)
        );
        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    transformAllSelectedToPrismatic() {
        const currentHistoryCount = this.history.size;
        this.history.clear();
        this.labels = []
        for (let i = 0; i < currentHistoryCount; i++) {
            const newPrismatic = this.getRandomAugmentByTier("kPrismatic");
            this.labels.push(newPrismatic);
            if (newPrismatic) this.history.add(newPrismatic.id);
        }
        alert("潘朵拉的寶盒觸發！所有增幅裝置已轉化為稜鏡等級。");
    }

    getHistorySelectedCards() {
        return this.allData.filter(item => engine.history.has(item.id));
    }
}
