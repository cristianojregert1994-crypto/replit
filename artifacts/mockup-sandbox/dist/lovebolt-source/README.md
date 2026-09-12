# LoveBoltReplitGPT Studio — CRCELL v6.1.0

Extensão Chrome (Manifest V3) para trabalhar com **Lovable, Bolt.new, Replit e GPT Studio** usando GitHub, Supabase e ChatGPT.

## v6.1.0 — Preview removido

O Preview da extensão foi removido por completo da interface e do fluxo principal. A extensão agora possui somente dois painéis redimensionáveis:

**Extensão LoveBoltReplitGPT ↔ ChatGPT**

Foram removidos o terceiro painel, botões de Preview, Preview Studio, renderer/sandbox GPT, publicação automática de GPT Preview e regras que mandavam atualizar/recarregar o Preview após alterações.

Projetos continuam sendo detectados e vinculados ao GitHub normalmente. Lovable, Bolt.new e Replit abrem seus próprios editores. Projetos GPT Studio permanecem vinculados ao repositório GitHub e são trabalhados pela rota Chat GitHub.

## Instalação

1. Extraia o ZIP.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta extraída.
6. Abra a extensão pelo side panel.

## Layout

- Esquerda: extensão LoveBoltReplitGPT.
- Direita: ChatGPT incorporado.
- Barra central arrastável com limite de 18%/82%.
- Duplo clique na barra restaura 50/50.
- Tela cheia continua disponível.
- Tema claro e LED preto continuam padronizados.

## GitHub

A extensão mantém a detecção automática de repositório e branch. Projetos GPT Studio usam o marcador `.crcell/project.json`; o marcador legado `.crcell-preview/project.json` é aceito apenas para recuperar projetos antigos durante a migração.
