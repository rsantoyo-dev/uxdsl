import { NextRequest, NextResponse } from 'next/server'

const POLLINATIONS_BASE_URL = 'https://gen.pollinations.ai'

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get('prompt')?.trim()
  const width = req.nextUrl.searchParams.get('width') || '1600'
  const height = req.nextUrl.searchParams.get('height') || '900'
  const nologo = req.nextUrl.searchParams.get('nologo') || 'true'
  const model = req.nextUrl.searchParams.get('model') || 'flux'
  const seed = req.nextUrl.searchParams.get('seed')

  if (!prompt) {
    return NextResponse.json(
      { error: 'Missing required query param: prompt' },
      { status: 400 }
    )
  }

  const upstream = new URL(`${POLLINATIONS_BASE_URL}/image/${encodeURIComponent(prompt)}`)
  upstream.searchParams.set('width', width)
  upstream.searchParams.set('height', height)
  upstream.searchParams.set('nologo', nologo)
  upstream.searchParams.set('model', model)
  if (seed) upstream.searchParams.set('seed', seed)

  const apiKey = process.env.POLLINATIONS_API_KEY?.trim()
  const headers: HeadersInit = {}
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers,
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'Failed to fetch background image',
          status: res.status,
          upstream: body || null,
        },
        { status: res.status }
      )
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await res.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Network error while requesting Pollinations image' },
      { status: 502 }
    )
  }
}
