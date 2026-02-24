# Clerk: Enviar apenas 1 código de validação no login

## Problema

O Clerk pode enviar dois códigos de verificação durante o login, sendo um deles inválido. Isso ocorre quando o **Client Trust** está habilitado.

## Solução

O Client Trust é um recurso de segurança do Clerk que exige verificação em segundo fator (código por e-mail ou SMS) quando o usuário faz login em um **novo dispositivo** e ainda não configurou MFA.

Para enviar apenas 1 código:

1. Acesse o [Clerk Dashboard](https://dashboard.clerk.com)
2. Selecione sua aplicação
3. Vá em **Updates** (ou **Configure** → **Updates**)
4. **Desative** o update "Client Trust"

> **Atenção:** Desativar o Client Trust reduz a proteção contra ataques de credential stuffing. Avalie o trade-off entre segurança e experiência do usuário.

## Alternativa (manter Client Trust)

Se preferir manter o Client Trust ativo, verifique se não há **MFA tradicional** (authenticator, SMS) habilitado em conflito. Usuários com MFA configurado usam apenas o método MFA, não o código do Client Trust.
