class LanguageManager {
    constructor(basePath = './language/') {
        this.basePath = basePath;
        this.currentLang = 'zh_tw'; // 預設語言
    }

    async getAugmentData() {
        // 1. 從網址取得語言參數 (?lang=...)
        const urlParams = new URLSearchParams(window.location.search);
        this.currentLang = urlParams.get('lang') || 'zh_tw';

        // 2. 建立完整的檔案路徑
        const filePath = `${this.basePath}${this.currentLang}.json`;

        try {
            console.log(`[LanguageManager] 正在載入語言檔: ${filePath}`);
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error(`無法載入檔案: ${response.status} (路徑可能錯誤)`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("[LanguageManager] 錯誤:", error);
            
            // 保底機制：如果載入失敗，嘗試載入預設的 zh_tw
            if (this.currentLang !== 'zh_tw') {
                console.warn("[LanguageManager] 嘗試載入保底語言: zh_tw");
                const fallbackResponse = await fetch(`${this.basePath}zh_tw.json`);
                return await fallbackResponse.json();
            }
            return []; // 若連保底都失敗則回傳空陣列
        }
    }

    async getAugmentSets() {

        // 1. 從網址取得語言參數 (?lang=...)
        const urlParams = new URLSearchParams(window.location.search);
        this.currentLang = urlParams.get('lang') || 'zh_tw';

        const fileSetsPath = `${this.basePath}AugmentSets/${this.currentLang}.json`;
        console.log(`[LanguageManager] 正在載入語言檔: ${fileSetsPath}`);
        try {
            const response = await fetch(fileSetsPath);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // 讀取並存入
            const rawData = await response.json();
            console.log("JSON 資料載入成功", rawData);
            // 在這裡直接轉換格式
            this.augmentsSet = rawData.reduce((acc, item) => {
                const setName = item["Set name"];
                
                // 建立你的格式
                acc[setName] = {
                    "description": item["Set bonus"],
                    "2": item["Effectiveness at double(2 set)"],
                    "3": item["Effectiveness at triple(3 set)"],
                    "4": item["Effectiveness at quadruple(4 set)"],
                    "SetNameTranslation": item["SetNameTranslation"]
                };
                return acc; // 每一輪都要回傳 acc
            }, {}); 
        } catch (error) {
            console.error("無法讀取 aram-augment-wiki.json:", error);
            this.augmentsSet = []; 
        }
        console.log("this.augmentsSet", this.augmentsSet);
        return this.augmentsSet;
    }

    getLangCode() {
        return this.currentLang;
    }
}