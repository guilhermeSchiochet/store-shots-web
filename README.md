# Store Shots (site)

Monta as capturas da App Store e da Play Store (celulares e tablets) e o recurso gráfico da Play Store a partir
dos prints do app. Roda **inteiro no navegador** — nada é enviado para servidor.

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # site estático em out/ (pode hospedar em qualquer lugar)
npm test           # testes do núcleo (modelos, migração, geometria, detector, PNG)
npm run lint && npm run typecheck
```

Use Chrome ou Edge (salvar direto numa pasta usa a File System Access API; nos outros navegadores a exportação é por .zip).

## Como funciona

- **Categorias:** Celulares, Tablets e Recurso gráfico (1024 × 500). Cada uma tem seus slides.
- **Slides com camadas livres:** aparelho (mostra um print com moldura ou só a tela), texto, imagem (livre ou estilo
  ícone de app), selo da loja (App Store / Google Play; "automático" segue a loja de cada tamanho) e forma.
- **Modelos prontos** (`src/lib/templates.ts`): título em cima, título embaixo, clássico, inclinado, dois aparelhos,
  tela cheia, destaque escuro; e três para o recurso gráfico. Depois de aplicado, tudo é editável.
- **Prints:** encaixe (Preencher é o padrão, Cobrir, Conter), zoom, posição, remoção automática das barras do sistema e
  área segura abaixo da câmera do aparelho.
- **Exportação:** cada tamanho aceita as resoluções da loja ou um tamanho personalizado; PNG **sem canal alfa** (RGB,
  codificador próprio em `src/lib/png.ts`) ou JPG. A App Store recusa imagens com transparência.
- **Desfazer/refazer** (Ctrl+Z / Ctrl+Shift+Z), Delete, Ctrl+D, setas para mover, Alt+arrastar ajusta o print,
  Ctrl+roda dá zoom no print, Ctrl+V cola imagem. Tema claro, escuro ou do sistema.

| Pasta | Responsabilidade |
|---|---|
| `src/lib/models.ts` | Tipos (projeto, slides, camadas), molduras, tamanhos de loja, normalização e migração dos formatos antigos (`legacy.ts`). |
| `src/lib/templates.ts` | Modelos prontos. Para criar um novo: adicione um item em `TEMPLATES`. |
| `src/lib/render.ts` | `renderSlide`: desenha um slide no Canvas. **Preview e exportação usam a mesma função.** |
| `src/lib/geometry.ts` | Enquadramento do print, área segura, caixas e rotação das camadas. |
| `src/lib/detector.ts` + `analysis.worker.ts` | Detecção da barra de status e da pílula de gestos, em Web Worker. |
| `src/lib/frames.ts` | Molduras: máscara no formato exato da tela e posição da câmera. |
| `src/lib/export.ts`, `png.ts`, `backup.ts` | Exportação, PNG RGB, backup/restauração e importação do app desktop. |
| `src/store/app.ts` | Estado (zustand) com seletores, histórico de desfazer e gravação no IndexedDB. |
| `src/components` | Barra lateral (modelo, slide, camadas, prints, exportação) e editor dos slides. |

Para adicionar uma moldura: PNG com a tela transparente em `public/frames/` + entrada em `FRAMES`.
Para um novo tamanho de loja: entrada em `PRESETS`.

## Dados

Os projetos ficam no IndexedDB deste navegador. Use **Backup** no seletor de projetos para guardar/mover (um .zip com o
projeto e as imagens) e **Restaurar** para trazer de volta. **Desktop** importa a pasta de um projeto do app antigo.
Projetos de versões anteriores do site são convertidos automaticamente para slides com camadas.
