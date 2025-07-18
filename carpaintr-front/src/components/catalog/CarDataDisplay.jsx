import React, { useState, useMemo } from 'react';
import { Panel, Tag, Badge, Divider, InputGroup, Input, SelectPicker, Button, IconButton, Text } from 'rsuite';
import { capitalizeFirstLetter } from '../../utils/utils';
import { Car, Search, SearchCheck, SortAsc, SortDesc, Tags, X } from 'lucide-react';
import Trans from '../../localization/Trans';
import { registerTranslations, useLocale } from '../../localization/LocaleContext';

registerTranslations('ua', {
    "No data provided": "Дані відсутні",
    "Price: Low to High": "Ціна: від низької до високої",
    "Price: High to Low": "Ціна: від високої до низької",
    "Name: A to Z": "Назва: А до Я",
    "Name: Z to A": "Назва: Я до А",
    "Euro Class": "Євро Клас",
    "SUV First": "Позашляховики спочатку",
    "Body Type": "Тип кузова",
    "Class": "Клас",
    "Search": "Пошук",
    "Estimated price": "Орієнтовна ціна",
    "Clear": "Очистити",
    "Models Found": "Знайдено моделей",
    "Filtered Models": "Відфільтровані моделі",
    "Total Models": "Всього моделей",
    "SUV Models": "Моделі позашляховиків",
    "Avg. Price": "Середня ціна",
    "Total": "Всього",
    "Search by model name...": "Пошук за назвою моделі...",
    "Vehicle Catalog for": "Каталог автомобілів",
    "Euro Classifications": "Класифікації Євро",
    "Body Types": "Типи кузовів",
    "SUV": "Позашляховик",
    "Sort by": "Сортувати за",
});

