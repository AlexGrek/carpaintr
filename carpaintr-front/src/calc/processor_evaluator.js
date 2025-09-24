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
    const { carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing } = stuff;
    try {
        const shouldRun = processor.shouldRun(make_sandbox(), carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing);
        return shouldRun;
    } catch (e) {
        console.error("Table skipped due to error in shouldRun: ", processor.name);
        console.error(e);
        return false;
    }
}

export function evaluate_processor(processor, stuff) {
    const { carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing } = stuff;
    try {
        const resultRows = processor.run(make_sandbox(), carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing);
        let processedRows = resultRows.map((item) => {
            if (!isEmptyOrWhitespace(item.evaluate)) {
                // evaluate!
                console.log("evaluating", item.evaluate.replace(",", "."));
                let estimation = eval(item.evaluate.replace(",", "."));
                console.log("result =", estimation);
                if (!isNumber(estimation)) {
                    estimation = "[error]"
                }
                return { ...item, estimation: estimation, name: process_name_string(item.name, stuff) };
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

export function is_supported_repair_type(processor, repairAction) {
    const found = processor.requiredRepairTypes.indexOf(repairAction);
    return found >= 0;
}

export function verify_processor(processor) {
    return { ...defaultProcessor, ...processor }
}

export function process_name_string(input, stuff) {
    const redefinitions = { "деталь": stuff.carPart };
    return applyRedefinitions(redefinitions, input);
}

/**
 * Replaces words enclosed in «...» or "..." with their redefined values.
 *
 * The function scans the input string for substrings wrapped in either
 * guillemets («…») or double quotes ("…"). For each found substring, it:
 *   - Normalizes the inner word to lowercase.
 *   - Looks up the word in the `redefinitions` dictionary.
 *   - If found, replaces it with the corresponding value while keeping
 *     the original delimiters (« or ").
 *   - If not found, leaves the substring unchanged.
 *
 * Matching is case-insensitive, but the keys in `redefinitions`
 * must always be lowercase.
 *
 * @param {Object.<string,string>} redefinitions - Dictionary of redefinitions,
 *        where keys are lowercase original terms and values are their replacements.
 * @param {string} input - The input string to process.
 * @returns {string} - The processed string with substitutions applied.
 *
 * @example
 * const redefs = { "деталь": "крило", "двигун": "мотор" };
 * applyRedefinitions(redefs, "Зняти «Деталь» для ремонту");
 * // → "Зняти «крило» для ремонту"
 */
function applyRedefinitions(redefinitions, input) {
    // Regex matches words inside «...» or "..."
    const regex = /[«"]([^«»"]+)[»"]/g;

    return input.replace(regex, (match, inner) => {
        const key = inner.toLowerCase().trim();
        if (redefinitions.hasOwnProperty(key)) {
            // Replace only the inside, keep original delimiters
            const start = match[0];
            const end = match[match.length - 1];
            return start + redefinitions[key] + end;
        }
        return match; // leave unchanged if not found
    });
}
