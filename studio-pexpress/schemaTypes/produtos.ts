// /schemas/product.ts
import {defineType, defineField, defineArrayMember} from "sanity"

export const product = defineType({
  name: "product",
  title: "Produto",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Nome do produto",
      type: "string",
      validation: (Rule) => Rule.required().min(2),
    }),
    defineField({
      name: "rows",
      title: "Sabores e estoque",
      type: "array",
      of: [
        defineArrayMember({
          name: "row",
          title: "Linha",
          type: "object",
          fields: [
            defineField({
              name: "flavor",
              title: "Sabor",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "stock",
              title: "Estoque (unidades)",
              type: "number",
              initialValue: 0,
              validation: (Rule) => Rule.min(0),
            }),
          ],
          preview: {
            select: {flavor: "flavor", stock: "stock"},
            prepare: ({flavor, stock}) => ({
              title: flavor,
              subtitle: `Estoque: ${stock ?? 0}`,
            }),
          },
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: {title: "name", rows: "rows"},
    prepare: ({title, rows}) => ({
      title,
      subtitle: `Itens: ${Array.isArray(rows) ? rows.length : 0}`,
    }),
  },
})
