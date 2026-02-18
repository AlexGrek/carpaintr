import { useNavigate } from "react-router-dom";
import { Button, Panel, Container } from "rsuite";
import { Home, Wrench } from "lucide-react";
import Trans from "../../localization/Trans";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import "./NotFoundPage.css";

registerTranslations("ua", {
  "Page Not Found": "Сторінку не знайдено",
  "Oops! Looks like this route needs repair": "Упс! Схоже, цей маршрут потребує ремонту",
  "The page you're looking for doesn't exist or has been moved.":
    "Сторінка, яку ви шукаєте, не існує або була переміщена.",
  "Go to Dashboard": "Перейти до панелі",
  "Back to Home": "На головну",
  "Error 404": "Помилка 404",
});

const NotFoundPage = () => {
  const navigate = useNavigate();
  const { str } = useLocale();
  useDocumentTitle("Document title: Page Not Found");

  return (
    <Container className="not-found-page">
      <Panel className="not-found-panel" bordered>
        <div className="not-found-content">
          {/* Broken Car Illustration */}
          <div className="broken-car-illustration">
            <div className="car-body">
              <div className="car-top">
                <div className="window"></div>
                <div className="crack">⚡</div>
              </div>
              <div className="car-main">
                <div className="headlight broken">💡</div>
                <div className="grille">
                  <div className="grille-line"></div>
                  <div className="grille-line"></div>
                  <div className="grille-line"></div>
                </div>
                <div className="headlight broken">💡</div>
              </div>
              <div className="car-bottom">
                <div className="wheel flat">
                  <div className="rim"></div>
                </div>
                <div className="wheel">
                  <div className="rim"></div>
                </div>
              </div>
            </div>
            <div className="smoke">
              <span>💨</span>
              <span>💨</span>
              <span>💨</span>
            </div>
            <div className="tools">
              <Wrench className="tool tool-1" />
              <Wrench className="tool tool-2" />
            </div>
          </div>

          {/* Error Message */}
          <div className="not-found-text">
            <h1 className="error-code">
              <Trans>Error 404</Trans>
            </h1>
            <h2 className="error-title">
              <Trans>Page Not Found</Trans>
            </h2>
            <p className="error-description">
              <Trans>Oops! Looks like this route needs repair</Trans>
            </p>
            <p className="error-details">
              <Trans>
                The page you're looking for doesn't exist or has been moved.
              </Trans>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="not-found-actions">
            <Button
              appearance="primary"
              size="lg"
              onClick={() => navigate("/app/dashboard")}
              startIcon={<Home />}
            >
              <Trans>Go to Dashboard</Trans>
            </Button>
            <Button
              appearance="ghost"
              size="lg"
              onClick={() => navigate("/")}
            >
              <Trans>Back to Home</Trans>
            </Button>
          </div>
        </div>
      </Panel>
    </Container>
  );
};

export default NotFoundPage;
