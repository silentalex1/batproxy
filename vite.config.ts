import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import https from 'https'

function batproxPlugin(): Plugin {
  return {
    name: 'batprox',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (pathname === '/api/my-games') {
          const dir = path.resolve(process.cwd(), 'public', 'my-games')
          let games: Array<{ name: string; filename: string; url: string }> = []
          try {
            if (fs.existsSync(dir)) {
              games = fs.readdirSync(dir)
                .filter((file) => ['.html', '.htm', '.swf', '.zip'].includes(path.extname(file).toLowerCase()))
                .map((file) => ({
                  name: path.basename(file, path.extname(file)),
                  filename: file,
                  url: `/my-games/${file}`
                }))
            }
          } catch {
            games = []
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ games }))
          return
        }
        if (pathname === '/lumin.js' || pathname === '/lumin.worker.js') {
          const local = path.resolve(process.cwd(), 'public', 'lumin.worker.js')
          if (pathname === '/lumin.worker.js' && fs.existsSync(local) && fs.statSync(local).size > 100) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            fs.createReadStream(local).pipe(res)
            return
          }
          https.get('https://cdn.jsdelivr.net/gh/luminsdk/script@latest/fonts.min.js', (up) => {
            if (up.statusCode && up.statusCode >= 400) {
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
              res.statusCode = 502
              res.end('self.onmessage=function(){};')
              return
            }
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            res.setHeader('Cache-Control', 'public, max-age=3600')
            up.pipe(res)
          }).on('error', () => {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            res.statusCode = 502
            res.end('self.onmessage=function(){};')
          })
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), batproxPlugin()],
  publicDir: 'public',
  assetsInclude: ['**/*.png'],
  server: {
    port: 5175,
    strictPort: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Service-Worker-Allowed': '/',
    },
    proxy: {
      '/api/': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/wisp': { target: process.env.VITE_API_URL || 'http://localhost:3000', ws: true, changeOrigin: true },
      '/proxy': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/uv': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/epoxy': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/baremux': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/lumin.js': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/lumin.worker.js': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/cdn-cgi': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/ajax': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
      '/site': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
    },
    watch: {
      ignored: ['**/leak bypass/**', '**/*.zip']
    }
  }
})