const CarDataDisplay = ({ data, make }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState('price-asc');

    const { str } = useLocale();

    if (!data || typeof data !== 'object') {
        return <div><Trans>No data provided</Trans></div>;
    }

    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const getClassColor = (euroClass) => {
        const colorMap = {
            'A': 'green',
            'B': 'blue',
            'C': 'cyan',
            'D': 'yellow',
            'E': 'violet',
            'SUV 1': 'orange',
            'SUV 2': 'red',
            'SUV MAX': 'red'
        };
        return colorMap[euroClass] || 'gray';
    };

    const sortOptions = [
        { label: str('Price: Low to High'), value: 'price-asc' },
        { label: str('Price: High to Low'), value: 'price-desc' },
        { label: str('Name: A to Z'), value: 'name-asc' },
        { label: str('Name: Z to A'), value: 'name-desc' },
        { label: str('Euro Class'), value: 'class' },
        { label: str('SUV First'), value: 'suv-first' }
    ];

    const filteredAndSortedData = useMemo(() => {
        let entries = Object.entries(data);

        // Filter by search term
        if (searchTerm.trim()) {
            entries = entries.filter(([modelName]) =>
                modelName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        const classOrder = { 'A': 1, 'B': 2, 'C': 3, 'E': 4, 'SUV 1': 5, 'SUV 2': 6, 'SUV MAX': 7 };

        // Sort based on selected mode
        entries.sort(([nameA, carA], [nameB, carB]) => {
            switch (sortMode) {
                case 'price-asc':
                    return carA.estimated_price - carB.estimated_price;
                case 'price-desc':
                    return carB.estimated_price - carA.estimated_price;
                case 'name-asc':
                    return nameA.localeCompare(nameB);
                case 'name-desc':
                    return nameB.localeCompare(nameA);
                case 'class':
                    return (classOrder[carA.euro_class] || 99) - (classOrder[carB.euro_class] || 99);
                case 'suv-first':
                    if (carA.is_suv && !carB.is_suv) return -1;
                    if (!carA.is_suv && carB.is_suv) return 1;
                    return carA.estimated_price - carB.estimated_price;
                default:
                    return 0;
            }
        });

        return entries;
    }, [data, searchTerm, sortMode]);

    const clearSearch = () => {
        setSearchTerm('');
    };

    const getSortIcon = (mode) => {
        const icons = {
            'price-asc': <SortAsc />,
            'price-desc': <SortDesc />,
            'name-asc': <SortAsc />,
            'name-desc': <SortDesc />,
            'class': <Tags />,
            'suv-first': <Car />
        };
        return icons[mode] || <SortAsc />;
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ color: '#3c4043', fontSize: '2.5rem', fontWeight: '300', marginBottom: '10px' }}>
                    <Trans>Vehicle Catalog for</Trans> {capitalizeFirstLetter(make)}
                </h2>
            </div>

            {/* Controls */}
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto 30px auto',
                display: 'flex',
                gap: '20px',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'space-between'
            }}>

                {/* Search */}
                <div style={{ flex: '1', minWidth: '300px', maxWidth: '400px' }}>
                    <InputGroup inside>
                        <Input
                            placeholder={str("Search by model name...")}
                            value={searchTerm}
                            onChange={setSearchTerm}
                            style={{ fontSize: '1rem' }}
                        />
                        <InputGroup.Addon>
                            {searchTerm ? (
                                <IconButton
                                    icon={<X />}
                                    style={{ cursor: 'pointer', color: '#999' }}
                                    onClick={clearSearch}
                                />
                            ) : (
                                <IconButton icon={<Search />} style={{ color: '#999' }} />
                            )}
                        </InputGroup.Addon>
                    </InputGroup>
                </div>

                {/* Sort Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ color: '#666', fontSize: '0.9rem', fontWeight: '600' }}><Trans>Sort by</Trans>:</span>
                    <SelectPicker
                        data={sortOptions}
                        value={sortMode}
                        onChange={setSortMode}
                        cleanable={false}
                        searchable={false}
                        style={{ width: '200px' }}
                        renderValue={(value) => (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {getSortIcon(value)}
                                {sortOptions.find(opt => opt.value === value)?.label}
                            </span>
                        )}
                    />
                </div>

                {/* Results Count */}
                <div style={{
                    color: '#666',
                    fontSize: '0.9rem',
                    padding: '8px 12px',
                    backgroundColor: '#fff',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0'
                }}>
                    <Text as="small"><Trans>Total</Trans>: <b>{filteredAndSortedData.length}</b></Text>
                </div>
            </div>

            {/* Car List */}
            <div style={{ maxWidth: '1200px', margin: '0 auto' }} className='fade-in-simple'>
                {filteredAndSortedData.length === 0 ? (
                    <Panel style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ color: '#ccc', marginBottom: '20px' }}><SearchCheck /></div>
                        <h4 style={{ color: '#666', marginBottom: '10px' }}><Trans>No models found</Trans></h4>
                        <p style={{ color: '#999' }}>
                            <Trans>Try adjusting your search term or clearing the search to see all models.</Trans>
                        </p>
                        {searchTerm && (
                            <Button
                                appearance="primary"
                                onClick={clearSearch}
                                style={{ marginTop: '15px' }}
                            >
                                <Trans>Clear Search</Trans>
                            </Button>
                        )}
                    </Panel>
                ) : (
                    filteredAndSortedData.map(([modelName, carData]) => (
                        <Panel
                            key={modelName}
                            shaded
                            style={{
                                marginBottom: '16px',
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateX(4px)';
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateX(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '20px',
                                gap: '20px',
                                flexWrap: 'wrap'
                            }}>

                                {/* Model Name & SUV Badge */}
                                <div style={{
                                    minWidth: '120px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <h4 style={{
                                        margin: 0,
                                        color: '#2c3e50',
                                        fontSize: '1.3rem',
                                        fontWeight: '600',
                                        textTransform: 'capitalize'
                                    }}>
                                        {modelName}
                                    </h4>
                                    {carData.is_suv && (
                                        <Badge content="SUV" style={{ backgroundColor: '#e67e22', fontSize: '0.7rem' }} />
                                    )}
                                </div>

                                <Divider vertical style={{ height: '40px', margin: '0 10px' }} />

                                {/* Price */}
                                <div style={{
                                    minWidth: '120px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '2px' }}>
                                        <Trans>Estimated price</Trans>
                                    </div>
                                    <div style={{
                                        fontSize: '1.4rem',
                                        fontWeight: '700',
                                        color: '#27ae60'
                                    }}>
                                        {formatPrice(carData.estimated_price)}
                                    </div>
                                </div>

                                <Divider vertical style={{ height: '40px', margin: '0 10px' }} />

                                {/* Euro Class */}
                                <div style={{
                                    minWidth: '80px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '5px' }}>
                                        <Trans>Class</Trans>
                                    </div>
                                    <Tag
                                        color={getClassColor(carData.euro_class)}
                                        style={{
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                        }}
                                    >
                                        {carData.euro_class}
                                    </Tag>
                                </div>

                                <Divider vertical style={{ height: '40px', margin: '0 10px' }} />

                                {/* Body Types */}
                                <div style={{
                                    flex: '1',
                                    minWidth: '200px'
                                }}>
                                    <div style={{
                                        color: '#666',
                                        fontSize: '0.8rem',
                                        marginBottom: '5px',
                                        fontWeight: '600'
                                    }}>
                                        <Trans>Body Types</Trans>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {carData.body.map((bodyType, idx) => (
                                            <Tag
                                                key={idx}
                                                color="blue"
                                                size="sm"
                                                style={{
                                                    fontSize: '0.75rem',
                                                    textTransform: 'capitalize'
                                                }}
                                            >
                                                {bodyType}
                                            </Tag>
                                        ))}
                                    </div>
                                </div>

                                <Divider vertical style={{ height: '40px', margin: '0 10px' }} />

                                {/* Euro Body Types */}
                                <div style={{
                                    flex: '1',
                                    minWidth: '200px'
                                }}>
                                    <div style={{
                                        color: '#666',
                                        fontSize: '0.8rem',
                                        marginBottom: '5px',
                                        fontWeight: '600'
                                    }}>
                                        <Trans>Euro Classifications</Trans>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {carData.euro_body_types.map((euroType, idx) => (
                                            <Tag
                                                key={idx}
                                                color="cyan"
                                                size="sm"
                                                style={{
                                                    fontSize: '0.7rem',
                                                    textTransform: 'capitalize'
                                                }}
                                            >
                                                {euroType}
                                            </Tag>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Panel>
                    ))
                )}
            </div>

            {/* Summary Statistics */}
            {filteredAndSortedData.length > 0 && (
                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <Panel
                        shaded
                        style={{
                            maxWidth: '600px',
                            margin: '0 auto',
                            borderRadius: '12px',
                            backgroundColor: '#fff'
                        }}
                    >
                        <div style={{
                            padding: '20px',
                            display: 'flex',
                            justifyContent: 'space-around',
                            alignItems: 'center',
                            gap: '20px'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3498db' }}>
                                    {filteredAndSortedData.length}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.9rem' }}>
                                     <Trans>{searchTerm ? 'Filtered' : 'Total'} Models</Trans>
                                </div>
                            </div>

                            <Divider vertical style={{ height: '50px' }} />

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#e67e22' }}>
                                    {filteredAndSortedData.filter(([, car]) => car.is_suv).length}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.9rem' }}><Trans>SUV Models</Trans></div>
                            </div>

                            <Divider vertical style={{ height: '50px' }} />

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#27ae60' }}>
                                    {formatPrice(Math.round(filteredAndSortedData.reduce((sum, [, car]) => sum + car.estimated_price, 0) / filteredAndSortedData.length))}
                                </div>
                                <div style={{ color: '#666', fontSize: '0.9rem' }}><Trans>Avg. Price</Trans></div>
                            </div>
                        </div>
                    </Panel>
                </div>
            )}
        </div>
    );
};

export default CarDataDisplay;