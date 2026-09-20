# WhiteSpace 0.3 🌊☁️

WhiteSpace é um protótipo social com estética Frutiger Aero: céu azul, água, nuvens, natureza, brilho e aquela sensação de internet do começo dos anos 2000.

## O que mudou no 0.3

- Supabase Auth para contas reais com e-mail + senha.
- Primeira tela focada em criar o perfil.
- Perfil público com nome, @usuário, bio e avatar.
- Upload de avatar para Supabase Storage.
- Feed compartilhado entre usuários.
- Publicações de até 1000 caracteres.
- Curtidas persistentes no banco.
- Comentários persistentes no banco.
- Busca de pessoas e publicações.
- Configurações de perfil.
- Recuperação de senha por e-mail.
- RLS (Row Level Security) no banco.
- Página de apoio/doações preparada para links reais de pagamento.

## 1. Criar o banco

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute `supabase/schema.sql`.
4. Em Authentication, configure o método Email.
5. Em Authentication > URL Configuration, coloque a URL do seu GitHub Pages como Site URL e redirect URL quando necessário.

O Supabase Auth usa e-mail + senha; o perfil público guarda o nome, usuário, bio e avatar. A senha não é salva na tabela `profiles`.

## 2. Configurar o frontend

Abra `js/config.js` e preencha:

- `supabaseUrl`
- `supabaseKey` (publishable/anon key)

Nunca coloque `service_role` ou qualquer segredo privado no GitHub.

## 3. Doações

A interface de doações usa links externos de pagamento. Para tornar os valores clicáveis, preencha em `js/config.js` os links de pagamento correspondentes a R$5, R$10, R$20, R$50 e R$100.

A criação/gestão da conta do provedor de pagamentos e as regras legais/fiscais devem ser feitas pelo responsável adulto pelo projeto. O frontend não deve receber chaves secretas.

## 4. GitHub Pages

Envie os arquivos para um repositório público e ative Settings > Pages > Deploy from a branch > main > /(root).

## Segurança

Este projeto usa RLS para limitar alterações aos dados do próprio usuário. Para um site público de verdade, ainda será necessário adicionar moderação server-side, rate limiting, sistema de denúncias, proteção anti-spam, políticas de privacidade/termos e revisão de segurança antes de abrir para uma comunidade grande.
