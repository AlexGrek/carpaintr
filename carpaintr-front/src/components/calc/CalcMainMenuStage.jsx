import { Button } from "rsuite";
import { styles } from "../layout/StageView";
import LoadCalculationMenu from "./LoadCalculationMenu";
import Trans from "../../localization/Trans";

const CalcMainMenuStage = ({ onNext }) => {

    return (
        <div style={styles.sampleStage}>
            <div>
                <div style={styles.buttonGroup}>
                    <Button size="lg" onClick={onNext}><Trans>New calculation</Trans></Button>
                </div>
                <LoadCalculationMenu />
            </div>
        </div>
    );
};

export default CalcMainMenuStage;
