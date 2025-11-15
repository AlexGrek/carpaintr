import React, { useCallback, useEffect, useState } from "react";
import { Message, InlineEdit, Panel, Stack, useToaster } from "rsuite";
import "./EvaluationResultsTable.css";
import Trans from "../../localization/Trans";
import { registerTranslations } from "../../localization/LocaleContext";
import { cloneDeep, isArray, isArrayLike, isString } from "lodash";
import InlineEditWrapper from "../layout/InlineEditWrapper";

registerTranslations("ua", {
  Name: "Найменування",
  Estimation: "Оцінка",
  Price: "Ціна",
  Sum: "Сума",
  Total: "Всього",
});

export const EvaluationResultsTable = ({
  data,
  setData = null,
  currency = "",
  basePrice = 1,
  skipIncorrect = false,
}) => {
  const toaster = useToaster();

  const getPrice = useCallback(
    (name) => {
      return basePrice;
    },
    [basePrice],
  );

  const skipIncorrectData = (entry) => {
    if (skipIncorrect) {
      return typeof entry === "object";
    } else {
      return true;
    }
  };

  const updateSums = useCallback(
    (isForced = false) => {
      try {
        if (setData && isArray(data)) {
          if (
            isForced ||
            !data
              .map((table) => {
                if (!isString(table.result)) return table.result;
                return [];
              })
              .every(
                (result) =>
                  result != undefined &&
                  result.every((r) => r.sum != undefined),
              )
          ) {
            // need to pre-calculate everything
            // console.log("result: ", data.map(x => x.result))

            let copy = cloneDeep(data);
            let upd = copy.map((table) => {
              let acc = 0;
              let updated_result = table.result.map((item) => {
                if (item.sum == undefined) {
                  // console.log("-------------------------", item.name)
                  // console.log(item)
                  item.price = getPrice(item.name);
                  // console.log(item.price)
                  const sum = item.estimation * item.price;
                  acc += sum;
                  item.sum = sum.toFixed(2);
                  // console.log(item.sum)
                }
                return item;
              });
              return { ...table, result: updated_result, total: acc };
            });
            setData(upd);
          }
        }
      } catch (e) {
        toaster.push(
          <Message
            type="error"
            closable
          >{`Error ${e} in data: ${JSON.stringify(data)}`}</Message>,
        );
      }
    },
    [data, getPrice, setData, toaster],
  );

  useEffect(() => {
    updateSums();
  }, [data, getPrice, setData, updateSums]);

  const handlePriceChange = (tname, name, value) => {
    try {
      console.log("Setting new proce value");
      if (setData) {
        let copy = cloneDeep(data);
        console.log("Searching for name", name);
        let table = copy.find((obj) => obj.name === tname);
        if (table) {
          let item = table.result.find((obj) => obj.name === name);
          if (item) {
            item.price = parseFloat(value);
            setData(copy);
            // updateSums(true);
          } else {
            toaster.push(
              <Message
                type="error"
                closable
              >{`Name '${tname}'::'${name}' not found in: ${JSON.stringify(table)}`}</Message>,
            );
          }
        } else {
          toaster.push(
            <Message
              type="error"
              closable
            >{`Name '${tname}' not found in: ${JSON.stringify(copy)}`}</Message>,
          );
        }
      }
    } catch (e) {
      toaster.push(
        <Message
          type="error"
          closable
        >{`Error ${e} in handlePriceChange: ${JSON.stringify(data)}`}</Message>,
      );
    }
  };

  const handleEstimationChange = (tname, name, value) => {
    try {
      console.log("Setting new est value");
      if (setData) {
        let copy = cloneDeep(data);
        console.log("Searching for name", name);
        let table = copy.find((obj) => obj.name === tname);
        if (table) {
          let item = table.result.find((obj) => obj.name === name);
          if (item) {
            item.estimation = parseFloat(value);
            setData(copy);
            // updateSums(true);
          } else {
            toaster.push(
              <Message
                type="error"
                closable
              >{`Name '${tname}'::'${name}' not found in: ${JSON.stringify(copy)}`}</Message>,
            );
          }
        } else {
          toaster.push(
            <Message
              type="error"
              closable
            >{`Name '${tname}' not found in: ${JSON.stringify(copy)}`}</Message>,
          );
        }
      }
    } catch (e) {
      toaster.push(
        <Message
          type="error"
          closable
        >{`Error ${e} in handlePriceChange: ${JSON.stringify(data)}`}</Message>,
      );
    }
  };

  if (!isArrayLike(data)) {
    return (
      <Message type="error" showIcon>
        Invalid data: expected an array.
      </Message>
    );
  }

  return (
    <Stack direction="column" spacing={20} alignItems="stretch">
      {data.filter(skipIncorrectData).map((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return (
            <Panel key={index} header={entry.name} style={{ width: "100%" }}>
              <Message type="error" showIcon>
                Invalid entry at index {index}
                <pre>{JSON.stringify(entry)}</pre>
              </Message>
            </Panel>
          );
        }

        if (!entry.result || !isArrayLike(entry.result)) {
          return (
            <Panel
              key={index}
              header={entry.name}
              style={{ width: "100%", padding: "0" }}
            >
              <Message key={index} type="error" showIcon>
                {entry.text || "Unknown error"}
              </Message>
              <Message key={index} type="error" showIcon>
                {JSON.stringify(entry, null, 2)}
              </Message>
            </Panel>
          );
        }

        return (
          <div key={index} style={{ width: "100%", marginBottom: "10px" }}>
            <h4>{entry.name}</h4>
            <table className="evaluation-table modern">
              <thead>
                <tr>
                  <th style={{ width: "25px" }}>#</th>
                  <th style={{ width: "88%" }}>
                    <Trans>Name</Trans>
                  </th>
                  <th>
                    <Trans>Estimation</Trans>
                  </th>
                  <th>
                    <Trans>Price</Trans> {currency && `(${currency})`}
                  </th>
                  <th>
                    <Trans>Sum</Trans> {currency && `(${currency})`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.result.map((row, i) => {
                  const price = row.price ?? basePrice;
                  const sum = (row.estimation * price).toFixed(2);
                  return (
                    <tr key={i}>
                      <td className="evaluation-table-cell-numeric">{i + 1}</td>
                      <td title={row.tooltip || ""}>{row.name}</td>
                      <td className="evaluation-table-cell-numeric">
                        <InlineEditWrapper
                          value={row.estimation}
                          onChange={(value) =>
                            handleEstimationChange(entry.name, row.name, value)
                          }
                          style={{ minWidth: 60 }}
                        />
                      </td>
                      <td className="evaluation-table-cell-numeric">
                        <InlineEditWrapper
                          value={price}
                          onChange={(value) =>
                            handlePriceChange(entry.name, row.name, value)
                          }
                          style={{ minWidth: 60 }}
                        />
                      </td>
                      <td className="evaluation-table-cell-numeric">{sum}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td
                    colSpan={4}
                    style={{ textAlign: "right", fontWeight: "bold" }}
                  >
                    <Trans>Total</Trans>:
                  </td>
                  <td>
                    <pre>
                      <b>
                        {entry.result
                          .reduce((acc, row) => {
                            const price = row.price ?? basePrice;
                            return acc + row.estimation * price;
                          }, 0)
                          .toFixed(2)}
                      </b>{" "}
                      {currency}
                    </pre>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </Stack>
  );
};
