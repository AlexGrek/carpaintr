({
    name: "Антикорозійна обробка несъемних деталей при заміні",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // Only for standard quality (not high-end) with replacement repair type
        // TODO: restrict to "несъемна деталь" once removability is available in processor API
        var quality = pricing && pricing.quality || "";
        var isHighQuality = quality.indexOf("офіційного СТО") !== -1 || quality.indexOf("Офіційне СТО") !== -1;
        return !isHighQuality;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // константа: н.г. змена несъемних антикор = 0.4
        output.push(mkRow({name: "Антикорозійна обробка зварювання «деталь» (заміна несъемна)", evaluate: "0.4", tooltip: "Константа: 0.4 н.г."}));

        // - final section -
        return output;
    },
    requiredTables: [],
    requiredRepairTypes: ["Заміна  оригінал деталь з фарбуванням","Заміна Не оригінал деталь з фарбуванням"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1830
})
