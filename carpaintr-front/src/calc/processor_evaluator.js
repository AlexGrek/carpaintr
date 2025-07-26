import { isNumber } from "lodash";


export const defaultProcessor = {
    name: "",
    run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        // - init section =
        var output = [];

        // - final section -
        return output;
    },
    requiredTables: [],
    shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint) => {
        return true;
    },
    requiredRepairTypes: [],
    requiredFiles: [],
    category: "",
    orderingNum: 0
}

function sortProcessorsByOrderingNum(processors) {
    processors.sort((a, b) => a.orderingNum - b.orderingNum);
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

export function should_evaluate_processor(processor, stuff) {
    const { carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint } = stuff;
    try {
        const shouldRun = processor.shouldRun(make_sandbox(), carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint);
        return shouldRun;
    } catch (e) {
        console.error("Table skipped due to error in shouldRun: ", processor.name);
        console.error(e);
        return false;
    }

export function evaluate_processor(processor, stuff) {
    const { carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint } = stuff;
    try {
        const resultRows = processor.run(make_sandbox(), carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint);
        let processedRows = resultRows.map((item) => {
            if (!isEmptyOrWhitespace(item.evaluate)) {
                // evaluate!
                console.log("evaluating", item.evaluate.replace(",", "."));
                let estimation = eval(item.evaluate.replace(",", "."));
                console.log("result =", estimation);
                if (!isNumber(estimation)) {
                    estimation = "[error]"
                }
                return {...item, estimation: estimation};
            };
            return item;
        })
        return {
            name: processor.name,
            result: processedRows,
            text: resultRows.map(JSON.stringify).join(';'),
            error: null
        }
    } catch (e) {
        return {
            name: processor.name,
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