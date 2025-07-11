import { lazy, Suspense, useState } from 'react';
import TopBarUser from '../layout/TopBarUser';
import { Loader, Nav } from 'rsuite';
import ErrorBoundary from '../../ErrorBoundary';
import { registerTranslations } from '../../localization/LocaleContext';
import Trans from '../../localization/Trans';

registerTranslations("ua", {
    "Cars": "Автомобілі",
    "Parts": "Запчастини",
    "Data": "Дані"
});

const PartsCatalog = lazy(() => import("../catalog/PartsCatalog"));
const CarCatalog = lazy(() => import("../catalog/CarCatalog"));

const CatalogPage = () => {
    const [activeKey, setActiveKey] = useState('tab1');
    const [loadedTabs, setLoadedTabs] = useState(new Set(['tab1'])); // Track which tabs have been loaded

    const handleSelect = (eventKey) => {
        setActiveKey(eventKey);
        // Add the tab to loaded tabs when it's selected
        setLoadedTabs(prev => new Set([...prev, eventKey]));
    };

    const renderTabContent = () => {
        // Only render content if the tab has been loaded at least once
        if (!loadedTabs.has(activeKey)) {
            return null;
        }

        switch (activeKey) {
            case 'tab1':
                return (
                    <ErrorBoundary>
                        <Suspense fallback={<Loader />}>
                            <CarCatalog />
                        </Suspense>
                    </ErrorBoundary>
                );
            case 'tab2':
                return (
                    <ErrorBoundary>
                        <Suspense fallback={<Loader />}>
                            <PartsCatalog />
                        </Suspense>
                    </ErrorBoundary>
                );
            case 'tab3':
                return (
                    <Suspense fallback={<Loader />}>

                    </Suspense>
                );
            default:
                return null;
        }
    };


    return <div>
        <TopBarUser />
        <div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <Nav appearance="tabs" activeKey={activeKey} onSelect={handleSelect} style={{ borderBottom: '1px solid #e5e5e5' }}>
                    <Nav.Item eventKey="tab1"><Trans>Cars</Trans></Nav.Item>
                    <Nav.Item eventKey="tab2"><Trans>Parts</Trans></Nav.Item>
                    <Nav.Item eventKey="tab3"><Trans>Data</Trans></Nav.Item>
                </Nav>

                <div style={{ minHeight: '300px' }}>
                    {renderTabContent()}
                </div>
            </div>
        </div>
    </div>;
};

export default CatalogPage;
