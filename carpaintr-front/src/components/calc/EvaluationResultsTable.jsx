import { useCallback, useEffect, useState } from "react";
import { Button, Message, Modal, Panel, Stack, useToaster } from "rsuite";
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
  Source: "Джерело",
  "Data source": "Джерело даних",
  Table: "Таблиця",
  Field: "Поле",
  Close: "Закрити",
});

const TABLE_CHIP_STYLE = {
  fontSize: "12px",
  backgroundColor: "#e0e7ff",
  color: "#3730a3",
  borderRadius: "3px",
  padding: "2px 6px",
  textDecoration: "none",
  fontFamily: "monospace",
};

const defaultGetEditorUrl = (filePath) =>
  `/app/fileeditor?fs=Common&path=${encodeURIComponent(filePath)}`;

const TraceButton = ({ trace, onOpen }) => (
  <span
    onClick={(e) => { e.stopPropagation(); onOpen(trace); }}
    style={{
      cursor: "pointer",
      color: "#aaa",
      fontSize: "12px",
      userSelect: "none",
      marginLeft: "6px",
    }}
    title="Show source"
  >
    ⓘ
  </span>
);

const TraceModal = ({ trace, onClose, getEditorUrl }) => {
  if (!trace) return null;
  const tablePath = `tables/${trace.table}.csv`;
  const editorUrl = getEditorUrl(tablePath);
  return (
    <Modal open onClose={onClose} size="xs">
      <Modal.Header>
        <Modal.Title><Trans>Data source</Trans></Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ fontSize: "14px", lineHeight: "2" }}>
          <div>
            <strong><Trans>Table</Trans>:</strong>{" "}
            <a href={editorUrl} target="_blank" rel="noopener noreferrer" style={TABLE_CHIP_STYLE}>
              {trace.table}
            </a>
          </div>
          <div>
            <strong><Trans>Field</Trans>:</strong>{" "}
            <code style={{ fontSize: "12px", backgroundColor: "#f5f5f5", padding: "1px 5px", borderRadius: "3px" }}>
              {trace.field}
            </code>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose} appearance="subtle"><Trans>Close</Trans></Button>
      </Modal.Footer>
    </Modal>
  );
};

export const EvaluationResultsTable = ({
  data,
  setData = null,
  currency = "",
  basePrice = 1,
  skipIncorrect = false,
  getEditorUrl = defaultGetEditorUrl,
}) => {
  const toaster = useToaster();
  const [activeTrace, setActiveTrace] = useState(null);

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
            delete item.sum;
            setData(copy);
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
            delete item.sum;
            setData(copy);
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
    <>
    <TraceModal trace={activeTrace} onClose={() => setActiveTrace(null)} getEditorUrl={getEditorUrl} />
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
                      <td title={row.tooltip || ""}>
                        {row.name}
                        {row.trace && row.trace.type === "table" && (
                          <TraceButton trace={row.trace} onOpen={setActiveTrace} />
                        )}
                      </td>
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
    </>
  );
};
