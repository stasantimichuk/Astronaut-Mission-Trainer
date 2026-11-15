import React from 'react';

export default function CrewPanel({ crew, onSelectAstro }) {
    return (
        <div style={{
            position: 'absolute',
            top: '70px', 
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'auto',
            fontFamily: '"Press Start 2P", monospace',
        }}>
            {crew.map(astro => (
                <div 
                    key={astro.id} 
                    onClick={() => onSelectAstro(astro.id)}
                    style={{
                        background: astro.active ? '#1e1e26' : '#0a0a10',
                        border: `4px solid ${astro.active ? astro.color : '#334155'}`,
                        padding: '12px',
                        width: '280px', // Трохи розширили для двох колонок
                        cursor: 'pointer',
                        boxShadow: astro.active ? `6px 6px 0px ${astro.color}` : '4px 4px 0px #000',
                        transition: 'transform 0.1s',
                        transform: astro.active ? 'translate(-2px, -2px)' : 'none',
                        color: '#fff',
                        fontSize: '9px', // Зменшили шрифт, щоб все влізло
                        boxSizing: 'border-box'
                    }}
                >
                    {/* Заголовок профілю */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px dashed #4a4a5a', paddingBottom: '8px', marginBottom: '10px' }}>
                        <span style={{ color: astro.active ? '#fff' : astro.color }}>{astro.name}</span>
                        <span style={{ color: '#94a3b8' }}>[{astro.role}]</span>
                    </div>
                    
                    {/* Двоколонкова сітка параметрів */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', lineHeight: '1.5' }}>
                        
                        {/* Ліва колонка */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>HEALTH:</span>
                                <span style={{ color: astro.hp < 30 ? '#ef4444' : '#10b981' }}>{astro.hp}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>FOOD:</span>
                                <span style={{ color: astro.food < 30 ? '#ef4444' : '#f59e0b' }}>{astro.food}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>SUIT:</span>
                                <span style={{ color: astro.suit < 30 ? '#ef4444' : '#cbd5e1' }}>{astro.suit}%</span>
                            </div>
                        </div>

                        {/* Права колонка */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>AIR:</span>
                                <span style={{ color: astro.oxygen < 30 ? '#ef4444' : '#0ea5e9' }}>{astro.oxygen}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>WATER:</span>
                                <span style={{ color: astro.water < 30 ? '#ef4444' : '#3b82f6' }}>{astro.water}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>POWER:</span>
                                <span style={{ color: astro.energy < 30 ? '#ef4444' : '#eab308' }}>{astro.energy}%</span>
                            </div>
                        </div>

                    </div>

                    {/* Інвентар */}
                    <div style={{ 
                        marginTop: '10px', 
                        borderTop: '2px dashed #4a4a5a', 
                        paddingTop: '8px', 
                        display: 'flex', 
                        justifyContent: 'space-between' 
                    }}>
                        <span style={{ color: '#94a3b8' }}>BAG:</span>
                        <span style={{ color: '#a855f7' }}>{astro.inventory} dust</span>
                    </div>
                </div>
            ))}
        </div>
    );
}