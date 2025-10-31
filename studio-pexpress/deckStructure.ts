import type {StructureResolver} from 'sanity/structure'

export const deckStructure: StructureResolver = (S) =>
  S.list()
    .title('Conteúdo')
    .items([
      S.listItem()
        .title('Produtos')
        .schemaType('product')
        .child(S.documentTypeList('product').title('Produtos')),
    ])

export default deckStructure
