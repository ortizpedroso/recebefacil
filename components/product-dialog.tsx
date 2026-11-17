"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCatalogAction, toggleCatalogAction } from "@/app/actions";
import { CATALOG_KINDS, kindLabel, tracksStock, type CatalogKind } from "@/lib/labels";
import { maskMoney } from "@/lib/masks";
import { MAX_PHOTO_BYTES } from "@/lib/photo-limits";
import { FormError, Modal } from "./dialog";
import { Menu, MenuItem } from "./menu";
import { toast } from "./toast";
import { buttonClass, Field, inputClass, ProductPhoto, secondaryButtonClass } from "./ui";

export type ProductData = {
  id: string;
  name: string;
  kind: CatalogKind;
  price: string;
  category: string;
  sku: string;
  stock: string;
  photoId: string | null;
};

function ProductForm({ product, onDone }: { product?: ProductData; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<CatalogKind>(product?.kind ?? "produto");
  const [price, setPrice] = useState(product?.price ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const data = new FormData(event.currentTarget);
        if (product) data.set("id", product.id);
        const result = await saveCatalogAction(data);
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast(product ? "Alterações salvas." : "Produto salvo.");
        onDone();
        router.refresh();
      }}
    >
      <div className="flex items-center gap-3">
        <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-20 w-20 object-cover" />
          ) : (
            <ProductPhoto name={product?.name || "Novo"} photoId={product?.photoId} className="h-20 w-20 text-xl" />
          )}
        </span>
        <Field label="Foto" hint="JPG, PNG ou WebP, até 1 MB">
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-800"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setError("");
              if (!file) {
                setPreview(null);
                return;
              }
              if (file.size > MAX_PHOTO_BYTES) {
                setError("A foto passa de 1 MB. Escolha uma foto menor.");
                event.target.value = "";
                setPreview(null);
                return;
              }
              setPreview(URL.createObjectURL(file));
            }}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <input name="name" className={inputClass} placeholder="Ex.: Corte feminino" defaultValue={product?.name} required autoComplete="off" />
        </Field>
        <Field label="Preço">
          <input name="price" className={inputClass} inputMode="numeric" placeholder="0,00" value={price} onChange={(event) => setPrice(maskMoney(event.target.value))} required />
        </Field>
      </div>
      <Field label="Tipo">
        <select name="kind" className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as CatalogKind)}>
          {CATALOG_KINDS.map((option) => (
            <option key={option} value={option}>
              {kindLabel(option)}
            </option>
          ))}
        </select>
      </Field>
      <details className="rounded-lg border border-slate-200">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">Mais opções (categoria, código, estoque)</summary>
        <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
          <Field label="Categoria" hint="opcional">
            <input name="category" className={inputClass} defaultValue={product?.category} />
          </Field>
          <Field label="Código" hint="opcional">
            <input name="sku" className={inputClass} defaultValue={product?.sku} />
          </Field>
          {tracksStock(kind) ? (
            <Field label="Estoque" hint="quantas unidades você tem">
              <input name="stock" className={inputClass} inputMode="numeric" placeholder="0" defaultValue={product?.stock} />
            </Field>
          ) : (
            <p className="self-end text-sm text-slate-500 sm:col-span-2">{kindLabel(kind)} não tem estoque para contar.</p>
          )}
        </div>
      </details>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export function NewProductButton({ first = false }: { first?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        {first ? "Cadastrar o primeiro produto" : "+ Novo"}
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Novo produto ou serviço" wide>
        {open ? <ProductForm onDone={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

export function ProductMenu({ product, active }: { product: ProductData; active: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Menu label={`Mais opções de ${product.name}`} className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm hover:bg-white" trigger={<MoreHorizontal className="h-4 w-4" />}>
        <MenuItem onSelect={() => setEditing(true)}>Editar</MenuItem>
        <MenuItem
          onSelect={async () => {
            const result = await toggleCatalogAction(product.id, !active);
            if (!result.ok) {
              toast(result.error);
              return;
            }
            toast(active ? "Produto inativado. Ele não aparece mais nas vendas." : "Produto reativado.");
            router.refresh();
          }}
        >
          {active ? "Inativar" : "Reativar"}
        </MenuItem>
      </Menu>
      <Modal open={editing} onOpenChange={setEditing} title="Editar produto ou serviço" wide>
        {editing ? <ProductForm product={product} onDone={() => setEditing(false)} /> : null}
      </Modal>
    </>
  );
}
