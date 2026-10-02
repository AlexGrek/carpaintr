({
    name: "РАБОТЫ  АРМАТУРНЫЕ  СНЯТИЕ УСТАНОВКА ДЛЯ РЕМОНТА",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // - check data section -
        // leave blank now, there are no data validation stages yet

        // - row clause section -
        output.push(mkRow({key: "clause-262e901a55b4fc30", name: "Зняти «Деталь» для ремонту", evaluate: tableData["Арматурные работы"]["СНЯТИЕ ДЛЯ РЕМОНТА"], tooltip: "Арматурные работы снять", trace: traceRowToTable("Арматурные работы", "СНЯТИЕ ДЛЯ РЕМОНТА")}));
        output.push(mkRow({key: "clause-c926dade7b666880", name: "Встановити «Деталь» після ремонту", evaluate: tableData["Арматурные работы"]["УСТАНОВКА ДЛЯ РЕМОНТА"], tooltip: "Just paint part", trace: traceRowToTable("Арматурные работы", "УСТАНОВКА ДЛЯ РЕМОНТА")}));

        // - final section -
        return output;
    },
    requiredTables: ["Арматурные работы"],
    requiredRepairTypes: ["Розтонування фарби","Ремонт з зовнішнім фарбуванням","Ремонт з фарбуваням 2 сторони"],
    requiredFiles: [],
    category: "General",
    orderingNum: 100
})