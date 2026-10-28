# Analista José Quipanda — Site + Firebase

## Ficheiros
- `index.html`: site com identidade original refinada, foto pessoal e foto em ambiente laboratorial, cursos, autenticação, área de administração e verificação pública de certificados.
- `assets/jose-quipanda.jpg`: fotografia pessoal enviada anteriormente, sem alterar os traços do rosto.
- `assets/jose-quipanda-laboratorio.jpg`: fotografia em ambiente laboratorial enviada anteriormente.
- `firestore.rules`: regras iniciais de segurança para o Firestore.
- `firebase-config.txt`: dados de configuração do projeto.

## Configuração no Firebase
1. Firebase Console → Authentication → Sign-in method → ativar Email/Password.
2. Firestore Database → Rules → substituir pelas regras em `firestore.rules` e clicar Publish.
3. Criar uma conta no site depois de publicar no Vercel.
4. Firestore Database → coleção `users` → abrir documento com o UID da conta criada e alterar `role` de `student` para `admin`. Não crie botão público para promover administradores.
5. Terminar sessão e entrar de novo; o painel de administração deverá aparecer.
6. Criar um curso e testar com uma conta de estudante diferente.

## Publicar sem mudar de repositório
1. Descarregar este ZIP e extrair.
2. Guardar cópia do `index.html` atual no GitHub.
3. Substituir `index.html` na raiz do mesmo repositório e carregar a pasta `assets` para a raiz. Carregar também `firestore.rules` para referência.
4. Commit e push. A Vercel deve fazer novo deployment automaticamente se já estiver ligada ao repositório.
5. Testar o site publicado antes de divulgar.

## Importante
- Nenhum dado antigo do Supabase é importado.
- A configuração web do Firebase é pública por desenho; as regras Firestore são essenciais.
- Este protótipo ainda não implementa emissão de certificados no painel nem conteúdo de aulas com vídeos/ficheiros. A página pública de verificação está preparada, mas os certificados precisam de um fluxo administrativo de emissão antes de serem usados.
- Não usar para cursos pagos ou certificação oficial antes de testar permissões e completar os fluxos em falta. Não é necessário Firebase Storage, Cloud Functions ou Hosting para a estrutura atual.
- As regras são um ponto de partida; testa com contas distintas e confirma as permissões antes de usar com dados reais.


### Imagens
As fotografias pessoais foram removidas do pacote. A secção “Sobre Mim” utiliza `assets/logo-ajq.svg`, e as imagens do laboratório usam `assets/microscopio-laboratorio.jpg`.
