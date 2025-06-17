# 🎬 POC - Vimeo e MUX como API Headless

POC para validar o uso do Vimeo e MUX como API headless para hosting, processamento e streaming de vídeos.

## 📁 Estrutura

```
src-api/     # API local em Bun
src-web/     # Frontend
  ├── vimeo/ # Implementação Vimeo
  └── mux/   # Implementação MUX
```

## 🔑 Setup

1. Instale as dependências:
```bash
bun install
```

2. Configure as variáveis de ambiente:
```
VIMEO_ACCESS_TOKEN=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
```

## 🚀 Rodando

1. API:
```bash
bun api
```

2. Frontend:
- Vimeo: `src-web/vimeo/index-vimeo.html`
- MUX: `src-web/mux/index-mux.html`

## 📝 Features

- Upload chunked (5MB)
- Drag & drop
- Progresso em tempo real
- Player integrado
- Suporte a múltiplos provedores 