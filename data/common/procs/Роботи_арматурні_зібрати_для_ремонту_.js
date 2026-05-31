({
    name: "Роботи арматурні зібрати для ремонту ",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // - check data section -
        // leave blank now, there are no data validation stages yet

        // - row clause section -
        output.push(mkRow({name: "Розібрати «деталь»  для  ремонту", evaluate: tableData["Арматурные работы"]["РАЗОБРАТЬ ДЛЯ РЕМОНТА"], trace: traceRowToTable("Арматурные работы", "РАЗОБРАТЬ ДЛЯ РЕМОНТА"), tooltip: "Just mount part"}));
        output.push(mkRow({name: "Зібрати «деталь»  після  ремонту ", evaluate: tableData["Арматурные работы"]["СОБРАТЬ ДЛЯ РЕМОНТА"], trace: traceRowToTable("Арматурные работы", "СОБРАТЬ ДЛЯ РЕМОНТА"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Арматурные работы"],
    requiredRepairTypes: ["Ремонт з зовнішнім фарбуванням","Ремонт без фарбування","Розтонування фарби","Ремонт з фарбуваням 2 сторони"],
    requiredFiles: [],
    category: "General",
    orderingNum: 200
})