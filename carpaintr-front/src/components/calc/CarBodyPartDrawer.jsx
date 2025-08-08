import React, { useState } from "react";
import { Button, Drawer, Steps, Divider, Panel, VStack } from "rsuite";
import { Focus, Grid2x2X, Grid2x2Plus, Handshake } from 'lucide-react';
import jsyaml from 'js-yaml';

import MenuTree from "../layout/MenuTree";
import GridDraw from "./GridDraw";
import SelectionInput from '../SelectionInput';
import BottomStickyLayout from "../layout/BottomStickyLayout";
import { EvaluationResultsTable } from "./EvaluationResultsTable";
import ObjectBrowser from "../utility/ObjectBrowser";

const CarBodyPartDrawer = ({
    isDrawerOpen,
    handleDrawerClose,
    drawerCurrentPart,
    updateDrawerCurrentPart,
    handleAddOrUpdatePart,
    calculations,
    company,
    isMobile,
    mapVisual,
    outsideRepairZoneOptions,
    menuItems,
    setCalculations, // Pass this down
    processors, // Pass this down
    carClass, // Pass this down
    body, // Pass this down
    onSetIsCalculating
}) => {
    const [drawerTab, setDrawerTab] = useState(0);

    React.useEffect(() => {
        if (drawerCurrentPart) {
            setDrawerTab(0);
        }
    }, [drawerCurrentPart]);

    React.useEffect(() => {
        if (drawerTab == 2) {
            onSetIsCalculating(true);
        } else {
            onSetIsCalculating(false);
        }
    }, [drawerTab, onSetIsCalculating])

    if (!drawerCurrentPart) {
        return null;
    }

    return (
        <Drawer
            open={isDrawerOpen}
            onClose={handleDrawerClose}
            className="carBodyParts-drawer"
            backdrop='static'
            size={isMobile ? "full" : "md"}
        >
            <Drawer.Header>
                <Drawer.Title>{drawerCurrentPart.name}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="no-padding-sides">
                <div>
                    <div className="drawer-tabs-container">
                        {drawerTab === 0 && (
                            <BottomStickyLayout bottomPanel={<Button
                                color='green'
                                appearance="primary"
                                block
                                onClick={() => setDrawerTab(1)}
                                disabled={!drawerCurrentPart.action} // Disable if no action selected
                            >
                                Далі
                            </Button>}>
                                <div className="some-padding-sides carousel-page fade-in-expand-simple">
                                    <h4 className="body-parts-tab-header">Оберіть дію</h4>
                                    <MenuTree items={menuItems} value={drawerCurrentPart.action} onChange={(value) => updateDrawerCurrentPart({ action: value })} />
                                    <Divider />
                                    {/* <p style={{ opacity: '0.4', fontSize: 'x-small' }}><pre>{jsyaml.dump(drawerCurrentPart)}</pre></p> */}
                                </div>
                            </BottomStickyLayout>
                        )}
                        {drawerTab === 1 && (
                            <BottomStickyLayout bottomPanel={<VStack>
                                <Button color='green' appearance="primary" block onClick={() => {
                                    setDrawerTab(2);
                                }}>
                                    Розрахувати вартість
                                </Button>
                                <Button appearance="subtle" block onClick={() => setDrawerTab(0)}>Змінити тип ремонту</Button>
                            </VStack>}>
                                <h4 className="body-parts-tab-header">Вкажіть зону ремонту</h4>
                                {(drawerCurrentPart.action === "paint_one_side" || drawerCurrentPart.action === "paint_two_sides") && (
                                    <div className="some-padding-sides">
                                        <GridDraw
                                            gridData={drawerCurrentPart.grid}
                                            visual={mapVisual(drawerCurrentPart.name)}
                                            onGridChange={(value) => updateDrawerCurrentPart({ grid: value })}
                                        />
                                        <SelectionInput
                                            name="Поза зоною ремонту"
                                            values={Object.keys(outsideRepairZoneOptions)}
                                            labels={outsideRepairZoneOptions}
                                            selectedValue={drawerCurrentPart.outsideRepairZone}
                                            onChange={(value) => updateDrawerCurrentPart({ outsideRepairZone: value })}
                                        />
                                    </div>
                                )}
                            </BottomStickyLayout>
                        )}
                        {drawerTab === 2 && (
                            <BottomStickyLayout bottomPanel={<VStack>
                                <Button color='blue' appearance="primary" block onClick={handleAddOrUpdatePart}>
                                    Підтвердити та додати/оновити
                                </Button>
                                <Button appearance="subtle" block onClick={() => setDrawerTab(1)}>Повернутися до деталей</Button>
                            </VStack>}>
                                <div className="some-padding-sides"><h3>Підсумок та розрахунки</h3>
                                    <EvaluationResultsTable
                                        data={calculations[drawerCurrentPart.name] || []}
                                        currency={company.pricing_preferences.norm_price.currency}
                                        basePrice={company.pricing_preferences.norm_price.amount}
                                    />
                                    <Panel shaded collapsible header="Дані">
                                        <ObjectBrowser jsonObject={drawerCurrentPart.tableData} />
                                    </Panel>
                                </div>
                                {(drawerCurrentPart.action === "paint_one_side" || drawerCurrentPart.action === "paint_two_sides") && (
                                    <>
                                        <p>Зона пошкодження: {drawerCurrentPart.grid && drawerCurrentPart.grid.flat().filter(cell => cell === 1).length} клітинок</p>
                                        <p>Поза зоною ремонту: {outsideRepairZoneOptions[drawerCurrentPart.outsideRepairZone]}</p>
                                    </>
                                )}
                            </BottomStickyLayout>
                        )}
                    </div>
                </div>
            </Drawer.Body>
        </Drawer>
    );
};

export default CarBodyPartDrawer;
