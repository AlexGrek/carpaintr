({
    name: "Демонтаж монтаж для заміни",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // TODO: branch by material type (метал / алюміній) once material param is available in processor API.
        // Currently outputs both rows; one will be removed once material selection is wired.
        output.push(mkRow({name: "Демонтаж/Монтаж, Зварювання «деталь» (метал)", evaluate: tableData["Работы рихтовочніе демонтаж монтаж"]["МЕТАЛЛ"], trace: traceRowToTable("Работы рихтовочніе демонтаж монтаж", "МЕТАЛЛ"), tooltip: ""}));
        output.push(mkRow({name: "Демонтаж/Монтаж, Зварювання алюмінію «деталь»", evaluate: tableData["Работы рихтовочніе демонтаж монтаж"]["АЛЮМИНИЙ"], trace: traceRowToTable("Работы рихтовочніе демонтаж монтаж", "АЛЮМИНИЙ"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Работы рихтовочніе демонтаж монтаж"],
    requiredRepairTypes: ["Заміна Не оригінал деталь з фарбуванням","Заміна  оригінал деталь з фарбуванням","Заміна без фарбування"],
    requiredFiles: [],
    category: "General",
    orderingNum: 500
})
