import { Button } from "rsuite";
import { styles } from "../layout/StageView";
import LoadCalculationMenu from "./LoadCalculationMenu";
import Trans from "../../localization/Trans";

const CalcMainMenuStage = ({ title, index, onMoveForward, onMoveBack, fadeOutStarted, children, onMoveTo, stageData }) => {

    return (
        <div style={styles.sampleStage}>
            <div style={{ ...styles.sampleStageInner, opacity: fadeOutStarted ? 0 : 1 }}>
                <div style={styles.buttonGroup}>
                    <Button appearance="primary" onClick={onMoveForward}><Trans>New calculation</Trans></Button>
                </div>
                <LoadCalculationMenu />
            </div>
        </div>
    );
};

export default CalcMainMenuStage;
