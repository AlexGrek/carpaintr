import { useState } from "react";
import { Button, Drawer } from "rsuite";
import { styles } from "../layout/StageView";
import LoadCalculationMenu from "./LoadCalculationMenu";
import Trans from "../../localization/Trans";
import { registerTranslations } from "../../localization/LocaleContext";
import { CarCard } from "../utility/CarCard";
import CreateCard from "../utility/CreateCard";
import { FolderOpen, RotateCcw } from "lucide-react";

registerTranslations("ua", {
  "Open project": "Відкрити проєкт",
  "Saved projects": "Збережені проєкти",
  "Resume previous": "Продовжити попередній",
  "Continue": "Продовжити",
  "Previous calculation": "Попередній розрахунок",
  "or": "або",
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
          <Button appearance="primary" onClick={() => onLoadData(data)} style={{ width: "100%" }}>
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

  const handleLoaded = (data) => {
    setDrawerOpen(false);
    onLoad(data);
  };

  return (
    <div style={styles.sampleStage}>
      <div className="fade-in-simple">
        <div style={cardContainerStyle}>
          <CreateCard onClick={() => onNext()} />

          {unsaved && <RenderUnsaved dataString={unsaved} onLoadData={onLoad} />}

          <Button
            appearance="ghost"
            onClick={() => setDrawerOpen(true)}
            style={openProjectBtnStyle}
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
