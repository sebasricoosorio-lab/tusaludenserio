import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1e3a8a', color: '#fff', fontSize: 120, fontFamily: 'Georgia, serif', fontStyle: 'italic',
        }}
      >
        p
      </div>
    ),
    { width: 192, height: 192 },
  );
}
