({
    name: "Грунтування після рихтовки",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        // Runs when % пошкодження != 0 (always assumed non-zero here)
        // TODO: skip if grid damage % == 0 once grid data is available

        // TODO: branch by material type for "Грунтування первинне":
        //   метал → грунт по металу, алюміній → грунт по алюмінію, пластик → грунт по пластику
        output.push(mkRow({name: "Грунтування первинне «деталь» зовні", evaluate: tableData["Нормы материалов и работ для покраски"]["н.г грунтування первинне"], trace: traceRowToTable("Нормы материалов и работ для покраски", "н.г грунтування первинне"), tooltip: ""}));
        output.push(mkRow({name: "Грунтування порозаповнювачем «деталь» зовні", evaluate: tableData["Нормы материалов и работ для покраски"]["н.г грунтування порозаповнювачем"], trace: traceRowToTable("Нормы материалов и работ для покраски", "н.г грунтування порозаповнювачем"), tooltip: ""}));
        output.push(mkRow({name: "Шліфування для фарбування «деталь»", evaluate: tableData["Нормы материалов и работ для покраски"]["н.г шліфування для фарбування"], trace: traceRowToTable("Нормы материалов и работ для покраски", "н.г шліфування для фарбування"), tooltip: ""}));

        // - final section -
        return output;
    },
    requiredTables: ["Нормы материалов и работ для покраски"],
    requiredRepairTypes: ["Ремонт з зовнішнім фарбуванням","Ремонт з фарбуваням 2 сторони"],
    requiredFiles: [],
    category: "General",
    orderingNum: 1500
})
