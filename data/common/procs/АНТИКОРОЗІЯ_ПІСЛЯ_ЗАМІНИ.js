({
    name: "Антикорозійна обробка після заміни",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // Only for metal parts with high-quality service level
        // TODO: restrict to "метал" material once material param is available
        var quality = pricing && pricing.quality || "";
        return quality.indexOf("офіційного СТО") !== -1 || quality.indexOf("Офіційне СТО") !== -1;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // н.г. from Таблица 1, column "н.ч. антикор"
        output.push(mkRow({name: "Антикорозійна обробка «деталь»", evaluate: tableData["Таблица 1"]["н.ч. антикор"], trace: traceRowToTable("Таблица 1", "н.ч. антикор"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Таблица 1"],
    requiredRepairTypes: ["Заміна  оригінал деталь з фарбуванням","Заміна Не оригінал деталь з фарбуванням"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1810
})
