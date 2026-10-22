# WhiteSpace

## Protótipo novo: backend local sem e-mail

A pasta [`local-site/`](local-site/README.md) contém a primeira versão do novo protótipo: interface gótica minimalista, cadastro com nome e senha, chave de conta gerada pelo site, perfis personalizáveis e publicações armazenadas em SQLite no computador que executa o servidor.

**Para executar:** entre em `local-site`, rode `npm install` e `npm start`, depois abra http://127.0.0.1:8787. Veja o [guia completo](local-site/README.md).

**Atenção:** a raiz do repositório ainda contém a versão anterior conectada ao Supabase. O protótipo novo está isolado em `local-site/` para não quebrar o site existente durante o desenvolvimento. GitHub Pages só hospeda o frontend estático; para outros usuários acessarem o banco no seu PC, será necessário manter o PC ligado e configurar um túnel HTTPS e a URL da API. O backend local ainda não está exposto publicamente.

---

## Versão anterior (WhiteSpace 0.3 — Supabase)

WhiteSpace é um protótipo social com estética Frutiger Aero: céu azul, água, nuvens, natureza, brilho e aquela sensação de internet do começo dos anos 2000.

### Recursos da versão anterior
- Supabase Auth para contas reais com e-mail + senha.
- Perfil público com nome, @usuário, bio e avatar.
- Upload de avatar para Supabase Storage.
- Feed compartilhado, publicações, curtidas e comentários.
- Busca de pessoas e publicações.
- Configurações de perfil e recuperação de senha por e-mail.
- RLS (Row Level Security) no banco.
- Página de apoio/doações preparada para links reais de pagamento.

### Configuração da versão anterior
1. Crie um projeto no Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Configure Authentication e as URLs do GitHub Pages.
4. Em `js/config.js`, configure `supabaseUrl` e a chave pública `supabaseKey`.

Nunca coloque `service_role`, segredos privados ou senhas no GitHub.

### GitHub Pages
Nas configurações do repositório, ative Settings > Pages > Deploy from a branch > main > /(root).

### Segurança
O protótipo local ainda precisa de testes, cópias de segurança, moderação, denúncias, política de privacidade e revisão de segurança antes de abrir para uma comunidade grande.
