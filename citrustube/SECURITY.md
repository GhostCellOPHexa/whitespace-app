# CitrusTube — modelo de segurança

## Estado deste protótipo
Esta pasta contém uma interface estática. O chat de demonstração roda somente no navegador, e as mensagens não são enviadas a um servidor nem compartilhadas com outras pessoas. Os verificadores atuais são regras locais, não agentes de IA. Eles ajudam a demonstrar o fluxo, mas podem gerar falsos positivos e ser contornados.

## Verificações demonstradas
- Limite de 400 caracteres por mensagem.
- Limite de envio para reduzir flood.
- Detecção simples de mensagens repetidas.
- Bloqueio conservador de links.
- Detecção de padrões comuns de e-mail, telefone e CPF.
- Filtro simples de ameaças explícitas.
- Inserção do texto com textContent para evitar interpretar mensagens como HTML.

## Antes de abrir chat público
Verificações no navegador não são uma fronteira de segurança: qualquer pessoa pode desativá-las. A versão pública precisa reforçar tudo no servidor, com:
1. autenticação real, sessões protegidas e autorização por recurso;
2. limitação de taxa por conta e IP no servidor, limites de payload e proteção contra automação;
3. validação de esquema no backend e consultas parametrizadas;
4. políticas RLS por tabela no Supabase, testadas com usuários anônimos e autenticados;
5. moderação server-side, fila de revisão humana, bloqueio, denúncia e recurso;
6. sanitização contextual e renderização segura de todo conteúdo;
7. política para URLs, análise de phishing e bloqueio de redirecionadores;
8. logs de auditoria sem senhas, tokens ou conteúdo privado desnecessário;
9. política de retenção e exclusão de dados, proteção contra abuso e processo de resposta a incidentes;
10. testes de segurança e revisão de permissões antes de lançamento.

## Mini agentes de segurança
Os quatro módulos na interface são rótulos de verificações determinísticas (Guardião, Links, Privacidade e Antispam). Eles não são IA, não fazem análise semântica robusta e não substituem moderação humana. Para integrar modelos de IA depois, as chamadas devem ocorrer no servidor, com limites de custo, tratamento de dados mínimos, resistência a prompt injection e uma regra explícita de que a saída do modelo nunca concede permissões.

## Pix e Gatersons
O painel de apoio é somente visual. Não existe QR Code real, chave Pix, webhook ou confirmação de pagamento. Não se deve conceder privilégios com base em uma captura de tela enviada por alguém. A confirmação automática exige um provedor/integração confiável e validação de webhook no servidor; confirmação manual deve ser marcada como manual e revisada com cuidado. Nunca coloque chaves secretas no frontend.

## Segredos
Nunca publicar service-role keys, senhas, tokens de acesso, CPF, telefone pessoal ou dados bancários em arquivos públicos, commits, issues ou chat. Use variáveis secretas no ambiente de backend e chaves públicas apenas quando apropriado.