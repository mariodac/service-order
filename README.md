# Sistema Ordem de Serviço

## Configuração remota

1. Crie um projeto no Supabase e execute [supabase-schema.sql](supabase-schema.sql) no **SQL Editor**. O script cria a tabela, as permissões SQL e as políticas RLS necessárias para a chave pública.
2. Copie `assets/js/config.example.js` para `assets/js/config.js`. Em `assets/js/config.js`, informe a **Project URL** e a chave pública (**anon** ou **publishable**) do Supabase. Esse arquivo é ignorado pelo Git e não será enviado ao GitHub.
3. Crie uma API key no [ImgBB](https://api.imgbb.com/) e informe-a como `imgbbApiKey`.
4. Publique os arquivos em um servidor HTTP/HTTPS. Não use a chave `service_role` do Supabase no navegador.

As fotos são enviadas ao ImgBB no momento em que a O.S. é salva. O Supabase guarda somente a URL da imagem dentro dos dados da ordem de serviço.

> Atenção: como o projeto ainda não tem autenticação, as políticas do script permitem acesso anônimo à tabela. Para publicação aberta, implemente Supabase Auth e políticas RLS por usuário/empresa.
