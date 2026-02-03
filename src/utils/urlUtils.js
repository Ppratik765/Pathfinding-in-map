export const decodeStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    
    // 1. View State
    let viewState = null;
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const zoom = parseFloat(params.get('z'));
    if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
        viewState = {
            center: [lng, lat],
            zoom: zoom,
            pitch: parseFloat(params.get('p')) || 0,
            bearing: parseFloat(params.get('b')) || 0
        };
    }

    // 2. Active Algorithms (This preserves the number of canvases)
    let algos = null;
    const algosParam = params.get('algos');
    if (algosParam) {
        algos = algosParam.split(',').filter(Boolean);
    }

    // 3. Points
    const parsePoint = (str) => {
        if (!str) return null;
        const [l, t] = str.split(',').map(Number);
        if (!isNaN(l) && !isNaN(t)) return { lng: l, lat: t, id: `${l.toFixed(5)},${t.toFixed(5)}` };
        return null;
    };

    // 4. Auto-Run Flag (Implicit if start/end exist)
    const start = parsePoint(params.get('s'));
    const end = parsePoint(params.get('e'));
    const shouldAutoRun = !!(start && end);

    return {
        viewState,
        activeAlgos: algos,
        start,
        end,
        shouldAutoRun
    };
};

export const updateUrl = (viewState, activeAlgos, start, end) => {
    const params = new URLSearchParams();

    if (viewState && viewState.center) {
        params.set('lat', viewState.center[1].toFixed(5));
        params.set('lng', viewState.center[0].toFixed(5));
        params.set('z', viewState.zoom.toFixed(2));
        if (viewState.pitch) params.set('p', Math.round(viewState.pitch));
        if (viewState.bearing) params.set('b', Math.round(viewState.bearing));
    }

    // Saves the list of algorithms (e.g. "dijkstra,astar")
    if (activeAlgos && activeAlgos.length > 0) {
        params.set('algos', activeAlgos.join(','));
    }

    if (start) params.set('s', `${start.lng.toFixed(5)},${start.lat.toFixed(5)}`);
    if (end) params.set('e', `${end.lng.toFixed(5)},${end.lat.toFixed(5)}`);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
};