import { Button, Panel } from "rsuite";
import { styles } from "../layout/StageView";
import LoadCalculationMenu from "./LoadCalculationMenu";
import Trans from "../../localization/Trans";

const CalcMainMenuStage = ({ onNext }) => {

    return (
        <div style={styles.sampleStage}>
            <div>
                <div style={styles.buttonGroup}>
                    <Button size="lg" onClick={onNext} appearance="ghost" style={{margin: "30pt 0"}}><Trans>New calculation</Trans></Button>
                </div>
                <Panel bordered collapsible header={"Попередні розрахунки"} style={{opacity: "0.9", fontSize: "smaller"}}>
                    <LoadCalculationMenu />
                    </Panel>
            </div>
        </div>
    );
};

export default CalcMainMenuStage;
