# Melissa Downloader CLI

Cliente de terminal para usar a Melissa Downloader API diretamente pelo Termux, sem precisar abrir um site.

## Requisitos

- Node.js 20 ou superior
- Melissa Downloader API em funcionamento
- Chave de API válida

## Instalação no Termux

Clone o repositório e entre na pasta:

```bash
git clone https://github.com/chirusanrestart/melissa-api.git
cd melissa-api
```

Crie seu arquivo de configuração:

```bash
cp .env.example .env
nano .env
```

Preencha `API_KEY` com sua chave. O endereço da API está fixado diretamente no código, em `melissa-downloader.js`.

Inicie o painel:

```bash
node melissa-downloader.js
```

## Recursos

- Identifica automaticamente links do TikTok, YouTube e Instagram.
- Envia a URL para o endpoint `POST /download`.
- No YouTube, permite escolher vídeo ou áudio.
- Salva os arquivos em pastas separadas por plataforma.
- Evita sobrescrever arquivos com o mesmo nome.

## Pastas de destino

Por padrão, os downloads ficam organizados assim:

```text
downloads/
├── TikTok/
├── YouTube/
├── Instagram/
└── Outros/
```

Os caminhos podem ser personalizados no arquivo `.env`.

## Configuração da API

O endereço base da API está hardcoded no arquivo `melissa-downloader.js`. Para alterá-lo, edite a constante `API_URL` nesse arquivo.

O cliente envia:

- Cabeçalho `X-API-Key`
- Cabeçalho `Content-Type: application/json`
- Corpo JSON com `url`
- Para YouTube, também envia `mode: "video"` ou `mode: "audio"`

## Segurança

**Não envie seu arquivo `.env` para o GitHub.** Ele contém sua chave privada. O repositório inclui apenas `.env.example`, sem credenciais reais.
