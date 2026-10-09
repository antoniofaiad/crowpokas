# Controle Financeiro

Site de controle de contas mensais. Também funciona como app instalável no celular (PWA).

## O que faz
- Abas por mês. "+ Próximo mês" copia as contas do mês anterior, todas desmarcadas
- Renda do mês, total de contas, valor pago, valor a pagar e quanto sobra
- Marcar contas como pagas, editar e excluir (para excluir, é preciso clicar duas vezes)
- Avisos de contas vencidas e das que vencem nos próximos 5 dias
- Gastos por categoria e gráfico mês a mês
- Backup: exportar e importar todos os dados (.json) e exportar o mês em .csv (abre no Excel)
- Tema claro e escuro, e funciona sem internet depois do primeiro acesso

Os dados ficam no navegador do aparelho (localStorage). Para levar para outro aparelho, use **Backup → Exportar** e depois **Importar** no outro.

## Rodar localmente
```bash
python3 -m http.server 8000
# abra http://localhost:8000/financeiro/
```

## Publicar (GitHub Pages)
Settings → Pages → Source: branch `main`, pasta `/ (root)`.
O app fica em `https://<usuario>.github.io/crowpokas/financeiro/`.

## Instalar como app
- **Android (Chrome):** abra o site e toque em "Instalar app", ou use o menu ⋮ → Instalar app.
- **iPhone (Safari):** toque em Compartilhar → Adicionar à Tela de Início.

Ao publicar alterações, aumente a versão em `sw.js` (`financeiro-v1` → `financeiro-v2`) para os aparelhos baixarem a versão nova.
