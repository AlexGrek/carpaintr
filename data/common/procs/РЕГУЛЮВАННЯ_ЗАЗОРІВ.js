({
    name: "Регулювання зазорів",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // Branch by repair type to select the correct column
        var col;
        if (repairAction === "Заміна  оригінал деталь з фарбуванням") {
            col = "Зазори Заміна оригінал деталь";
        } else if (repairAction === "Заміна Не оригінал деталь з фарбуванням") {
            col = "Зазри Заміна Неоригінал деталь";
        } else {
            // Ремонт з зовнішнім фарбуванням / Ремонт з фарбуваням 2 сторони / Ремонт без фарбування
            col = "Зазори ремонт";
        }

        output.push(mkRow({name: "Регулювання зазорів «деталь»", evaluate: tableData["Работы регулировка зазоров"][col], trace: traceRowToTable("Работы регулировка зазоров", col), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Работы регулировка зазоров"],
    requiredRepairTypes: [
        "Заміна  оригінал деталь з фарбуванням",
        "Заміна Не оригінал деталь з фарбуванням",
        "Ремонт з зовнішнім фарбуванням",
        "Ремонт з фарбуваням 2 сторони",
        "Ремонт без фарбування"
    ],
    requiredFiles: [],
    category: "General",
    orderingNum: 600
})
