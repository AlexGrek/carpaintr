({
    name: "Рихтування",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // Formula: н.г = sum(норма * кількість квадратів по типу деформації) + константа добавочная рихтовка
        // TODO: multiply norm by actual square count per deformation type once grid data is available in processor API.
        // Currently passes the per-square norm value directly (multiplier = 1).

        // TODO: branch by material type (метал / алюміній / пластик / інше) once material param is available.
        // Currently outputs all material rows; remove irrelevant ones once material selection is wired.
        output.push(mkRow({name: "Рихтування «деталь» (метал)", evaluate: tableData["нормы ремонта на 1 квадрат"]["рихтовка металл"], trace: traceRowToTable("нормы ремонта на 1 квадрат", "рихтовка металл"), tooltip: "Значення на 1 квадрат"}));
        output.push(mkRow({name: "Рихтування алюмінію «деталь»", evaluate: tableData["нормы ремонта на 1 квадрат"]["рихтовка алюминий"], trace: traceRowToTable("нормы ремонта на 1 квадрат", "рихтовка алюминий"), tooltip: "Значення на 1 квадрат"}));
        output.push(mkRow({name: "Ремонт пластика «деталь»", evaluate: tableData["нормы ремонта на 1 квадрат"]["ремонт пластик"], trace: traceRowToTable("нормы ремонта на 1 квадрат", "ремонт пластик"), tooltip: "Значення на 1 квадрат"}));
        output.push(mkRow({name: "Ремонт «деталь» (інше)", evaluate: tableData["нормы ремонта на 1 квадрат"]["рихтовка інше"], trace: traceRowToTable("нормы ремонта на 1 квадрат", "рихтовка інше"), tooltip: "Значення на 1 квадрат"}));

        // - final section -
        return output;
    },
    requiredTables: ["нормы ремонта на 1 квадрат"],
    requiredRepairTypes: ["Ремонт з зовнішнім фарбуванням","Ремонт з фарбуваням 2 сторони","Ремонт без фарбування"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1200
})
