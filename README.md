# LimpAr Gestão Comercial

Sistema de gestão comercial conectado ao Supabase (banco de dados na nuvem).
Já está configurado com as credenciais do projeto Supabase "LIMPAR GESTÃO COMERCIAL".

## Como publicar no Vercel (passo a passo)

1. Crie uma conta gratuita em https://vercel.com (pode usar login do GitHub ou Google).
2. No painel do Vercel, clique em "Add New" → "Project".
3. Se pedir para conectar a um repositório do GitHub, crie um repositório novo no GitHub e suba esta pasta inteira nele.
   - Alternativa mais simples: use a opção "Deploy" arrastando a pasta do projeto, se disponível na sua conta.
4. Quando o Vercel perguntar o "Framework Preset", selecione **Vite**.
5. Clique em "Deploy".
6. Em alguns minutos, o Vercel vai gerar um link público, algo como `limpar-gestao-comercial.vercel.app`.

Esse link é o que você usa você mesmo, e também o que manda para o cliente (SKAP Turbo). Os dois acessam o mesmo banco de dados Supabase, então tudo que um cadastrar aparece para o outro.

## Rodar localmente (opcional, para testar antes de publicar)

```
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (geralmente http://localhost:5173).
