({
    name: "Обробка герметиком",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // - row clause section -
        output.push(mkRow({name: "Обробка герметиком «деталь»", evaluate: tableData["Обробка герметиком"]["н.г. обробка герметиком"], trace: traceRowToTable("Обробка герметиком", "н.г. обробка герметиком"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Обробка герметиком"],
    requiredRepairTypes: ["Заміна  оригінал деталь з фарбуванням","Заміна Не оригінал деталь з фарбуванням"],
    requiredFiles: [],
    category: "General",
    orderingNum: 800
})
