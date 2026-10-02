({
    name: "Обробка зварювальних швів",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // - row clause section -
        output.push(mkRow({key: "clause-5ffc7ab8051c28d1", name: "Обробка оловом зварювальних швів «деталь»", evaluate: tableData["Обробка зварювальних швів"]["н.г. обробка оловом"], trace: traceRowToTable("Обробка зварювальних швів", "н.г. обробка оловом"), tooltip: ""}));
        output.push(mkRow({key: "clause-6073f421dadefb27", name: "Обробка епоксидною шпаклівкою зварювальних швів «деталь»", evaluate: tableData["Обробка зварювальних швів"]["н.г. обробка епоксидною шпаклівкою"], trace: traceRowToTable("Обробка зварювальних швів", "н.г. обробка епоксидною шпаклівкою"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Обробка зварювальних швів"],
    requiredRepairTypes: ["Заміна  оригінал деталь з фарбуванням","Заміна Не оригінал деталь з фарбуванням"],
    requiredFiles: [],
    category: "body",
    orderingNum: 700
})
