import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1e3a8a', color: '#fff', fontSize: 320, fontFamily: 'Georgia, serif', fontStyle: 'italic',
        }}
      >
        p
      </div>
    ),
    { width: 512, height: 512 },
  );
}
