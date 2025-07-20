

export const defaultProcessor = {
    name: "",
    run: (carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        // - init section =
        var output = [];

        // - final section -
        return output;
    },
    requiredTables: [],
    requiredRepairTypes: [],
    requiredFiles: [],
    category: "",
    orderingNum: 0
}

const defaultRow = {
    name: "", evaluate: "", tooltip: ""
}

export function mkRow(obj) {
    return { ...defaultRow, ...obj }
}

export function make_sandbox() {
    return {
        mkRow: (obj) => mkRow(obj)
    }
}

export function make_sandbox_extensions() {
    return {
        x: { ...make_sandbox() }
    }
}

export function isEmptyOrWhitespace(str) {
    return !str || str.trim().length === 0;
}

export function evaluate_processor(processor, stuff) {
    const { carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint } = stuff;
    try {
        const resultRows = processor.run(make_sandbox(), carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint);
        let processedRows = resultRows.map((item) => {
            if (!isEmptyOrWhitespace(item.evaluate)) {
                // evaluate!
                return eval(item.evaluate);
            }
        })
        return {
            result: processedRows,
            text: resultRows.map(JSON.stringify).join(';'),
            error: null
        }
    } catch (e) {
        return {
            result: null,
            text: e.toString(),
            error: e,
        }
    }
}

export function validate_requirements(processor, tableData) {
    for (const table of processor.requiredTables) {
        if (!Object.hasOwn(tableData, table)) {
            return table;
        }
    }
    return null;
}

export function verify_processor(processor) {
    return { ...defaultProcessor, ...processor }
}