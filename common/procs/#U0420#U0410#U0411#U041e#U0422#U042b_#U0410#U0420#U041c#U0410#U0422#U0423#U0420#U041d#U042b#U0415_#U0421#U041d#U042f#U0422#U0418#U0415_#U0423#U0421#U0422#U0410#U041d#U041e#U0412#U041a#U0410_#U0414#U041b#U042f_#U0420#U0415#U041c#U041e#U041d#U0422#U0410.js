({
    name: "РАБОТЫ  АРМАТУРНЫЕ  СНЯТИЕ УСТАНОВКА ДЛЯ РЕМОНТА",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        // - init section -
        var output = [];
        const { mkRow } = x;

        // - check data section -
        // leave blank now, there are no data validation stages yet

        // - row clause section -
        output.push(mkRow({name: "Зняти «Деталь» для ремонту", evaluate: tableData["Арматурные работы"]["СНЯТИЕ ДЛЯ РЕМОНТА"], tooltip: "Арматурные работы снять"}));
        output.push(mkRow({name: "Встановити «Деталь» після ремонту", evaluate: tableData["Арматурные работы"]["УСТАНОВКА ДЛЯ РЕМОНТА"], tooltip: "Just paint part"}));

        // - final section -
        return output;
    },
    requiredTables: ["Арматурные работы"],
    requiredRepairTypes: ["toning","paint_one_side","paint_two_sides"],
    requiredFiles: [],
    category: "General",
    orderingNum: 100
})