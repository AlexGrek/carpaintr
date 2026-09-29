import { useState } from "react";
import { Button, Drawer } from "rsuite";
import { styles } from "../layout/StageView";
import LoadCalculationMenu from "./LoadCalculationMenu";
import Trans from "../../localization/Trans";
import { registerTranslations, useLocale } from "../../localization/LocaleContext";
import { CarCard } from "../utility/CarCard";
import CreateCard from "../utility/CreateCard";
import { FolderOpen, RotateCcw, Car, Tag, SearchCode } from "lucide-react";

registerTranslations("ua", {
  "Open project": "Відкрити проєкт",
  "Saved projects": "Збережені проєкти",
  "Resume previous": "Продовжити попередній",
  "Continue": "Продовжити",
  "Previous calculation": "Попередній розрахунок",
  "or": "або",
  "By car type": "За типом кузова",
  "By car brand": "За маркою авто",
  "By VIN decoder": "Через VIN декодер",
  "Create new": "Створити новий",
});

const cardContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 20,
  padding: "24px 0",
};

const resumeCardStyle = {
  width: 360,
  maxWidth: "100%",
  borderRadius: 16,
  border: "1.5px solid rgba(226,59,26,0.25)",
  boxShadow: "0 4px 16px rgba(226,59,26,0.08)",
  padding: 16,
  background: "linear-gradient(180deg, #fff9f7, #fff5f3)",
  fontFamily: "Inter, system-ui, sans-serif",
};

const resumeHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
  color: "#c63215",
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const openProjectBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
};

const RenderUnsaved = ({ dataString, onLoadData }) => {
  try {
    const data = JSON.parse(dataString);
    if (!data) return null;
    return (
      <div style={resumeCardStyle}>
        <div style={resumeHeaderStyle}>
          <RotateCcw size={14} />
          <Trans>Resume previous</Trans>
        </div>
        <CarCard data={data} style={{ width: "100%", boxShadow: "none", border: "none", padding: 0 }} />
        <div style={{ marginTop: 14 }}>
          <Button
            appearance="primary"
            onClick={() => onLoadData(data)}
            style={{ width: "100%" }}
            data-testid="calc-main-resume-previous-button"
          >
            <Trans>Continue</Trans>
          </Button>
        </div>
      </div>
    );
  } catch {
    return null;
  }
};

const CalcMainMenuStage = ({ onNext, onLoad }) => {
  const unsaved = localStorage.getItem("unsaved_calculation");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { str } = useLocale();

  const handleLoaded = (data) => {
    setDrawerOpen(false);
    onLoad(data);
  };

  return (
    <div style={styles.sampleStage}>
      <div className="fade-in-simple">
        <div style={cardContainerStyle}>
          <div style={{ width: "100%", textAlign: "center", marginBottom: "-8px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#333" }}>
              <Trans>Create new</Trans>
            </h3>
          </div>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center" }}>
            <CreateCard
              text={str("By car type")}
              icon={<Car size={32} color="orangered" strokeWidth={2.5} />}
              onClick={() => onNext("type")}
              dataTestId="calc-main-create-by-type-button"
              style={{ width: "240px", minHeight: "160px" }}
            />
            <CreateCard
              text={str("By car brand")}
              icon={<Tag size={32} color="orangered" strokeWidth={2.5} />}
              onClick={() => onNext("brand")}
              dataTestId="calc-main-create-by-brand-button"
              style={{ width: "240px", minHeight: "160px" }}
            />
            <CreateCard
              text={str("By VIN decoder")}
              icon={<SearchCode size={32} color="orangered" strokeWidth={2.5} />}
              beta={true}
              onClick={() => onNext("vin")}
              dataTestId="calc-main-create-by-vin-button"
              style={{ width: "240px", minHeight: "160px" }}
            />
          </div>

          {unsaved && <RenderUnsaved dataString={unsaved} onLoadData={onLoad} />}

          <Button
            appearance="ghost"
            onClick={() => setDrawerOpen(true)}
            style={openProjectBtnStyle}
            data-testid="calc-main-open-project-button"
          >
            <FolderOpen size={16} />
            <Trans>Open project</Trans>
          </Button>
        </div>
      </div>

      <Drawer
        placement="bottom"
        size="full"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        style={{ maxHeight: "75vh" }}
        data-testid="calc-main-open-project-drawer"
      >
        <Drawer.Header>
          <Drawer.Title>
            <Trans>Saved projects</Trans>
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body style={{ padding: "0 16px 24px" }}>
          <LoadCalculationMenu
            show={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onDataLoaded={handleLoaded}
          />
        </Drawer.Body>
      </Drawer>
    </div>
  );
};

export default CalcMainMenuStage;
