---
name: memory-store
description: Leitura e escrita de memoria do agente Mythos com registro auditavel e opcao de ancoragem posterior.
trigger: "salvar memoria, lembrar, listar memorias, recuperar contexto"
version: "1.0.0"
---

# Memory Store Skill

Use esta skill quando o Mythos precisar guardar, recuperar ou continuar contexto de agente.

## Ferramenta atual

- Memoria do agente
- CongChain Memory Bridge
- Hash semantico/verificavel quando aplicavel

## Limites

- Nao salva segredo de carteira, seed phrase, senha, token privado ou credencial sem mascarar/bloquear.
- Nao substitui persistencia existente.
- Nao aciona transacao, pagamento ou assinatura.

## Saida esperada

- Memoria salva ou recuperada
- ID/hash quando disponivel
- Aviso de privacidade quando houver dado sensivel
- Proximo passo seguro
