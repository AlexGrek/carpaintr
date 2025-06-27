import React, { Suspense, lazy } from 'react';
import TopBarUser from '../layout/TopBarUser';
import { Loader, Panel, PanelGroup, Placeholder } from 'rsuite';
import ActiveLicenseMarker from '../ActiveLicenseMarker';
import Trans from '../../localization/Trans';
import { useLocale, registerTranslations } from "../../localization/LocaleContext";

// Lazy-load components that are not visible on initial render
const ChangePasswordMenu = lazy(() => import('../ChangePasswordMenu'));
const ClientLicenseListing = lazy(() => import('../ClientLicenseListing'));
const LanguageMenu = lazy(() => import('../layout/LanguageMenu'));
const OrganisationMenu = lazy(() => import('../OrganisationMenu'));

// Register translations once when the module is loaded, not on every render
registerTranslations("ua", {
    "Change password": "Змінити пароль",
    "Licenses": "Ліцензії",
    "Organization menu": "Налаштування організації"
});

const CabinetPage = () => {
    const { str } = useLocale();

    // A simple fallback component for suspense
    const loadingFallback = <div>
        <Placeholder.Paragraph rows={3} />
        <Loader backdrop vertical />
    </div>;

    return (
        <div>
            <TopBarUser />
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
                <Panel>
                    <ActiveLicenseMarker />
                </Panel>
                <PanelGroup>
                    <Panel header={str("Organization menu")} collapsible bordered>
                        <Suspense fallback={loadingFallback}>
                            <OrganisationMenu />
                        </Suspense>
                    </Panel>
                    <Panel header={str("Change password")} collapsible bordered>
                        <Suspense fallback={loadingFallback}>
                            <ChangePasswordMenu />
                        </Suspense>
                    </Panel>
                    <Panel header={str("Licenses")} collapsible bordered>
                        <Suspense fallback={loadingFallback}>
                            <ClientLicenseListing />
                        </Suspense>
                    </Panel>
                    <Panel header="Language | Мова" collapsible bordered>
                        <Suspense fallback={loadingFallback}>
                            <LanguageMenu />
                        </Suspense>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

export default CabinetPage;