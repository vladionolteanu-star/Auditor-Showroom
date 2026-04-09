import React, { useState } from 'react';
import type { ZoneType } from './types';
import LiveMonitor from './components/LiveMonitor';

const App: React.FC = () => {
    const [zoneType, setZoneType] = useState<ZoneType>('casierie');

    return <LiveMonitor zoneType={zoneType} onChangeZone={setZoneType} />;
};

export default App;
