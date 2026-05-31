({
    name: "Полірування після фарбування",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // Only run if the part has a non-zero polishing norm
        var norm = tableData["Таблица 1"] && tableData["Таблица 1"]["н.ч. полировка после покраски"];
        if (!norm || parseFloat(norm) === 0) return false;

        // Only for qualifying quality levels
        var quality = pricing && pricing.quality || "";
        return quality.indexOf("полірування") !== -1 ||
               quality.indexOf("офіційного СТО") !== -1 ||
               quality.indexOf("Офіційне СТО") !== -1;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        output.push(mkRow({name: "Полірування після фарбування «деталь»", evaluate: tableData["Таблица 1"]["н.ч. полировка после покраски"], trace: traceRowToTable("Таблица 1", "н.ч. полировка после покраски"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Таблица 1"],
    requiredRepairTypes: [
        "Заміна  оригінал деталь з фарбуванням",
        "Заміна Не оригінал деталь з фарбуванням",
        "Ремонт з зовнішнім фарбуванням",
        "Ремонт з фарбуваням 2 сторони"
    ],
    requiredFiles: [],
    category: "General",
    orderingNum: 1700
})
