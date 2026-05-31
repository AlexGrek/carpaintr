({
    name: "Фарбування",
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        return true;
    },
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
        // - init section -
        var output = [];
        const { mkRow, traceRowToTable } = x;

        var isReplacement = repairAction === "Заміна  оригінал деталь з фарбуванням" || repairAction === "Заміна Не оригінал деталь з фарбуванням";
        var isRepair      = repairAction === "Ремонт з зовнішнім фарбуванням" || repairAction === "Ремонт з фарбуваням 2 сторони";

        // Яскравий колір: colors prefixed with "Яскрав" (bright)
        var isBrightColor = paint && paint.toLowerCase().indexOf("яскрав") !== -1;

        // 3-шарове фарбування
        var isThreeLayer = pricing && pricing.paintType && pricing.paintType.indexOf("3шарове") !== -1;

        // Висока якість: Наближена до офіційного СТО або Офіційне СТО
        var isHighQuality = pricing && pricing.quality && (
            pricing.quality.indexOf("офіційного СТО") !== -1 ||
            pricing.quality.indexOf("Офіційне СТО") !== -1
        );

        var needsPrimer = isBrightColor || isThreeLayer || isHighQuality;

        // Condition 1: replacement — add primary priming and primer in color
        // TODO: restrict to "знімна деталь" once removability is available in processor API
        if (isReplacement) {
            output.push(mkRow({name: "Грунтування первинне «деталь»", evaluate: tableData["Нормы материалов и работ для покраски"]["н.ч. грунтование первичное"], trace: traceRowToTable("Нормы материалов и работ для покраски", "н.ч. грунтование первичное"), tooltip: ""}));
        }

        // Condition 2: bright color / 3-layer / high quality — add primer in color tone
        if (needsPrimer) {
            output.push(mkRow({name: "Грунтування в тон фарби «деталь»", evaluate: tableData["Нормы материалов и работ для покраски"]["н.ч. грунтование в цвет"], trace: traceRowToTable("Нормы материалов и работ для покраски", "н.ч. грунтование в цвет"), tooltip: ""}));
        }

        // Painting (all conditions)
        output.push(mkRow({name: "Фарбування «деталь»", evaluate: tableData["Нормы материалов и работ для покраски"]["н.ч. покраска"], trace: traceRowToTable("Нормы материалов и работ для покраски", "н.ч. покраска"), tooltip: ""}));
        output.push(mkRow({name: "Фарба 1 шар «деталь»", evaluate: tableData["Нормы материалов и работ для покраски"]["расход л. краски1"], trace: traceRowToTable("Нормы материалов и работ для покраски", "расход л. краски1"), tooltip: "л"}));
        output.push(mkRow({name: "Фарба 2 шар «деталь»", evaluate: tableData["Нормы материалов и работ для покраски"]["расход л. краски2"], trace: traceRowToTable("Нормы материалов и работ для покраски", "расход л. краски2"), tooltip: "л"}));
        output.push(mkRow({name: "Лак «деталь»", evaluate: tableData["Нормы материалов и работ для покраски"]["расхода л. Лак"], trace: traceRowToTable("Нормы материалов и работ для покраски", "расхода л. Лак"), tooltip: "л"}));

        // Condition 3 (standard quality, non-bright): add aerosol primer
        if (!needsPrimer && !isReplacement) {
            output.push(mkRow({name: "Грунт аерозольний", evaluate: tableData["Нормы материалов и работ для покраски"]["грунт аерозольний"], trace: traceRowToTable("Нормы материалов и работ для покраски", "грунт аерозольний"), tooltip: "30мл"}));
        }

        // - final section -
        return output;
    },
    requiredTables: ["Нормы материалов и работ для покраски"],
    requiredRepairTypes: [
        "Заміна  оригінал деталь з фарбуванням",
        "Заміна Не оригінал деталь з фарбуванням",
        "Ремонт з зовнішнім фарбуванням",
        "Ремонт з фарбуваням 2 сторони",
        "Розтонування фарби"
    ],
    requiredFiles: [],
    category: "General",
    orderingNum: 1600
})
