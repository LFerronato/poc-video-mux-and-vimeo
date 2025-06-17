# 📖 Guia - POC Vimeo e MUX

## 🎯 Objetivo
Validar o uso do Vimeo e MUX como API headless para vídeos.

## 🔑 Tokens

### Vimeo
1. [Vimeo Developer](https://developer.vimeo.com/)
2. Permissões: `files`, `upload`, `private`, `public`

### MUX
1. [MUX Dashboard](https://dashboard.mux.com/)
2. Permissões: `Full Access` (POC)

## 🚀 Desenvolvimento

### API Local
- `http://localhost:3333`
- Endpoints:
  - `POST /videos/link` - Gera URL de upload
  - `GET /videos/:uploadId/status` - Status do upload
  - `GET /videos/:videoId/url` - URL do vídeo

### Frontend
- Vimeo: `http://localhost:5500/vimeo/index-vimeo.html`
- MUX: `http://localhost:5500/mux/index-mux.html`

## 🔍 Troubleshooting

### API não responde
```bash
❌ ECONNREFUSED
```
**Solução**: Verifique se `bun api` está rodando

### Token inválido
```bash
❌ 401 Unauthorized
```
**Solução**: Verifique os tokens no `.env`

### Upload falha
```bash
❌ 412 Precondition Failed
```
**Solução**: Retry automático ou tente arquivo menor 