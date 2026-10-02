({
    name: "Розібрати зібрати для заміни",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // - row clause section -
        output.push(mkRow({key: "clause-94eb001a7a088551", name: "Розібрати «деталь»  для  заміни", evaluate: tableData["Арматурные работы"]["РАЗОБРАТЬ ДЛЯ ЗАМЕНЫ"], trace: traceRowToTable("Арматурные работы", "РАЗОБРАТЬ ДЛЯ ЗАМЕНЫ"), tooltip: ""}));
        output.push(mkRow({key: "clause-1143743a6523e1b0", name: "Зібрати «деталь»  після  заміни", evaluate: tableData["Арматурные работы"]["СОБРАТЬ ДЛЯ ЗАМЕНЫ"], trace: traceRowToTable("Арматурные работы", "СОБРАТЬ ДЛЯ ЗАМЕНЫ"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Арматурные работы"],
    requiredRepairTypes: ["Заміна Не оригінал деталь з фарбуванням","Заміна  оригінал деталь з фарбуванням","Заміна без фарбування"],
    requiredFiles: [],
    category: "arm",
    orderingNum: 300
})
