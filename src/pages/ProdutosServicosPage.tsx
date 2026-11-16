import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Power, Package } from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { CatalogoItem, TipoCatalogo, TipoServico } from '../types/recebefacil';
import { formatBRL } from '../utils/formatters';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';

export const ProdutosServicosPage: React.FC = () => {
  const { state, addCatalogoItem, updateCatalogoItem, toggleCatalogoAtivo } = useRecebeFacil();

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoCatalogo>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoItem | null>(null);
  const [confirmToggleItem, setConfirmToggleItem] = useState<CatalogoItem | null>(null);

  const [tipoCatalogo, setTipoCatalogo] = useState<TipoCatalogo>('produto');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');
  const [codigoRef, setCodigoRef] = useState('');
  const [tipoServico, setTipoServico] = useState<TipoServico>('pontual');
  const [ativo, setAtivo] = useState(true);

  const filteredItems = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return state.catalogo.filter((item) => {
      if (filtroTipo !== 'todos' && item.tipoCatalogo !== filtroTipo) return false;
      if (filtroStatus === 'ativo' && !item.ativo) return false;
      if (filtroStatus === 'inativo' && item.ativo) return false;
      if (!q) return true;
      return (
        item.nome.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q) ||
        item.descricao.toLowerCase().includes(q) ||
        (item.codigoReferencia && item.codigoReferencia.toLowerCase().includes(q))
      );
    });
  }, [state.catalogo, busca, filtroTipo, filtroStatus]);

  const handleOpenCreate = (tipoInicial: TipoCatalogo = 'produto') => {
    setEditingItem(null);
    setTipoCatalogo(tipoInicial);
    setNome('');
    setDescricao('');
    setCategoria('');
    setPreco('');
    setCodigoRef('');
    setTipoServico('pontual');
    setAtivo(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: CatalogoItem) => {
    setEditingItem(item);
    setTipoCatalogo(item.tipoCatalogo);
    setNome(item.nome);
    setDescricao(item.descricao);
    setCategoria(item.categoria);
    setPreco(String(item.preco));
    setCodigoRef(item.codigoReferencia || '');
    setTipoServico(item.tipoServico || 'pontual');
    setAtivo(item.ativo);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(preco.replace(',', '.')) || 0;
    if (!nome.trim() || valorNum <= 0) return;

    const payload = {
      tipoCatalogo,
      nome: nome.trim(),
      descricao: descricao.trim(),
      categoria: categoria.trim() || 'Geral',
      preco: valorNum,
      codigoReferencia: tipoCatalogo === 'produto' ? codigoRef.trim() || undefined : undefined,
      tipoServico: tipoCatalogo === 'servico' ? tipoServico : undefined,
      ativo,
    };

    if (editingItem) {
      updateCatalogoItem(editingItem.id, payload);
    } else {
      addCatalogoItem(payload);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Produtos e serviços
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Catálogo unificado para vendas avulsas, parcelamentos, contratos e assinaturas recorrentes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreate('produto')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar item</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome, categoria ou código..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'produto', label: 'Produtos' },
                { id: 'servico', label: 'Serviços' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFiltroTipo(t.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filtroTipo === t.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="todos">Todas situações</option>
            <option value="ativo">Somente ativos</option>
            <option value="inativo">Somente inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela Unificada */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum item encontrado no catálogo"
          description="Cadastre produtos ou serviços para agilizar suas vendas ou filtre por outra categoria."
          actionLabel="Cadastrar produto ou serviço"
          onAction={() => handleOpenCreate('produto')}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Item e descrição</th>
                <th className="py-3 px-4 font-semibold">Tipo</th>
                <th className="py-3 px-4 font-semibold">Categoria</th>
                <th className="py-3 px-4 font-semibold">Código / Modalidade</th>
                <th className="py-3 px-4 font-semibold text-right">Preço padrão</th>
                <th className="py-3 px-4 font-semibold">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-semibold text-slate-900">{item.nome}</div>
                    <div className="text-[11px] text-slate-500 truncate">{item.descricao}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700 capitalize whitespace-nowrap">
                    {item.tipoCatalogo === 'produto' ? 'Produto' : 'Serviço'}
                  </td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{item.categoria}</td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                    {item.tipoCatalogo === 'produto' ? (
                      <span className="font-mono text-slate-500">
                        {item.codigoReferencia || 'Sem código'}
                      </span>
                    ) : (
                      <span className="capitalize">
                        {item.tipoServico === 'recorrente' ? 'Recorrente' : 'Pontual'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatBRL(item.preco)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge
                      label={item.ativo ? 'Ativo' : 'Inativo'}
                      variant={item.ativo ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Editar item"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmToggleItem(item)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.ativo
                            ? 'text-slate-500 hover:text-rose-700 hover:bg-rose-50'
                            : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={item.ativo ? 'Inativar item' : 'Reativar item'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Cadastro / Edição */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Editar item do catálogo' : 'Cadastrar produto ou serviço'}
        subtitle="Você também pode lançar itens personalizados diretamente na criação de uma venda."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Tipo do cadastro</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoCatalogo('produto')}
                className={`py-2 px-3 rounded-lg border font-semibold transition-colors ${
                  tipoCatalogo === 'produto'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Produto
              </button>
              <button
                type="button"
                onClick={() => setTipoCatalogo('servico')}
                className={`py-2 px-3 rounded-lg border font-semibold transition-colors ${
                  tipoCatalogo === 'servico'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Serviço
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nome *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={
                  tipoCatalogo === 'produto'
                    ? 'Ex: Móveis planejados, Terreno Lote 15...'
                    : 'Ex: Consultoria mensal, Instalação técnica...'
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
              <input
                type="text"
                required
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Imóveis, Consultoria, Educação"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Preço padrão (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>

            {tipoCatalogo === 'produto' ? (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Código ou referência (opcional)
                </label>
                <input
                  type="text"
                  value={codigoRef}
                  onChange={(e) => setCodigoRef(e.target.value)}
                  placeholder="Ex: REF-102"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-teal-600"
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de serviço</label>
                <select
                  value={tipoServico}
                  onChange={(e) => setTipoServico(e.target.value as TipoServico)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="pontual">Pontual (serviço único)</option>
                  <option value="recorrente">Recorrente (mensalidade/plano)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Situação</label>
              <select
                value={ativo ? 'ativo' : 'inativo'}
                onChange={(e) => setAtivo(e.target.value === 'ativo')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="ativo">Ativo no catálogo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
              <textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes comerciais do produto ou escopo do serviço..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              {editingItem ? 'Salvar alterações' : 'Adicionar ao catálogo'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmToggleItem}
        onClose={() => setConfirmToggleItem(null)}
        onConfirm={() => {
          if (confirmToggleItem) toggleCatalogoAtivo(confirmToggleItem.id);
        }}
        title={confirmToggleItem?.ativo ? 'Inativar item do catálogo' : 'Reativar item'}
        description={
          confirmToggleItem?.ativo
            ? `O item "${confirmToggleItem.nome}" será marcado como inativo e não aparecerá como opção padrão em novas vendas. Deseja continuar?`
            : `O item "${confirmToggleItem?.nome}" voltará a ficar ativo para novas vendas.`
        }
        confirmLabel={confirmToggleItem?.ativo ? 'Inativar' : 'Reativar'}
        danger={!!confirmToggleItem?.ativo}
      />
    </div>
  );
};
