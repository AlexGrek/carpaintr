({
    name: "СНЯТИЕ УСТАНОВКА ДЛЯ РЕМОНТА",
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
        output.push(mkRow({key: "clause-a27139c5ccee9d2d", name: "Зняти «Деталь» для ремонту", evaluate: tableData["Арматурные работы"]["СНЯТИЕ ДЛЯ РЕМОНТА"], trace: traceRowToTable("Арматурные работы", "СНЯТИЕ ДЛЯ РЕМОНТА"), tooltip: "Just mount part"}));
        output.push(mkRow({key: "clause-bf861749f4fe7748", name: "Встановити «Деталь» після ремонту", evaluate: tableData["Арматурные работы"]["УСТАНОВКА ДЛЯ РЕМОНТА"], trace: traceRowToTable("Арматурные работы", "УСТАНОВКА ДЛЯ РЕМОНТА"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Арматурные работы"],
    requiredRepairTypes: ["Ремонт без фарбування","Розтонування фарби","Ремонт з фарбуваням 2 сторони","Ремонт з зовнішнім фарбуванням"],
    requiredFiles: [],
    category: "arm",
    orderingNum: 100
})