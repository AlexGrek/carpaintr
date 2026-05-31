({
    name: "Видалення ЛКП",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // % пошкодження фарби = (квадрати ремонту + квадрати ушкодження фарби поза зоною ремонту) / всього квадратів * 100
        // Округлення: до найближчого з рівнів 10, 20, 25, 30, 50, 75, 100
        // TODO: replace placeholder with actual grid data once available in processor API.
        var damagePercent = 50; // placeholder — must be calculated from grid input
        var roundedPercent;
        if (damagePercent <= 10)      roundedPercent = 10;
        else if (damagePercent <= 20) roundedPercent = 20;
        else if (damagePercent <= 25) roundedPercent = 25;
        else if (damagePercent <= 30) roundedPercent = 30;
        else if (damagePercent <= 50) roundedPercent = 50;
        else if (damagePercent <= 75) roundedPercent = 75;
        else                           roundedPercent = 100;

        output.push(mkRow({
            name: "Видалення лакофарби " + roundedPercent + "% «деталь»",
            evaluate: tableData["удаление поврежденной краски"][String(roundedPercent)], trace: traceRowToTable("удаление поврежденной краски", String(roundedPercent)),
            tooltip: roundedPercent + "% ушкодження фарби"
        }));

        // - final section -
        return output;
    },
    requiredTables: ["удаление поврежденной краски"],
    requiredRepairTypes: ["Ремонт з зовнішнім фарбуванням","Ремонт з фарбуваням 2 сторони"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1400
})
