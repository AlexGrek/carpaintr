import { Button, Panel } from "rsuite";
import { styles } from "../layout/StageView";
import LoadCalculationMenu from "./LoadCalculationMenu";
import Trans from "../../localization/Trans";
import { CarCard } from "../utility/CarCard";
import CreateCard from "../utility/CreateCard";

const RenderUnsaved = ({ dataString, onLoadData }) => {
  try {
    let data = JSON.parse(dataString);
    if (data) {
      return (
        <Panel bordered>
          <h4>
            <Trans>Previous calculation</Trans>
          </h4>
          <CarCard data={data} style={{ margin: "auto" }} />
          <br />
          <Button appearance="primary" onClick={() => onLoadData(data)}>
            <Trans>Continue</Trans>
          </Button>
        </Panel>
      );
    } else {
      return <p>No unsaved data</p>;
    }
  } catch {
    return <p>Unsaved data cannot be parsed</p>;
  }
};

const CalcMainMenuStage = ({ onNext, onLoad }) => {
  const unsaved = localStorage.getItem("unsaved_calculation");

  return (
    <div style={styles.sampleStage}>
      <div className="fade-in-simple">
        <div style={styles.buttonGroup}>
          <CreateCard onClick={() => onNext()}></CreateCard>
        </div>
        {unsaved && <RenderUnsaved dataString={unsaved} onLoadData={onLoad} />}
        <Panel
          bordered
          collapsible
          header={"Завантажити розрахунок"}
          style={{ opacity: "0.9", fontSize: "smaller" }}
        >
          <LoadCalculationMenu onDataLoaded={onLoad} />
        </Panel>
      </div>
    </div>
  );
};

export default CalcMainMenuStage;
