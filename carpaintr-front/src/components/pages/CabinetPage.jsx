import React, { useEffect, useState } from 'react';
import CarPaintEstimator from '../CarpaintEstimator';
import TopBarUser from '../layout/TopBarUser';
import { Panel, PanelGroup } from 'rsuite';
import ChangePasswordMenu from '../ChangePasswordMenu';
import ClientLicenseListing from '../ClientLicenseListing';
import ActiveLicenseMarker from '../ActiveLicenseMarker';

const CabinetPage = () => {


    return <div><TopBarUser /><div style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <Panel>
            <ActiveLicenseMarker/>
        </Panel>
        <PanelGroup>
            <Panel header="Змінити пароль" collapsible bordered>
                <ChangePasswordMenu></ChangePasswordMenu>
            </Panel>
            <Panel header="Ліцензії" collapsible bordered>
                <ClientLicenseListing></ClientLicenseListing>
            </Panel>
        </PanelGroup>
    </div>
    </div>
}

export default CabinetPage