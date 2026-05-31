({
    name: "Шпаклювання",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // Formula: н.г = sum(норма шпаклювання * кількість квадратів) + константа добавочная шпаклевание
        // TODO: multiply norm by actual square count once grid data is available in processor API.
        output.push(mkRow({name: "Шпаклювання «деталь»", evaluate: tableData["нормы ремонта на 1 квадрат"]["шпаклювання"], trace: traceRowToTable("нормы ремонта на 1 квадрат", "шпаклювання"), tooltip: "Значення на 1 квадрат"}));

        // - final section -
        return output;
    },
    requiredTables: ["нормы ремонта на 1 квадрат"],
    requiredRepairTypes: ["Ремонт з зовнішнім фарбуванням","Ремонт з фарбуваням 2 сторони"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1300
})
