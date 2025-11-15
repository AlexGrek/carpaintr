const evalRow = (table, prop, text) => {
  const expression = table[prop];
  try {
    const result = eval(expression);
    return {
      result: result,
      text: text,
      error: null,
      expression: expression,
    };
  } catch (e) {
    return {
      result: null,
      text: text,
      error: e,
      expression: expression,
    };
  }
};

export const partRemovalAndInstallation = {
  name: "Part removal and installation",
  requiredTables: ["t1", "partRemovalInstallation"],
  process: (tables) => {
    const t1 = tables["t1"];
    return [
      evalRow(t1, "Снятие", "Снятие детали " + t1["Список деталь укр"]),
      evalRow(t1, "Установка", "Установка детали " + t1["Список деталь укр"]),
    ];
  },
};
