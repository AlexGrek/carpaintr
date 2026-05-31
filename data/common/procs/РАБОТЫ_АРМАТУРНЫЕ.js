({
    name: "Зняти встановити для заміни",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // - row clause section -
        output.push(mkRow({name: "Зняти «деталь»  для  заміни", evaluate: tableData["Арматурные работы"]["СНЯТИЕ ДЛЯ ЗАМЕНЫ"], trace: traceRowToTable("Арматурные работы", "СНЯТИЕ ДЛЯ ЗАМЕНЫ"), tooltip: ""}));
        output.push(mkRow({name: "Встановити «деталь»  після  заміни", evaluate: tableData["Арматурные работы"]["УСТАНОВКА ДЛЯ ЗАМЕНЫ"], trace: traceRowToTable("Арматурные работы", "УСТАНОВКА ДЛЯ ЗАМЕНЫ"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Арматурные работы"],
    requiredRepairTypes: ["Заміна Не оригінал деталь з фарбуванням","Заміна  оригінал деталь з фарбуванням","Заміна без фарбування"],
    requiredFiles: [],
    category: "General",
    orderingNum: 400
})
