({
    name: "Полірування",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        output.push(mkRow({name: "Полірування «деталь»", evaluate: tableData["Таблица 1"]["н.ч. полировка"], trace: traceRowToTable("Таблица 1", "н.ч. полировка"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Таблица 1"],
    requiredRepairTypes: ["Полірування"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1750
})
