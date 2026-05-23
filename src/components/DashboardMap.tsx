'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import L from 'leaflet';


// Fix Leaflet default marker icon issue with webpack/Next.js
delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

import 'leaflet/dist/leaflet.css';

interface RouterConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  status?: 'online' | 'offline';
  latitude?: number;
  longitude?: number;
}

interface DashboardMapProps {
  routers: RouterConfig[];
}

export default function DashboardMap({ routers }: DashboardMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const geolocatedRouters = routers.filter(r => r.latitude && r.longitude);

  if (!mounted) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', animation: 'breathe 1.5s ease-in-out infinite' }} />
        Loading map...
      </div>
    );
  }

  if (geolocatedRouters.length === 0) {
    return (
      <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', gap: '0.75rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={24} opacity={0.3} />
        </div>
        <p style={{ color: 'var(--text-2)' }}>No router locations configured.</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Edit each router and add latitude/longitude coordinates to show them on the map.</p>
      </div>
    );
  }

  // Calculate center point: average of all coordinates
  const centerLat = geolocatedRouters.reduce((sum, r) => sum + (r.latitude || 0), 0) / geolocatedRouters.length;
  const centerLng = geolocatedRouters.reduce((sum, r) => sum + (r.longitude || 0), 0) / geolocatedRouters.length;
  const center: [number, number] = [centerLat, centerLng];

  // Calculate bounds to fit all markers
  const bounds = L.latLngBounds(
    geolocatedRouters.map(r => [r.latitude!, r.longitude!] as [number, number])
  );

  return (
    <div style={{ height: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        bounds={bounds}
        boundsOptions={{ padding: [50, 50] }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geolocatedRouters.map(router => (
          <Marker key={router.id} position={[router.latitude!, router.longitude!]}>
            <Popup>
              <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', minWidth: '180px' }}>
                <strong style={{ fontSize: '15px', color: '#111' }}>{router.name}</strong>
                <br />
                <span style={{ color: '#555' }}>{router.host}:{router.port}</span>
                <br />
                <span style={{
                  display: 'inline-block',
                  marginTop: '6px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: router.status === 'online' ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                  color: router.status === 'online' ? '#00c853' : '#ff1744',
                  border: `1px solid ${router.status === 'online' ? 'rgba(0, 200, 83, 0.2)' : 'rgba(255, 0, 0, 0.2)'}`,
                }}>
                  {router.status || 'unknown'}
                </span>
                {router.latitude && router.longitude && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#888' }}>
                    {router.latitude.toFixed(4)}, {router.longitude.toFixed(4)}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
