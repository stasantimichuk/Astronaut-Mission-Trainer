import { useState, useEffect } from 'react';
import { SUPPLY, SUPPLY_CATALOG } from '../game/supply/SupplyConfig';

const FONT = '"Press Start 2P", monospace';

// Пункт зв'язку: вікно замовлення посилки. Відкривається подією OPEN_COMM_TERMINAL з LandingModule.
// order: { water: 2, ... } — скільки чого замовлено. etaText — рядок «через N дн. M год.» для посилки в дорозі.
export default function CommTerminal({ open, onClose, inFlight, landed, etaText, onOrder }) {
    const [cart, setCart] = useState({});

    useEffect(() => {
        if (open) setCart({});
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const total = Object.values(cart).reduce((a, b) => a + b, 0);
    const busy = !!inFlight || !!landed;
    const change = (id, delta) => {
        setCart(prev => {
            const cur = prev[id] || 0;
            const nextCount = Math.max(0, cur + delta);
            const nextTotal = total - cur + nextCount;
            if (nextTotal > SUPPLY.maxItemsPerOrder) return prev;
            return { ...prev, [id]: nextCount };
        });
    };

    const btn = (enabled, color) => ({
        width: '28px', height: '28px', background: enabled ? '#111' : '#1e1e26', color: enabled ? color : '#475569',
        border: `2px solid ${enabled ? color : '#334155'}`, cursor: enabled ? 'pointer' : 'default',
        fontFamily: FONT, fontSize: '12px', padding: 0
    });

    const summary = (items) => SUPPLY_CATALOG.filter(it => items[it.id] > 0).map(it => `${it.label} ×${items[it.id]}`).join(', ');

    return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', background: 'rgba(0,0,0,0.55)', zIndex: 30 }}>
            <div style={{ width: '460px', background: '#050510', border: '4px solid #0ea5e9', boxShadow: '8px 8px 0px #0369a1', padding: '20px', fontFamily: FONT, color: '#fff', fontSize: '10px', lineHeight: '1.8' }}>
                <div style={{ color: '#38bdf8', fontSize: '12px', marginBottom: '14px' }}>📡 COMMS</div>

                {inFlight && (
                    <div style={{ color: '#fbbf24', marginBottom: '12px' }}>
                        A parcel is already on its way:<br />{summary(inFlight.items)}<br />Arrives in: {etaText}
                    </div>
                )}
                {landed && (
                    <div style={{ color: '#22c55e', marginBottom: '12px' }}>
                        The parcel is on the landing pad! Carry it to the LANDING MODULE.
                    </div>
                )}

                {!busy && (
                    <>
                        <div style={{ color: '#94a3b8', fontSize: '8px', marginBottom: '10px' }}>
                            The parcel arrives {SUPPLY.deliveryDays} days after you order. Limit: {SUPPLY.maxItemsPerOrder} items.
                        </div>
                        {SUPPLY_CATALOG.map(it => (
                            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <div style={{ width: '12px', height: '12px', background: it.color, border: '2px solid #000' }} />
                                <div style={{ flex: 1 }}>
                                    {it.label}
                                    <span style={{ color: '#64748b', fontSize: '8px' }}> +{it.amount}</span>
                                </div>
                                <button style={btn((cart[it.id] || 0) > 0, '#ef4444')} onClick={() => change(it.id, -1)}>−</button>
                                <div style={{ width: '28px', textAlign: 'center' }}>{cart[it.id] || 0}</div>
                                <button style={btn(total < SUPPLY.maxItemsPerOrder, '#10b981')} onClick={() => change(it.id, 1)}>+</button>
                            </div>
                        ))}
                        <div style={{ marginTop: '12px', color: total >= SUPPLY.maxItemsPerOrder ? '#f59e0b' : '#fff' }}>
                            Total: {total}/{SUPPLY.maxItemsPerOrder}
                        </div>
                    </>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                    {!busy && (
                        <button
                            disabled={total === 0}
                            onClick={() => onOrder(cart)}
                            style={{ padding: '10px 14px', background: total > 0 ? '#0ea5e9' : '#1e1e26', color: total > 0 ? '#000' : '#475569', border: 'none', cursor: total > 0 ? 'pointer' : 'default', fontFamily: FONT, fontSize: '10px' }}>
                            [ ORDER ]
                        </button>
                    )}
                    <button onClick={onClose} style={{ padding: '10px 14px', background: '#111', color: '#94a3b8', border: '2px solid #334155', cursor: 'pointer', fontFamily: FONT, fontSize: '10px' }}>
                        [ CLOSE ]
                    </button>
                </div>
            </div>
        </div>
    );
}
