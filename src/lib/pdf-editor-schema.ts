import { z } from "zod";
export const pdfFonts = ["helv", "hebo", "heit", "tiro", "tibo", "cour"] as const;
export const pdfEditSchema = z.object({
  page: z.number().int().min(0).max(9), block_id: z.number().int().nonnegative(),
  text: z.string().trim().min(1).max(4000), font: z.enum(pdfFonts), font_size: z.number().min(6).max(48),
}).strict();
export const pdfEditsSchema = z.array(pdfEditSchema).min(1).max(10).refine(edits => new Set(edits.map(edit => `${edit.page}:${edit.block_id}`)).size === edits.length, "A text block can only be edited once per preview.");
export const pdfPageSchema = z.object({
  page: z.number().int(), page_count: z.number().int().min(1).max(10), width: z.number().positive(), height: z.number().positive(),
  image: z.string().max(4000000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/), rotated: z.boolean(),
  blocks: z.array(z.object({ id: z.number().int(), text: z.string(), bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]), font: z.enum(pdfFonts), font_size: z.number(), original_font: z.string(), color: z.number(), editable: z.boolean() })).max(200),
});
export type PdfEdit = z.infer<typeof pdfEditSchema>;
export type PdfPage = z.infer<typeof pdfPageSchema>;
