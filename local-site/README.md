# WhiteSpace Local — protótipo 0.1

Esta pasta inicia a migração do WhiteSpace para um backend próprio com banco SQLite no computador principal.

## O que já existe
- Contas por nome de usuário e senha, sem e-mail.
- Chave de conta gerada pelo servidor ao criar a conta.
- Senhas armazenadas com hash scrypt e salt; nunca em texto puro.
- Sessões com tokens aleatórios e tokens armazenados como hash no banco.
- Perfis com nome público, bio, cor de destaque e cor de fundo.
- Feed público e criação de publicações.
- Banco SQLite local em `local-site/data/whitespace.sqlite`.
- Limitação básica de tentativas e validação de origem.

## Rodar no Windows
Instale Node.js 20 ou superior. No PowerShell, dentro da pasta `local-site`:

```powershell
npm install
npm start
```

Abra http://127.0.0.1:8787. O banco é criado automaticamente. Não envie o arquivo SQLite ao GitHub: ele está ignorado pelo Git.

## Hospedagem gratuita: importante
O GitHub Pages hospeda apenas os arquivos estáticos do site; ele **não executa** este servidor Node.js. O backend roda no computador principal e esse computador precisa ficar ligado para a comunidade acessar os dados. Para acesso público, será necessário expor o backend por um túnel HTTPS, configurar `ALLOWED_ORIGINS` com a URL do GitHub Pages e do túnel, e definir uma URL de API pública no frontend. Não abra uma porta do roteador sem compreender os riscos.

Por enquanto, o servidor escuta em `127.0.0.1` para não ficar exposto à rede. Isso é intencional.

## A chave da conta
A chave `WS-...` é um identificador único, não uma senha e não um mecanismo de recuperação. Não a use como substituta da senha. Recuperação de conta sem e-mail exigirá um fluxo adicional, por exemplo códigos de recuperação gerados e guardados pelo próprio usuário.

## Estado do projeto
Este é um primeiro protótipo, ainda não pronto para abrir ao público. O frontend principal existente na raiz continua sendo a versão anterior; esta nova interface está em `local-site/public`. Antes de substituir a página principal ou abrir acesso público, precisamos testar autenticação, cópias de segurança do banco, moderação, denúncias, privacidade, proteção contra spam e atualização segura do servidor.
