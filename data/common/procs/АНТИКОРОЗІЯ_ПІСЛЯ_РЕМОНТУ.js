({
    name: "Антикорозійна обробка зварювання після ремонту",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // Only for metal parts where "Розрив" deformation was selected in grid
        // TODO: restrict to "метал" material and check for "Розрив" in grid deformation data
        //       once both are available in processor API. Currently always runs.
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // константа: н.г. Розрив антикор = 0.3
        output.push(mkRow({name: "Антикорозійна обробка зварювання «деталь»", evaluate: "0.3", tooltip: "Константа: 0.3 н.г."}));

        // - final section -
        return output;
    },
    requiredTables: [],
    requiredRepairTypes: ["Ремонт з зовнішнім фарбуванням","Ремонт з фарбуваням 2 сторони"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1820
})
