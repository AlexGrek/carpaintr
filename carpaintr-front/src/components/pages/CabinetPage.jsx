import React, { useEffect, useState } from 'react';
import CarPaintEstimator from '../CarpaintEstimator';
import TopBarUser from '../layout/TopBarUser';
import { Panel, PanelGroup } from 'rsuite';
import ChangePasswordMenu from '../ChangePasswordMenu';
import ClientLicenseListing from '../ClientLicenseListing';
import ActiveLicenseMarker from '../ActiveLicenseMarker';
import Trans from '../../localization/Trans';
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import LanguageMenu from '../layout/LanguageMenu';
import OrganisationMenu from '../OrganisationMenu';

registerTranslations("ua", {
    "Change password": "Змінити пароль",
    "Licenses": "Ліцензії",
    "Organization menu": "Налаштування організації" 
})

const CabinetPage = () => {
    const { str } = useLocale();
    return <div><TopBarUser /><div style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <Panel>
            <ActiveLicenseMarker/>
        </Panel>
        <PanelGroup>
        <Panel header={str("Organization menu")} collapsible bordered>
                <OrganisationMenu></OrganisationMenu>
            </Panel>
            <Panel header={str("Change password")} collapsible bordered>
                <ChangePasswordMenu></ChangePasswordMenu>
            </Panel>
            <Panel header={str("Licenses")} collapsible bordered>
                <ClientLicenseListing></ClientLicenseListing>
            </Panel>
            <Panel header="Language | Мова" collapsible bordered>
                <LanguageMenu/>
            </Panel>
        </PanelGroup>
    </div>
    </div>
}

export default CabinetPage